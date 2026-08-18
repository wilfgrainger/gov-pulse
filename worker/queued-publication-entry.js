import publicationWorker, {
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
  MAX_REQUESTS_PER_RUN as CONTRACT_MAX_REQUESTS_PER_RUN,
  refreshGovernmentContracts,
} from "./government-contracts-bootstrap.js";
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

const PUBLICATION_SECTION_PREFIX = "v12:publication:section:";
const PUBLICATION_HISTORY_TTL_SECONDS = 14 * 24 * 60 * 60;
const DEFAULT_SEED_URL = "https://public-data-org.pages.dev/data/metrics-snapshot.json";
const RUN_PREFIX = "v13:publication:run:";
const RUN_TTL_SECONDS = 14 * 24 * 60 * 60;
const FINALISE_DELAY_SECONDS = 20 * 60;
const FINALISE_RETRY_SECONDS = 5 * 60;
const BOOTSTRAP_DEADLINE_SECONDS = 12 * 60;
// Queue retries are intentionally bounded. Schedule the bootstrap finaliser
// at the run deadline so it cannot be discarded before the source jobs have
// had their full publication window.
const BOOTSTRAP_FINALISE_DELAY_SECONDS = BOOTSTRAP_DEADLINE_SECONDS;
const BOOTSTRAP_FINALISE_RETRY_SECONDS = 60;
const CONTRACT_REQUEST_GAP_MS = 10_500;
const DAILY_CRON = "17 3 * * *";
const BETTING_CRON = "47 */3 * * *";

const GENERIC_SECTIONS = Object.freeze([
  "gdpTracker",
  "sentimentPulse",
  "employmentStats",
  "taxRevenue",
  "nationalDebt",
  "migrationStats",
  "crimeStatistics",
]);
const EXTERNAL_SECTIONS = Object.freeze([
  "electionPolling",
  "nhsStats",
  "bettingOdds",
]);
const PUBLISHED_SECTIONS = Object.freeze([
  ...GENERIC_SECTIONS,
  ...EXTERNAL_SECTIONS,
]);
const REQUIRED_SECTION_SET = new Set(REQUIRED_PUBLISHED_SECTION_IDS);

const FREE_TIER_BUDGET = Object.freeze({
  cronInvocationsPerDay: 9,
  queueJobsPerDayMax: 28,
  queueOperationsPerDayMax: 84,
  officialSectionsPerDay: PUBLISHED_SECTIONS.length,
  contractRequestsPerDayMax: CONTRACT_MAX_REQUESTS_PER_RUN,
  kvWritesPerDayTargetMax: 120,
  kvReadsPerDayTargetMax: 300,
});

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

function createPacedFetch(fetchImpl = fetch, gapMs = CONTRACT_REQUEST_GAP_MS) {
  let previousStartedAt = 0;
  return async (input, init) => {
    const waitMs = Math.max(0, previousStartedAt + gapMs - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    previousStartedAt = Date.now();
    return fetchImpl(input, init);
  };
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
  currentCandidate.meta.publicationMode = "queue-free-tier";
  currentCandidate.meta.freeTierBudget = FREE_TIER_BUDGET;
  currentCandidate.meta.publicationState =
    missingRequired.length > 0 ? "degraded" : "ready";
  currentCandidate.meta.missingRequiredSections = missingRequired;

  const publication = preserveEditionClock(currentCandidate, current);
  const changed = !current || !samePublicationEvidence(publication, current);
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
    budget: FREE_TIER_BUDGET,
  };
  await kvPut(env, PUBLICATION_STATUS_KEY, status);
  return { publication, status, changed };
}

async function processQueueJob(job, env, ctx, options = {}) {
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
      fetchImpl: createPacedFetch(options.fetchImpl ?? fetch),
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
      completedAt: new Date().toISOString(),
      result,
    },
    { expirationTtl: RUN_TTL_SECONDS }
  );
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

const queuedPublicationWorker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/data/metrics-snapshot.json") {
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return publicationWorker.fetch(request, env, ctx);
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
          const result = await enqueuePublicationRun(
            env,
            new Date(),
            "bootstrap",
            {
              runId: bootstrapRunId(deploymentId),
              finaliseDelaySeconds: BOOTSTRAP_FINALISE_DELAY_SECONDS,
              deadlineSeconds: BOOTSTRAP_DEADLINE_SECONDS,
              finaliseRetrySeconds: BOOTSTRAP_FINALISE_RETRY_SECONDS,
            }
          );
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
            console.log("Cloudflare publication run finalised", {
              runId: result.run.runId,
              scope: result.run.scope,
              status: result.run.status,
            });
            message.ack();
          }
          continue;
        }

        const result = await processQueueJob(job, env, ctx);
        await recordTerminal(env, job, "success", result);
        console.log("Cloudflare data publication job completed", result);
        message.ack();
      } catch (error) {
        await recordTerminal(env, job, "failure", { errorCode: "job-failed" });
        console.error("Cloudflare data publication job failed", {
          job,
          error: error instanceof Error ? error.message : String(error),
        });
        message.retry({ delaySeconds: FINALISE_RETRY_SECONDS });
      }
    }
  },
};

export {
  BETTING_CRON,
  BOOTSTRAP_DEADLINE_SECONDS,
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  CONTRACT_REQUEST_GAP_MS,
  DAILY_CRON,
  EXTERNAL_SECTIONS,
  FINALISE_DELAY_SECONDS,
  FREE_TIER_BUDGET,
  GENERIC_SECTIONS,
  PUBLISHED_SECTIONS,
  PUBLICATION_SECTION_PREFIX,
  RUN_PREFIX,
  bootstrapRunId,
  createPacedFetch,
  createRun,
  enqueuePublicationRun,
  finaliseRun,
  jobsForDay,
  missingRequiredSections,
  processQueueJob,
  publicationFragments,
  publishFromCaches,
  refreshJobs,
  runIdFor,
  storeExternalSection,
  storeSectionFragment,
};
export default queuedPublicationWorker;
