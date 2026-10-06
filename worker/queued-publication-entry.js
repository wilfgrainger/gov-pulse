import {
  PUBLICATION_CURRENT_KEY,
  readCurrentPublication,
} from "./publication-entry.js";
import {
  CURRENT_RECORD_KEY as CONTRACT_CURRENT_RECORD_KEY,
  refreshGovernmentContracts,
} from "./government-contracts-cloudflare.js";
import { REQUIRED_PUBLISHED_SECTION_IDS } from "./feed-registry.js";
import { filterCurrentSnapshot } from "./publication-currentness.js";
import { PUBLIC_SNAPSHOT_KEY } from "./public-snapshot.js";
import {
  INTERNATIONAL_COMPARISON_KEY,
  INTERNATIONAL_COMPARISON_REFRESH_BATCHES,
  INTERNATIONAL_SOURCES,
  due as comparisonRefreshDue,
  buildInternationalComparisonPublication,
  comparisonSourceBundle,
  mergeInternationalComparisonBatchResults,
  readInternationalComparison,
  refreshInternationalComparison,
  sourcesDue as comparisonSourcesDue,
} from "./international-comparison-publication.js";
import { archiveEdition } from "./edition-archive.js";
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
import { fetchPublicationSeedSnapshot } from "./publication-recovery.js";
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

const PUBLICATION_QUEUE_MAX_RETRIES = 3;
const COMPARISON_FINALISE_INITIAL_DELAY_SECONDS = 60;
const COMPARISON_FINALISE_TIMEOUT_SECONDS =
  (PUBLICATION_QUEUE_MAX_RETRIES + 2) * FINALISE_RETRY_SECONDS;
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
      // The orchestration made the due decision once. Keep every later batch
      // eligible after the first batch updates the global checkedAt clock.
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
