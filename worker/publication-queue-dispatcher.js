import { INTERNATIONAL_COMPARISON_REFRESH_BATCHES } from "./international-comparison-publication.js";
import {
  RUN_TTL_SECONDS,
  bootstrapRunId,
  kvGet,
  kvPut,
  runKey,
  terminalKey,
} from "./publication-run-store.js";
import { processQueueJob } from "./publication-job-runner.js";
import {
  PUBLICATION_QUEUE_MAX_RETRIES,
  enqueueBootstrapComparisonRefresh,
  enqueueComparisonRefreshBatches,
  finaliseComparisonBatches,
} from "./publication-comparison-runner.js";
import {
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  FINALISE_RETRY_SECONDS,
  enqueueCompletedBootstrapFinaliser,
  enqueuePublicationRun,
  finaliseRun,
  recordFinaliseFailure,
  recordTerminal,
} from "./publication-run-lifecycle.js";

// Worst-case wait before a bootstrap run with a failing/slow section is
// finalised as incomplete. Healthy runs prompt-finalise as soon as all
// required jobs succeed.
const BOOTSTRAP_DEADLINE_SECONDS = 4 * 60;
const BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS = 8 * 60;
const BOOTSTRAP_FINALISE_DELAY_SECONDS = BOOTSTRAP_DEADLINE_SECONDS;

async function dispatchPublicationMessage(message, env, ctx) {
  const job = message.body;
  try {
    if (job?.type === "bootstrap-publication") {
      const deploymentId = String(job.deploymentId ?? "");
      const forceComparison = job.forceComparison === true;
      const includeContracts = job.includeContracts === true;
      const result = await enqueuePublicationRun(
        env,
        new Date(),
        "bootstrap",
        {
          runId: bootstrapRunId(deploymentId),
          finaliseDelaySeconds: includeContracts
            ? BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS
            : BOOTSTRAP_FINALISE_DELAY_SECONDS,
          deadlineSeconds: includeContracts
            ? BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS
            : BOOTSTRAP_DEADLINE_SECONDS,
          finaliseRetrySeconds: BOOTSTRAP_FINALISE_RETRY_SECONDS,
          comparisonRefreshRequested: true,
          comparisonRefreshForce: forceComparison,
          includeContracts,
        }
      );
      if (!result.dispatched && forceComparison && !result.run.finalisedAt) {
        await kvPut(
          env,
          runKey(result.run.runId),
          {
            ...result.run,
            comparisonRefreshRequested: true,
            comparisonRefreshForce: true,
          },
          { expirationTtl: RUN_TTL_SECONDS }
        );
      } else if (!result.dispatched && forceComparison && result.run.finalisedAt) {
        await enqueueComparisonRefreshBatches(env, result.run.runId, { force: true });
      }
      console.log("Cloudflare publication bootstrap accepted", {
        runId: result.run.runId,
        dispatched: result.dispatched,
      });
      message.ack();
      return;
    }

    if (job?.type === "finalise-run") {
      const result = await finaliseRun(String(job.runId ?? ""), env);
      if (result.pending) {
        const retryDelaySeconds = Number(job.retryDelaySeconds);
        message.retry({
          delaySeconds:
            Number.isFinite(retryDelaySeconds) && retryDelaySeconds >= 60
              ? retryDelaySeconds
              : FINALISE_RETRY_SECONDS,
        });
      } else {
        await enqueueBootstrapComparisonRefresh(result.run, env);
        console.log("Cloudflare publication run finalised", {
          runId: result.run.runId,
          scope: result.run.scope,
          status: result.run.status,
        });
        message.ack();
      }
      return;
    }

    if (job?.type === "finalise-international-comparison") {
      const result = await finaliseComparisonBatches(env, job);
      if (result.pending) {
        await recordTerminal(env, job, "pending", result.result);
        await env.DATA_JOBS.send(job, { delaySeconds: FINALISE_RETRY_SECONDS });
      } else {
        await recordTerminal(env, job, result.status, result.result);
        console.log("Cloudflare international comparison batches finalised", {
          runId: job.runId,
          status: result.status,
          completedBatches: result.result?.completedBatches?.length ?? 0,
          failedBatches: result.result?.failedBatches?.length ?? 0,
        });
      }
      message.ack();
      return;
    }

    if (
      job?.type === "refresh-international-comparison" &&
      typeof job.runId === "string" &&
      typeof job.jobId === "string"
    ) {
      const terminal = await kvGet(env, terminalKey(job.runId, job.jobId));
      if (terminal?.status === "success") {
        message.ack();
        return;
      }
      if (typeof job.batchId !== "string") {
        await enqueueComparisonRefreshBatches(env, job.runId, {
          force: job.force === true,
        });
        message.ack();
        return;
      }
      const batch = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ id }) => id === job.batchId);
      if (!batch || JSON.stringify(job.sourceIds) !== JSON.stringify(batch.sourceIds)) {
        throw new Error("International comparison batch identity is invalid");
      }
    }

    const result = await processQueueJob(job, env, ctx);
    await recordTerminal(env, job, "success", result);
    try {
      await enqueueCompletedBootstrapFinaliser(job.runId, env);
    } catch (error) {
      console.error("Cloudflare prompt bootstrap finaliser failed", {
        runId: job.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const logResult = job?.type === "refresh-international-comparison" && job.batchId
      ? { type: result.type, updated: result.updated, due: result.due }
      : result;
    console.log("Cloudflare data publication job completed", logResult);
    message.ack();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    if (job?.type === "finalise-run") {
      try {
        await recordFinaliseFailure(env, String(job.runId ?? ""), error);
      } catch {
        // Preserve the Queue retry even if the private diagnostic write fails.
      }
    }

    if (job?.type === "finalise-international-comparison") {
      const attempts = Number(message.attempts);
      const retrying =
        !Number.isSafeInteger(attempts) ||
        attempts <= PUBLICATION_QUEUE_MAX_RETRIES;
      await recordTerminal(env, job, retrying ? "pending" : "failure", {
        errorCode: retrying
          ? "comparison-finalisation-retrying"
          : "comparison-finalisation-failed",
        errorName: error instanceof Error ? error.name : "Error",
      });
      if (retrying) message.retry({ delaySeconds: FINALISE_RETRY_SECONDS });
      else message.ack();
      return;
    }

    const comparisonBatchRetrying =
      job?.type === "refresh-international-comparison" &&
      job.batchId &&
      (
        !Number.isSafeInteger(message.attempts) ||
        message.attempts <= PUBLICATION_QUEUE_MAX_RETRIES
      );

    await recordTerminal(env, job, comparisonBatchRetrying ? "pending" : "failure", {
      errorCode: "job-failed",
      errorName: error instanceof Error ? error.name : "Error",
      errorMessage: errorMessage.slice(0, 500),
    });

    console.error("Cloudflare data publication job failed", {
      job,
      error: errorMessage,
    });

    if (
      (job?.type === "refresh-section" ||
        job?.type === "refresh-external-section") &&
      typeof job?.runId === "string" &&
      job.runId.startsWith("bootstrap-") &&
      typeof job.jobId === "string"
    ) {
      console.warn(
        "Cloudflare bootstrap source failure is terminal; allowing degraded finalisation",
        {
          runId: job.runId,
          jobId: job.jobId,
        }
      );
      message.ack();
      return;
    }

    const retryAfterSeconds =
      error &&
      typeof error === "object" &&
      Number.isSafeInteger(error.retryAfterSeconds)
        ? error.retryAfterSeconds
        : FINALISE_RETRY_SECONDS;
    message.retry({ delaySeconds: retryAfterSeconds });
  }
}

export {
  BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS,
  BOOTSTRAP_DEADLINE_SECONDS,
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
  dispatchPublicationMessage,
};
