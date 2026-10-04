import {
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_HISTORY_PREFIX,
  PUBLICATION_STATUS_KEY,
  isSnapshot,
  mergePublication,
  readCurrentPublication,
  refreshSectionPayload,
} from "./publication-entry.js";
import {
  CURRENT_RECORD_KEY as CONTRACT_CURRENT_RECORD_KEY,
  refreshGovernmentContracts,
} from "./government-contracts-cloudflare.js";
import { REQUIRED_PUBLISHED_SECTION_IDS } from "./feed-registry.js";
import { collectExternalSection } from "./live-feed-collectors.js";
import {
  currentSectionRecord,
  filterCurrentSnapshot,
} from "./publication-currentness.js";
import {
  PUBLIC_SNAPSHOT_KEY,
  buildPublicSnapshotArtifact,
} from "./public-snapshot.js";
import { samePublicationEvidence } from "../contracts/publication-evidence.js";
import { buildPublicationDiagnostics } from "../contracts/publication-diagnostics.js";
import { FEED_REGISTRY } from "./feed-registry.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";
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

const PUBLICATION_SECTION_PREFIX = "v12:publication:section:";
const PUBLICATION_HISTORY_TTL_SECONDS = 14 * 24 * 60 * 60;
const DEFAULT_SEED_URL = "https://public-data-org.pages.dev/data/metrics-snapshot.json";
const RUN_PREFIX = "v13:publication:run:";
const RUN_TTL_SECONDS = 14 * 24 * 60 * 60;
const PUBLICATION_QUEUE_MAX_RETRIES = 3;
const FINALISE_DELAY_SECONDS = 20 * 60;
const FINALISE_RETRY_SECONDS = 5 * 60;
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
// Keep the delayed finaliser for partial runs. Successful bootstrap jobs also
// enqueue an immediate finaliser once every required job has finished.
const BOOTSTRAP_FINALISE_DELAY_SECONDS = BOOTSTRAP_DEADLINE_SECONDS;
const BOOTSTRAP_FINALISE_RETRY_SECONDS = 60;
const DAILY_CRON = "17 3 * * *";
const BETTING_CRON = "47 */3 * * *";

const GENERIC_SECTIONS = Object.freeze([
  "gdpTracker",
  "sentimentPulse",
  "employmentStats",
  "taxRevenue",
  "nationalDebt",
  "migrationStats",
  "housePriceIndex",
  "realWages",
  "crimeStatistics",
]);
const EXTERNAL_SECTIONS = Object.freeze([
  "electionPolling",
  "nhsStats",
  "bettingOdds",
  "releaseCalendar",
  "nhsReleaseCalendar",
]);
const PUBLISHED_SECTIONS = Object.freeze([
  ...GENERIC_SECTIONS,
  ...EXTERNAL_SECTIONS,
]);
const REQUIRED_SECTION_SET = new Set(REQUIRED_PUBLISHED_SECTION_IDS);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function kvGet(env, key) {
  return env?.METRICS_CACHE?.get ? env.METRICS_CACHE.get(key, "json") : null;
}

async function kvPut(env, key, value, options) {
  if (!env?.METRICS_CACHE?.put) {
    throw new Error("METRICS_CACHE KV binding is required");
  }
  await env.METRICS_CACHE.put(key, JSON.stringify(value), options);
}

async function kvPutText(env, key, value, options) {
  if (!env?.METRICS_CACHE?.put) {
    throw new Error("METRICS_CACHE KV binding is required");
  }
  await env.METRICS_CACHE.put(key, value, options);
}

function runIdFor(now) {
  return now.toISOString().replaceAll(":", "-");
}

function bootstrapRunId(deploymentId) {
  const normalized = String(deploymentId ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error("Bootstrap deploymentId must be a full Git commit SHA");
  }
  return `bootstrap-${normalized}`;
}

function runKey(runId) {
  return `${RUN_PREFIX}${runId}`;
}

function terminalKey(runId, jobId) {
  return `${RUN_PREFIX}${runId}:terminal:${jobId}`;
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

function sectionRefreshJobs(runId, sections, type) {
  return sections.map((section) => ({
    type,
    section,
    runId,
    jobId: `${type === "refresh-section" ? "section" : "external"}:${section}`,
  }));
}

function refreshJobs(runId, scope = "daily") {
  if (scope === "betting") {
    return sectionRefreshJobs(runId, ["bettingOdds"], "refresh-external-section");
  }

  const genericSections =
    scope === "bootstrap"
      ? GENERIC_SECTIONS.filter((section) => REQUIRED_SECTION_SET.has(section))
      : GENERIC_SECTIONS;
  const externalSections =
    scope === "bootstrap"
      ? EXTERNAL_SECTIONS.filter((section) => REQUIRED_SECTION_SET.has(section))
      : EXTERNAL_SECTIONS;
  const jobs = [
    ...sectionRefreshJobs(runId, genericSections, "refresh-section"),
    ...sectionRefreshJobs(runId, externalSections, "refresh-external-section"),
  ];

  if (scope === "daily") {
    jobs.push({
      type: "refresh-contracts",
      runId,
      jobId: "contracts",
    });
  }
  return jobs;
}

function jobsForDay(runId = "manual") {
  return refreshJobs(runId, "daily").map((job) =>
    job.type === "refresh-contracts"
      ? { type: job.type }
      : { type: job.type, section: job.section }
  );
}

async function fetchSeedSnapshot(env, fetchImpl = fetch) {
  const url = String(env?.STATIC_SNAPSHOT_SEED_URL || DEFAULT_SEED_URL).trim();
  if (!url) return null;
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    assertSameHttpsHost(response, url, "Pages seed");
    const payload = await readResponseJson(response, { label: "Pages seed JSON" });
    return isSnapshot(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function storeSectionFragment(section, env, ctx) {
  if (!GENERIC_SECTIONS.includes(section)) {
    throw new Error(`Section '${section}' is outside the generic publication set`);
  }
  const record = await refreshSectionPayload(section, env, ctx);
  await kvPut(env, `${PUBLICATION_SECTION_PREFIX}${section}`, record);
  return record;
}

async function storeExternalSection(section, env, options = {}) {
  if (!EXTERNAL_SECTIONS.includes(section)) {
    throw new Error(`Section '${section}' is outside the external publication set`);
  }
  const record = await collectExternalSection(section, options);
  await kvPut(env, `${PUBLICATION_SECTION_PREFIX}${section}`, record);
  return record;
}

async function publicationFragments(env, now = new Date()) {
  const records = [];
  for (const section of PUBLISHED_SECTIONS) {
    const record = await kvGet(env, `${PUBLICATION_SECTION_PREFIX}${section}`);
    if (
      record?.section === section &&
      isRecord(record.data) &&
      currentSectionRecord(record, now)
    ) {
      records.push(record);
    }
  }
  return records;
}

function preserveEditionClock(candidate, current) {
  if (!current || !samePublicationEvidence(candidate, current)) return candidate;
  const preserved = structuredClone(candidate);
  preserved.meta.generatedAt = current.meta.generatedAt;
  preserved.meta.fetchedAt = current.meta.fetchedAt;
  return preserved;
}

function missingRequiredSections(snapshot) {
  return REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) =>
      !snapshot?.meta?.sources?.[section] ||
      !Object.prototype.hasOwnProperty.call(snapshot, section)
  );
}

async function publishFromCaches(env, options = {}) {
  const now = options.now ?? new Date();
  const current = await readCurrentPublication(env);
  const seed = current ?? (await fetchSeedSnapshot(env, options.fetchImpl ?? fetch));
  const fragments = await publicationFragments(env, now);
  const contractsRecord = await kvGet(env, CONTRACT_CURRENT_RECORD_KEY);
  const merged = mergePublication(seed, fragments, contractsRecord, now);
  const currentCandidate = filterCurrentSnapshot(merged, now);
  if (!currentCandidate || !isSnapshot(currentCandidate)) {
    throw new Error("Publication snapshot has no current source-owned evidence");
  }

  const missingRequired = missingRequiredSections(currentCandidate).sort();
  currentCandidate.meta.publicationState =
    missingRequired.length > 0 ? "degraded" : "ready";
  currentCandidate.meta.missingRequiredSections = missingRequired;

  const publication = preserveEditionClock(currentCandidate, current);
  const changed = !current || !samePublicationEvidence(publication, current);
  if (publication.meta.measureCatalog && publication.meta.editionSummary) {
    try {
      await archiveEdition(env, publication.meta.measureCatalog, publication.meta.editionSummary);
      publication.meta.editionArchiveStatus = "ready";
    } catch (error) {
      publication.meta.editionArchiveStatus = "unavailable";
      console.error("Publication edition archive failed", {
        editionId: publication.meta.measureCatalog.editionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    publication.meta.editionArchiveStatus = "unavailable";
  }
  publication.meta.delivery = "published-snapshot";
  publication.meta.publicationDiagnostics = buildPublicationDiagnostics(
    publication,
    Object.keys(FEED_REGISTRY),
  );
  const publicArtifact = buildPublicSnapshotArtifact(publication, now);

  await kvPut(env, PUBLICATION_CURRENT_KEY, publication);
  await kvPutText(env, PUBLIC_SNAPSHOT_KEY, publicArtifact.body, {
    metadata: publicArtifact.metadata,
  });
  if (changed) {
    await kvPut(
      env,
      `${PUBLICATION_HISTORY_PREFIX}${now.toISOString().replaceAll(":", "-")}`,
      publication,
      { expirationTtl: PUBLICATION_HISTORY_TTL_SECONDS }
    );
  }

  const status = {
    status:
      missingRequired.length > 0
        ? "degraded"
        : changed
          ? "published"
          : "no-change",
    generatedAt: publication.meta.generatedAt,
    includedSections: Object.keys(publication.meta.sources).sort(),
    ...(missingRequired.length > 0 ? { missingRequired } : {}),
  };
  await kvPut(env, PUBLICATION_STATUS_KEY, status);
  return { publication, status, changed };
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
      jobs: refreshJobs(runId, existing.scope ?? scope),
      existing: true,
    };
  }

  const jobs = refreshJobs(runId, scope);
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
          const result = await enqueuePublicationRun(
            env,
            new Date(),
            "bootstrap",
            {
              runId: bootstrapRunId(deploymentId),
              finaliseDelaySeconds: BOOTSTRAP_FINALISE_DELAY_SECONDS,
              deadlineSeconds: BOOTSTRAP_DEADLINE_SECONDS,
              finaliseRetrySeconds: BOOTSTRAP_FINALISE_RETRY_SECONDS,
              comparisonRefreshRequested: true,
              comparisonRefreshForce: forceComparison,
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
