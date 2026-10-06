import { refreshGovernmentContracts } from "./government-contracts-cloudflare.js";
import {
  INTERNATIONAL_COMPARISON_REFRESH_BATCHES,
  refreshInternationalComparison,
} from "./international-comparison-publication.js";
import {
  RUN_PREFIX,
  RUN_TTL_SECONDS,
  bootstrapRunId,
  kvGet,
  kvPut,
  runIdFor,
  runKey,
  terminalKey,
} from "./publication-run-store.js";
import {
  EXTERNAL_SECTIONS,
  GENERIC_SECTIONS,
  PUBLISHED_SECTIONS,
  jobsForDay,
  refreshJobs,
} from "./publication-plan.js";
import {
  missingRequiredSections,
  publicationFragments,
  publishFromCaches,
} from "./publication-publisher.js";
import {
  PUBLICATION_SECTION_PREFIX,
  storeExternalSection,
  storeSectionFragment,
} from "./publication-collection-runner.js";
import {
  PUBLICATION_QUEUE_MAX_RETRIES,
  comparisonBatchBaseKey,
  enqueueBootstrapComparisonRefresh,
  enqueueComparisonRefreshBatches,
  enqueueInternationalComparisonRefresh,
  finaliseComparisonBatches,
} from "./publication-comparison-runner.js";
import {
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  FINALISE_DELAY_SECONDS,
  FINALISE_RETRY_SECONDS,
  createRun,
  enqueueCompletedBootstrapFinaliser,
  enqueuePublicationRun,
  finaliseRun,
  recordFinaliseFailure,
  recordTerminal,
} from "./publication-run-lifecycle.js";

// Worst-case wait before a bootstrap run with a failing/slow section is
// finalised as `incomplete`. A HEALTHY run is finalised immediately by the
// prompt finaliser (enqueueCompletedBootstrapFinaliser) once every required
// job succeeds, so this deadline only bounds the degraded case. Sized to a
// healthy run's real duration (sections collect in seconds each) plus headroom,
// not padded — it was 12 min, which made every deploy wait 12 min whenever any
// section failed. The deploy's BOOTSTRAP_TIMEOUT_MS must stay comfortably above
// this so the finalise lands and is observed.
const BOOTSTRAP_DEADLINE_SECONDS = 4 * 60;
const BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS = 8 * 60;
// Keep the delayed finaliser for partial runs. Successful bootstrap jobs also
// enqueue an immediate finaliser once every required job has finished.
const BOOTSTRAP_FINALISE_DELAY_SECONDS = BOOTSTRAP_DEADLINE_SECONDS;
const DAILY_CRON = "17 3 * * *";
const BETTING_CRON = "47 */3 * * *";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function processQueueJob(job, env, ctx, options = {}) {
  if (job?.type === "refresh-international-comparison") {
    if (typeof job.batchId === "string") {
      const batch = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ id }) => id === job.batchId);
      const baseRecord = await kvGet(env, comparisonBatchBaseKey(job.runId));
      if (!batch || !isRecord(baseRecord?.publication)) {
        throw new Error("International comparison batch baseline is not available");
      }
      const result = await refreshInternationalComparison(env, {
        fetchImpl: options.fetchImpl ?? fetch,
        now: options.now ?? new Date(),
        force: job.force === true,
        sourceIds: job.sourceIds,
        currentPublication: baseRecord.publication,
        publish: false,
      });
      const publication = result.publication;
      return {
        type: job.type,
        updated: result.updated,
        due: result.due,
        comparisonFragment: {
          batchId: batch.id,
          meta: {
            generatedAt: publication.meta.generatedAt,
            checkedAt: publication.meta.checkedAt,
            attemptedSources: publication.meta.attemptedSources ?? [...batch.sourceIds],
            sourceFailures: publication.meta.sourceFailures ?? [],
          },
          measures: Object.fromEntries(batch.measureIds.map((id) => [id, publication.measures[id]])),
        },
      };
    }
    const result = await refreshInternationalComparison(env, {
      fetchImpl: options.fetchImpl ?? fetch,
      now: options.now ?? new Date(),
      force: job.force === true,
      ...(Array.isArray(job.sourceIds) ? { sourceIds: job.sourceIds } : {}),
    });
    return { type: job.type, updated: result.updated, due: result.due };
  }
  if (job?.type === "refresh-section") {
    const record = await storeSectionFragment(String(job.section ?? ""), env, ctx);
    return { type: job.type, section: record.section, fetchedAt: record.fetchedAt };
  }
  if (job?.type === "refresh-external-section") {
    const record = await storeExternalSection(String(job.section ?? ""), env, {
      fetchImpl: options.fetchImpl ?? fetch,
      now: options.now ?? new Date(),
    });
    return { type: job.type, section: record.section, fetchedAt: record.fetchedAt };
  }
  if (job?.type === "refresh-contracts") {
    const result = await refreshGovernmentContracts(env, {
      fetchImpl: options.fetchImpl ?? fetch,
      now: options.now,
      force: job.force === true,
    });
    return {
      type: job.type,
      updated: result.updated,
      collectedDays: result.collected,
      requestsMade: result.requestsMade,
    };
  }
  throw new Error("Unknown Cloudflare data publication job");
}

const queuedPublicationWorker = {
  async fetch(request) {
    // The deployed entrypoint is public-data-entry.js, which serves the public
    // routes itself and only delegates scheduled()/queue() here — this fetch
    // handler is not on the live path. The former publicationWorker.fetch
    // fallback (the retired daily-rotation worker) was removed in the STEP 2
    // simplification, so respond 404 rather than reference a deleted export.
    const url = new URL(request.url);
    if (url.pathname === "/data/metrics-snapshot.json") {
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const now = new Date(controller.scheduledTime ?? Date.now());
        const scope = controller.cron === BETTING_CRON ? "betting" : "daily";
        await enqueuePublicationRun(env, now, scope);
      })().catch((error) => {
        console.error("Cloudflare publication scheduling failed", {
          cron: controller.cron,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
  },

  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
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
          continue;
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
          continue;
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
          continue;
        }

        if (
          job?.type === "refresh-international-comparison" &&
          typeof job.runId === "string" &&
          typeof job.jobId === "string"
        ) {
          const terminal = await kvGet(env, terminalKey(job.runId, job.jobId));
          if (terminal?.status === "success") {
            message.ack();
            continue;
          }
          if (typeof job.batchId !== "string") {
            await enqueueComparisonRefreshBatches(env, job.runId, {
              force: job.force === true,
            });
            message.ack();
            continue;
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
          const retrying = !Number.isSafeInteger(attempts) || attempts <= PUBLICATION_QUEUE_MAX_RETRIES;
          await recordTerminal(env, job, retrying ? "pending" : "failure", {
            errorCode: retrying
              ? "comparison-finalisation-retrying"
              : "comparison-finalisation-failed",
            errorName: error instanceof Error ? error.name : "Error",
          });
          if (retrying) message.retry({ delaySeconds: FINALISE_RETRY_SECONDS });
          else message.ack();
          continue;
        }
        // Persist the real failure reason (not just an opaque code) so a
        // repeatedly-failing section — e.g. an external collector blocked at
        // Cloudflare egress — is diagnosable from the terminal record in KV
        // without needing a live `wrangler tail` across the daily cron window.
        const comparisonBatchRetrying = job?.type === "refresh-international-comparison" && job.batchId &&
          (!Number.isSafeInteger(message.attempts) || message.attempts <= PUBLICATION_QUEUE_MAX_RETRIES);
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
          console.warn("Cloudflare bootstrap source failure is terminal; allowing degraded finalisation", {
            runId: job.runId,
            jobId: job.jobId,
          });
          message.ack();
          continue;
        }
        const retryAfterSeconds =
          error && typeof error === "object" && Number.isSafeInteger(error.retryAfterSeconds)
            ? error.retryAfterSeconds
            : FINALISE_RETRY_SECONDS;
        message.retry({ delaySeconds: retryAfterSeconds });
      }
    }
  },
};

export {
  BETTING_CRON,
  BOOTSTRAP_DEADLINE_SECONDS,
  BOOTSTRAP_CONTRACTS_DEADLINE_SECONDS,
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  DAILY_CRON,
  EXTERNAL_SECTIONS,
  FINALISE_DELAY_SECONDS,
  GENERIC_SECTIONS,
  PUBLISHED_SECTIONS,
  PUBLICATION_SECTION_PREFIX,
  RUN_PREFIX,
  bootstrapRunId,
  createRun,
  enqueueInternationalComparisonRefresh,
  enqueuePublicationRun,
  finaliseRun,
  enqueueCompletedBootstrapFinaliser,
  jobsForDay,
  missingRequiredSections,
  processQueueJob,
  recordFinaliseFailure,
  publicationFragments,
  publishFromCaches,
  refreshJobs,
  runIdFor,
  storeExternalSection,
  storeSectionFragment,
};
export default queuedPublicationWorker;
