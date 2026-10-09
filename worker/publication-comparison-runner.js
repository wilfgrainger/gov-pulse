import {
  INTERNATIONAL_COMPARISON_KEY,
  INTERNATIONAL_COMPARISON_REFRESH_BATCHES,
  INTERNATIONAL_SOURCES,
  due as comparisonRefreshDue,
  buildInternationalComparisonPublication,
  comparisonSourceBundle,
  mergeInternationalComparisonBatchResults,
  readInternationalComparison,
  sourcesDue as comparisonSourcesDue,
} from "./international-comparison-publication.js";
import {
  RUN_PREFIX,
  RUN_TTL_SECONDS,
  kvGet,
  kvPut,
  runIdFor,
  runKey,
  terminalKey,
} from "./publication-run-store.js";
import {
  FINALISE_RETRY_SECONDS,
  recordTerminal,
} from "./publication-run-lifecycle.js";

const PUBLICATION_QUEUE_MAX_RETRIES = 3;
const COMPARISON_FINALISE_INITIAL_DELAY_SECONDS = 60;
const COMPARISON_FINALISE_TIMEOUT_SECONDS =
  (PUBLICATION_QUEUE_MAX_RETRIES + 2) * FINALISE_RETRY_SECONDS;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function comparisonBatchManifestKey(runId) {
  return `${RUN_PREFIX}${runId}:comparison-batches`;
}

function comparisonBatchBaseKey(runId) {
  return `${RUN_PREFIX}${runId}:comparison-base`;
}

function hasComparisonBatchFragment(terminal, batch) {
  const fragment = terminal?.result?.comparisonFragment;
  return terminal?.status === "success" &&
    isRecord(fragment) &&
    fragment.batchId === batch.id &&
    isRecord(fragment.meta) &&
    isRecord(fragment.measures) &&
    batch.measureIds.every((id) => isRecord(fragment.measures[id]));
}

async function finaliseComparisonBatches(env, job, now = new Date()) {
  const validBatchIds = new Set(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) => id));
  const expectedBatchIds = Array.isArray(job?.expectedBatchIds)
    ? [...new Set(job.expectedBatchIds.filter((id) => validBatchIds.has(id)))]
    : [];
  if (typeof job?.runId !== "string" || expectedBatchIds.length === 0) {
    return {
      status: "failure",
      result: { errorCode: "comparison-finaliser-input-invalid" },
    };
  }

  const expectedBatches = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.filter(({ id }) =>
    expectedBatchIds.includes(id)
  );
  const terminals = await Promise.all(expectedBatches.map(({ id }) =>
    kvGet(env, terminalKey(job.runId, `comparison:${job.runId}:${id}`))
  ));
  const pendingBatches = expectedBatches.filter((_, index) =>
    terminals[index]?.status !== "success" && terminals[index]?.status !== "failure"
  ).map(({ id }) => id);
  const missingFragments = expectedBatches.filter((batch, index) =>
    terminals[index]?.status === "success" && !hasComparisonBatchFragment(terminals[index], batch)
  ).map(({ id }) => id);
  const baseRecord = await kvGet(env, comparisonBatchBaseKey(job.runId));
  const baseMissing = !isRecord(baseRecord?.publication);
  const deadlineAt = Date.parse(String(job.deadlineAt ?? ""));
  const pending = pendingBatches.length > 0 || missingFragments.length > 0 || baseMissing;

  if (pending) {
    const unresolved = {
      pendingBatches,
      missingFragments,
      baselineMissing: baseMissing,
    };
    if (Number.isFinite(deadlineAt) && now.getTime() >= deadlineAt) {
      return {
        status: "failure",
        result: { errorCode: "comparison-finalisation-timeout", ...unresolved },
      };
    }
    return { pending: true, result: { errorCode: "comparison-batches-pending", ...unresolved } };
  }

  const failedBatches = expectedBatches.filter((_, index) => terminals[index]?.status === "failure").map(({ id }) => id);
  const successfulResults = terminals
    .filter((terminal) => terminal?.status === "success")
    .map((terminal) => terminal.result.comparisonFragment);
  let publication = null;
  if (successfulResults.length > 0) {
    publication = mergeInternationalComparisonBatchResults(
      baseRecord.publication,
      successfulResults,
      now
    );
    await kvPut(env, INTERNATIONAL_COMPARISON_KEY, publication);
  }

  return {
    status: failedBatches.length > 0 ? "failure" : "success",
    result: {
      completedBatches: expectedBatchIds.filter((id) => !failedBatches.includes(id)),
      failedBatches,
      ...(publication ? { generatedAt: publication.meta.generatedAt } : {}),
    },
  };
}

async function enqueueComparisonRefreshBatches(env, runId, options = {}) {
  if (typeof env?.DATA_JOBS?.send !== "function") {
    throw new Error("DATA_JOBS Queue binding is required");
  }
  const parentJobId = `comparison:${runId}`;
  const parentTerminal = await kvGet(env, terminalKey(runId, parentJobId));
  if (parentTerminal?.status === "success") {
    return { queued: 0, reason: "already-complete" };
  }
  if (parentTerminal?.status === "failure") {
    await recordTerminal(env, { runId, jobId: parentJobId }, "pending", {
      errorCode: "comparison-refresh-retrying",
    });
  }

  const now = options.now ?? new Date();
  const current = await readInternationalComparison(env, now);
  const previousManifest = await kvGet(env, comparisonBatchManifestKey(runId));
  const childTerminals = await Promise.all(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) =>
    kvGet(env, terminalKey(runId, `comparison:${runId}:${id}`))
  ));
  const hasFailedBatch = childTerminals.some((terminal) => terminal?.status === "failure");
  const hasStartedBatch = childTerminals.some(Boolean) || Array.isArray(previousManifest?.batchIds);
  if (!options.force && !hasFailedBatch && !hasStartedBatch && current && !comparisonRefreshDue(current, now)) {
    await recordTerminal(env, { runId, jobId: parentJobId }, "success", {
      updated: false,
      reason: "not-due",
    });
    return { queued: 0, reason: "not-due" };
  }

  const validBatchIds = new Set(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) => id));
  const previousBatchIds = Array.isArray(previousManifest?.batchIds)
    ? previousManifest.batchIds.filter((id) => validBatchIds.has(id))
    : [];
  const selectedSources = options.force || !current
    ? new Set(INTERNATIONAL_SOURCES)
    : new Set(comparisonSourcesDue(current, now));
  const selectedBatches = options.force || !previousBatchIds.length
    ? INTERNATIONAL_COMPARISON_REFRESH_BATCHES.filter(({ sourceIds }) =>
        sourceIds.every((sourceId) => selectedSources.has(sourceId))
      )
    : INTERNATIONAL_COMPARISON_REFRESH_BATCHES.filter(({ id }) => previousBatchIds.includes(id));
  if (selectedBatches.length === 0) {
    throw new Error("International comparison refresh is due but no complete source batch matched");
  }

  const batchIds = [...new Set([
    ...(Array.isArray(previousManifest?.batchIds) ? previousManifest.batchIds : []),
    ...selectedBatches.map(({ id }) => id),
  ])].filter((id) => validBatchIds.has(id));
  const baselineKey = comparisonBatchBaseKey(runId);
  const previousBase = await kvGet(env, baselineKey);
  if (!isRecord(previousBase?.publication)) {
    const publication = current ?? buildInternationalComparisonPublication(
      comparisonSourceBundle({
        sourceFailures: [...INTERNATIONAL_SOURCES],
        attemptedSources: [],
      }),
      now
    );
    await kvPut(env, baselineKey, { publication }, { expirationTtl: RUN_TTL_SECONDS });
  }
  await kvPut(env, comparisonBatchManifestKey(runId), { batchIds }, { expirationTtl: RUN_TTL_SECONDS });

  let queued = 0;
  for (const batch of selectedBatches) {
    const childJobId = `comparison:${runId}:${batch.id}`;
    const terminal = await kvGet(env, terminalKey(runId, childJobId));
    if (hasComparisonBatchFragment(terminal, batch)) continue;
    await env.DATA_JOBS.send({
      type: "refresh-international-comparison",
      runId,
      jobId: childJobId,
      batchId: batch.id,
      sourceIds: [...batch.sourceIds],
      force: true,
    });
    queued += 1;
  }

  await env.DATA_JOBS.send({
    type: "finalise-international-comparison",
    runId,
    jobId: parentJobId,
    expectedBatchIds: batchIds,
    deadlineAt: new Date(now.getTime() + COMPARISON_FINALISE_TIMEOUT_SECONDS * 1000).toISOString(),
  }, { delaySeconds: COMPARISON_FINALISE_INITIAL_DELAY_SECONDS });
  queued += 1;
  return { queued, reason: queued > 0 ? "queued" : "already-complete" };
}

async function enqueueBootstrapComparisonRefresh(run, env) {
  if (
    run?.scope !== "bootstrap" ||
    !run.finalisedAt ||
    run.comparisonRefreshRequested !== true ||
    run.comparisonRefreshQueuedAt
  ) {
    return false;
  }

  const result = await enqueueComparisonRefreshBatches(env, run.runId, {
    force: run.comparisonRefreshForce === true,
  });

  await kvPut(
    env,
    runKey(run.runId),
    { ...run, comparisonRefreshQueuedAt: new Date().toISOString() },
    { expirationTtl: RUN_TTL_SECONDS }
  );
  return result.queued > 0;
}

async function enqueueInternationalComparisonRefresh(env, options = {}) {
  const now = options.now ?? new Date();
  const runId = options.runId ?? `comparison-${runIdFor(now)}`;
  return enqueueComparisonRefreshBatches(env, runId, {
    force: options.force === true,
    now,
  });
}

export {
  COMPARISON_FINALISE_INITIAL_DELAY_SECONDS,
  COMPARISON_FINALISE_TIMEOUT_SECONDS,
  PUBLICATION_QUEUE_MAX_RETRIES,
  comparisonBatchBaseKey,
  comparisonBatchManifestKey,
  enqueueBootstrapComparisonRefresh,
  enqueueComparisonRefreshBatches,
  enqueueInternationalComparisonRefresh,
  finaliseComparisonBatches,
  hasComparisonBatchFragment,
};
