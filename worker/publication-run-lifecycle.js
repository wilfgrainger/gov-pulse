import {
  RUN_TTL_SECONDS,
  kvGet,
  kvPut,
  runIdFor,
  runKey,
  terminalKey,
} from "./publication-run-store.js";
import { refreshJobs } from "./publication-plan.js";
import { publishFromCaches } from "./publication-publisher.js";

const FINALISE_DELAY_SECONDS = 20 * 60;
const FINALISE_RETRY_SECONDS = 5 * 60;
const BOOTSTRAP_FINALISE_RETRY_SECONDS = 60;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function recordTerminal(env, job, status, result = null) {
  if (typeof job?.runId !== "string" || typeof job?.jobId !== "string") return;
  await kvPut(
    env,
    terminalKey(job.runId, job.jobId),
    {
      runId: job.runId,
      jobId: job.jobId,
      status,
      completedAt: status === "pending" ? null : new Date().toISOString(),
      result,
    },
    { expirationTtl: RUN_TTL_SECONDS }
  );
}

async function recordFinaliseFailure(env, runId, error, now = new Date()) {
  if (typeof runId !== "string" || !runId.startsWith("bootstrap-")) return false;
  const run = await kvGet(env, runKey(runId));
  if (run?.scope !== "bootstrap" || run.finalisedAt) return false;
  const errorName = error instanceof Error ? error.name : "Error";
  const errorMessage = error instanceof Error ? error.message : String(error);
  await kvPut(
    env,
    runKey(runId),
    {
      ...run,
      finalisationFailure: {
        at: now.toISOString(),
        errorName: errorName.slice(0, 100),
        errorMessage: errorMessage.slice(0, 500),
      },
    },
    { expirationTtl: RUN_TTL_SECONDS }
  );
  return true;
}

async function createRun(env, now, scope = "daily", options = {}) {
  const runId = options.runId ?? runIdFor(now);
  const existing = await kvGet(env, runKey(runId));
  if (isRecord(existing)) {
    return {
      run: existing,
      jobs: refreshJobs(runId, existing.scope ?? scope, {
        includeContracts: existing.contractsRefreshRequested === true,
      }),
      existing: true,
    };
  }

  const jobs = refreshJobs(runId, scope, options);
  const deadlineSeconds =
    options.deadlineSeconds ?? FINALISE_DELAY_SECONDS + FINALISE_RETRY_SECONDS;
  const run = {
    runId,
    scope,
    status: "running",
    createdAt: now.toISOString(),
    deadlineAt: new Date(now.getTime() + deadlineSeconds * 1000).toISOString(),
    expectedJobIds: jobs.map((job) => job.jobId),
    dispatchedAt: null,
    finalisedAt: null,
    ...(scope === "bootstrap"
      ? {
          comparisonRefreshRequested: options.comparisonRefreshRequested === true,
          comparisonRefreshForce: options.comparisonRefreshForce === true,
          contractsRefreshRequested: options.includeContracts === true,
        }
      : {}),
  };
  await kvPut(env, runKey(runId), run, { expirationTtl: RUN_TTL_SECONDS });
  return { run, jobs, existing: false };
}

async function enqueuePublicationRun(env, now, scope = "daily", options = {}) {
  if (!env?.DATA_JOBS?.sendBatch || !env?.DATA_JOBS?.send) {
    throw new Error("DATA_JOBS queue binding is required");
  }

  const created = await createRun(env, now, scope, options);
  if (created.run.dispatchedAt) {
    return { ...created, dispatched: false };
  }

  const finaliseDelaySeconds =
    options.finaliseDelaySeconds ?? FINALISE_DELAY_SECONDS;
  const finaliseRetrySeconds =
    options.finaliseRetrySeconds ?? FINALISE_RETRY_SECONDS;
  await env.DATA_JOBS.sendBatch(created.jobs.map((body) => ({ body })));
  await env.DATA_JOBS.send(
    {
      type: "finalise-run",
      runId: created.run.runId,
      retryDelaySeconds: finaliseRetrySeconds,
    },
    { delaySeconds: finaliseDelaySeconds }
  );

  const dispatchedRun = {
    ...created.run,
    dispatchedAt: new Date().toISOString(),
  };
  await kvPut(env, runKey(dispatchedRun.runId), dispatchedRun, {
    expirationTtl: RUN_TTL_SECONDS,
  });
  return { ...created, run: dispatchedRun, dispatched: true };
}

async function readTerminals(env, run) {
  const terminals = [];
  for (const jobId of run.expectedJobIds) {
    const terminal = await kvGet(env, terminalKey(run.runId, jobId));
    if (terminal) terminals.push(terminal);
  }
  return terminals;
}

async function finaliseRun(runId, env, options = {}) {
  const now = options.now ?? new Date();
  const run = await kvGet(env, runKey(runId));
  if (!isRecord(run)) throw new Error("Publication run record is unavailable");
  if (run.finalisedAt) return { run, alreadyFinalised: true };

  const terminals = await readTerminals(env, run);
  const terminalById = new Map(
    terminals.map((terminal) => [terminal.jobId, terminal])
  );
  const complete = run.expectedJobIds.every(
    (jobId) => terminalById.get(jobId)?.status === "success"
  );
  const deadlineMs = Date.parse(run.deadlineAt);
  if (!complete && Number.isFinite(deadlineMs) && now.getTime() < deadlineMs) {
    return { run, pending: true };
  }

  const successful = terminals.filter((terminal) => terminal.status === "success");
  let publicationResult = null;
  if (complete || successful.length > 0) {
    try {
      publicationResult = await publishFromCaches(env, { ...options, now });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (complete || message !== "Publication snapshot has no current source-owned evidence") {
        throw error;
      }
    }
  }

  const finalStatus = !complete
    ? "incomplete"
    : publicationResult?.incomplete
      ? "incomplete"
      : publicationResult?.changed
        ? "published"
        : "no-change";
  const finalised = {
    ...run,
    status: finalStatus,
    successfulJobIds: successful.map((terminal) => terminal.jobId).sort(),
    failedJobIds: terminals
      .filter((terminal) => terminal.status !== "success")
      .map((terminal) => terminal.jobId)
      .sort(),
    missingJobIds: run.expectedJobIds
      .filter((jobId) => !terminalById.has(jobId))
      .sort(),
    publicationGeneratedAt:
      publicationResult?.publication?.meta?.generatedAt ?? null,
    finalisedAt: now.toISOString(),
  };
  await kvPut(env, runKey(runId), finalised, { expirationTtl: RUN_TTL_SECONDS });
  return { run: finalised, publicationResult, pending: false };
}

async function enqueueCompletedBootstrapFinaliser(runId, env) {
  if (typeof runId !== "string" || !runId.startsWith("bootstrap-")) return false;
  const run = await kvGet(env, runKey(runId));
  if (run?.scope !== "bootstrap" || run.finalisedAt) return false;
  const terminals = await readTerminals(env, run);
  if (!run.expectedJobIds.every((jobId) =>
    terminals.some((terminal) => terminal.jobId === jobId && terminal.status === "success")
  )) return false;
  await env.DATA_JOBS.send({
    type: "finalise-run",
    runId,
    retryDelaySeconds: BOOTSTRAP_FINALISE_RETRY_SECONDS,
  });
  return true;
}

export {
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  FINALISE_DELAY_SECONDS,
  FINALISE_RETRY_SECONDS,
  createRun,
  enqueueCompletedBootstrapFinaliser,
  enqueuePublicationRun,
  finaliseRun,
  readTerminals,
  recordFinaliseFailure,
  recordTerminal,
};
