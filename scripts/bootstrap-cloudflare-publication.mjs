import { createHash } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { currentPublicationManifest } from "./publication-manifest.mjs";

const DEFAULT_QUEUE_NAME = "public-data-jobs";
const DEFAULT_HEALTH_URL = "https://public-data.org/data/health.json";
const DEFAULT_TIMEOUT_MS = 12 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_RECOVERY_INTERVAL_MS = 4 * 60 * 1000;
const DEFAULT_KV_NAMESPACE_ID = "f950b17f36a447dca7bb339cba8818de";
const BOOTSTRAP_SECTIONS = Object.freeze([
  "gdpTracker",
  "sentimentPulse",
  "employmentStats",
  "taxRevenue",
  "nationalDebt",
  "migrationStats",
  "electionPolling",
  "nhsStats",
]);

function required(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return number;
}

function bootstrapAttemptId(deploymentId, attempt) {
  const normalized = required(deploymentId, "GITHUB_SHA").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error("GITHUB_SHA must be a full Git commit SHA");
  }
  if (!Number.isSafeInteger(attempt) || attempt < 0) {
    throw new Error("bootstrap attempt must be a non-negative integer");
  }
  if (attempt === 0) return normalized;
  return createHash("sha256")
    .update(`${normalized}:bootstrap-recovery:${attempt}`)
    .digest("hex")
    .slice(0, 40);
}

async function responseJson(response, label) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // The status and label remain sufficient for a safe diagnostic.
  }
  if (!response.ok) {
    const message =
      payload?.errors?.map((error) => error?.message).filter(Boolean).join("; ") ||
      payload?.error ||
      `${response.status} ${response.statusText}`;
    throw new Error(`${label} failed: ${message}`);
  }
  return payload;
}

async function readHealth(fetchImpl, healthUrl) {
  const response = await fetchImpl(healthUrl, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(15_000),
  });
  return responseJson(response, "Cloudflare data health check");
}

async function hasPreparedPublication(fetchImpl, healthUrl, health) {
  const snapshotUrl = new URL(
    "/data/metrics-snapshot.json",
    healthUrl,
  ).toString();
  try {
    const response = await fetchImpl(snapshotUrl, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (
      !response.ok ||
      response.headers.get("X-Publication-Delivery") !== "cloudflare-kv"
    ) {
      return false;
    }
    const snapshot = await response.json();
    const meta = snapshot?.meta;
    const sources = meta?.sources;
    if (
      !sources || typeof sources !== "object" || Array.isArray(sources) ||
      Object.prototype.hasOwnProperty.call(meta, "publicationDiagnostics") ||
      Object.prototype.hasOwnProperty.call(meta, "measureCatalogDiagnostics") ||
      Object.values(sources).some((source) =>
        source && typeof source === "object" &&
          Object.prototype.hasOwnProperty.call(source, "error")
      )
    ) {
      return false;
    }
    const expectedMissing = isDegradedPublicationHealth(health)
      ? [...health.missingRequiredSections].sort()
      : [];
    const { missingRequiredSections: currentMissing } =
      currentPublicationManifest(snapshot);
    const actualMissing = Array.isArray(meta.missingRequiredSections)
      ? [...meta.missingRequiredSections].sort()
      : null;
    return (
      meta.delivery === "published-snapshot" &&
      JSON.stringify(currentMissing) === JSON.stringify(expectedMissing) &&
      JSON.stringify(actualMissing) === JSON.stringify(expectedMissing) &&
      meta.publicationState === (expectedMissing.length ? "degraded" : "ready")
    );
  } catch {
    return false;
  }
}

function isDegradedPublicationHealth(health) {
  return (
    health?.status === "degraded" &&
    health?.ready === false &&
    health?.degraded === true &&
    Array.isArray(health?.missingRequiredSections) &&
    health.missingRequiredSections.length > 0
  );
}

async function deploymentPublicationAvailable(fetchImpl, healthUrl, health) {
  if (health?.ready !== true && !isDegradedPublicationHealth(health)) {
    return false;
  }
  return hasPreparedPublication(fetchImpl, healthUrl, health);
}

async function findQueueId(fetchImpl, accountId, apiToken, queueName) {
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/queues?per_page=100`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      signal: AbortSignal.timeout(15_000),
    }
  );
  const payload = await responseJson(response, "Cloudflare Queue lookup");
  const queue = payload?.result?.find((candidate) => candidate?.queue_name === queueName);
  if (!queue?.queue_id) {
    throw new Error(`Cloudflare Queue '${queueName}' was not found after reconciliation`);
  }
  return queue.queue_id;
}

async function readKvValue(
  fetchImpl,
  accountId,
  apiToken,
  namespaceId,
  key
) {
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (response.status === 404) return null;
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function publicationDiagnostics(
  fetchImpl,
  accountId,
  apiToken,
  namespaceId,
  deploymentId
) {
  const runId = `bootstrap-${deploymentId.toLowerCase()}`;
  const prefix = `v13:publication:run:${runId}`;
  const run = await readKvValue(
    fetchImpl,
    accountId,
    apiToken,
    namespaceId,
    prefix
  );
  const terminals = {};
  for (const section of BOOTSTRAP_SECTIONS) {
    const type = [
      "electionPolling",
      "nhsStats",
    ].includes(section)
      ? "external"
      : "section";
    const jobId = `${type}:${section}`;
    terminals[jobId] = await readKvValue(
      fetchImpl,
      accountId,
      apiToken,
      namespaceId,
      `${prefix}:terminal:${jobId}`
    );
  }
  return {
    run: run
      ? {
          status: run.status ?? null,
          dispatchedAt: run.dispatchedAt ?? null,
          finalisedAt: run.finalisedAt ?? null,
          successfulJobIds: run.successfulJobIds ?? [],
          failedJobIds: run.failedJobIds ?? [],
          missingJobIds: run.missingJobIds ?? [],
          finalisationFailure: run.finalisationFailure ?? null,
        }
      : null,
    terminals: Object.fromEntries(
      Object.entries(terminals).map(([jobId, terminal]) => [
        jobId,
        terminal
          ? {
              status: terminal.status ?? null,
              completedAt: terminal.completedAt ?? null,
            }
          : null,
      ])
    ),
  };
}

async function pushBootstrapMessage(
  fetchImpl,
  accountId,
  apiToken,
  queueId,
  deploymentId,
  forceComparison = false
) {
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/${queueId}/messages`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: {
          type: "bootstrap-publication",
          deploymentId,
          ...(forceComparison ? { forceComparison: true } : {}),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  await responseJson(response, "Cloudflare publication bootstrap");
}

async function waitForReady(options) {
  const {
    fetchImpl,
    healthUrl,
    timeoutMs,
    pollIntervalMs,
    sleepImpl,
    nowImpl,
  } = options;
  const deadline = nowImpl() + timeoutMs;
  let lastHealth = null;

  while (nowImpl() < deadline) {
    lastHealth = await readHealth(fetchImpl, healthUrl);
    if (lastHealth?.ready === true) return lastHealth;
    // A publication that is stably degraded (ready:false with a non-empty
    // missingRequiredSections list) is an ACCEPTED terminal state, not a
    // transient one: an optional/unavailable feed must not make the deploy hang
    // until timeout. The fail-closed contract still withholds the missing
    // section from the public payload; the deploy simply proceeds.
    if (isDegradedPublicationHealth(lastHealth)) return lastHealth;
    await sleepImpl(pollIntervalMs);
  }

  throw new Error(
    `Cloudflare publication did not become ready within ${Math.ceil(timeoutMs / 1000)} seconds; last status=${JSON.stringify(lastHealth)}`
  );
}

async function bootstrapCloudflarePublication(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl =
    options.sleepImpl ??
    ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const nowImpl = options.nowImpl ?? Date.now;
  const accountId = required(options.accountId, "CLOUDFLARE_ACCOUNT_ID");
  const apiToken = required(options.apiToken, "CLOUDFLARE_API_TOKEN");
  const deploymentId = bootstrapAttemptId(options.deploymentId, 0);
  const queueName = required(
    options.queueName ?? DEFAULT_QUEUE_NAME,
    "QUEUE_NAME"
  );
  const namespaceId = required(
    options.namespaceId ?? DEFAULT_KV_NAMESPACE_ID,
    "CLOUDFLARE_KV_NAMESPACE_ID"
  );
  const healthUrl = required(
    options.healthUrl ?? DEFAULT_HEALTH_URL,
    "HEALTH_URL"
  );
  const timeoutMs = positiveInteger(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    "BOOTSTRAP_TIMEOUT_MS"
  );
  const pollIntervalMs = positiveInteger(
    options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    "pollIntervalMs"
  );
  const recoveryIntervalMs = positiveInteger(
    options.recoveryIntervalMs ?? DEFAULT_RECOVERY_INTERVAL_MS,
    "BOOTSTRAP_RECOVERY_INTERVAL_MS"
  );
  const forceRefresh = options.forceRefresh === true;
  const forceComparison = options.forceComparison === true;

  const initialHealth = await readHealth(fetchImpl, healthUrl);
  if (!forceRefresh && await deploymentPublicationAvailable(fetchImpl, healthUrl, initialHealth)) {
    return { triggered: false, attempts: 0, health: initialHealth };
  }

  const queueId = await findQueueId(
    fetchImpl,
    accountId,
    apiToken,
    queueName
  );
  const deadline = nowImpl() + timeoutMs;
  let attempt = 0;
  let latestAttemptId = null;
  let latestRunActive = false;
  let nextAttemptAt = nowImpl();
  let lastHealth = initialHealth;
  const dispatchAttempt = async () => {
    const attemptId = bootstrapAttemptId(deploymentId, attempt);
    await pushBootstrapMessage(
      fetchImpl,
      accountId,
      apiToken,
      queueId,
      attemptId,
      forceComparison
    );
    latestAttemptId = attemptId;
    latestRunActive = true;
    attempt += 1;
    nextAttemptAt = nowImpl() + recoveryIntervalMs;
  };

  while (nowImpl() < deadline) {
    if (forceRefresh && latestAttemptId) {
      const run = await readKvValue(
        fetchImpl,
        accountId,
        apiToken,
        namespaceId,
        `v13:publication:run:bootstrap-${latestAttemptId}`
      );
      latestRunActive = Boolean(run && !run.finalisedAt);
      // A previously serveable edition cannot prove that this deployment's
      // collectors ran. Forced refresh requires the active run to finalise.
      if (run?.finalisedAt && ["published", "no-change", "incomplete"].includes(run.status)) {
        lastHealth = await readHealth(fetchImpl, healthUrl);
        if (lastHealth?.ready === true && await hasPreparedPublication(fetchImpl, healthUrl, lastHealth)) {
          return { triggered: true, attempts: attempt, health: lastHealth };
        }
        // A STABLE degraded publication (ready:false + non-empty
        // missingRequiredSections) is an accepted terminal state once the
        // active run finalised and its prepared artifact is readable.
        if (
          isDegradedPublicationHealth(lastHealth) &&
          (await hasPreparedPublication(fetchImpl, healthUrl, lastHealth))
        ) {
          return { triggered: true, attempts: attempt, health: lastHealth };
        }
      }
    }

    // For an ordinary deployment retain the original fast path: dispatch the
    // initial attempt, then inspect health. A forced recovery starts another
    // run only after the current run has finalised or its KV record is absent.
    if (!forceRefresh && nowImpl() >= nextAttemptAt) {
      await dispatchAttempt();
    }

    if (!forceRefresh) {
      lastHealth = await readHealth(fetchImpl, healthUrl);
      if (lastHealth?.ready === true) {
        return { triggered: true, attempts: attempt, health: lastHealth };
      }
      // A STABLE degraded publication (ready:false + non-empty
      // missingRequiredSections) is an accepted terminal state, not a transient
      // one: an optional/unavailable feed must not make the deploy poll until
      // timeout. Under forceRefresh we additionally require the enclosing
      // guarantee that THIS deployment's run finalised, plus a prepared
      // publication — the same proof the ready-path uses — so we never accept a
      // stale prior edition. The fail-closed contract still withholds the
      // missing section from the public payload.
      if (
        isDegradedPublicationHealth(lastHealth) &&
        (await hasPreparedPublication(fetchImpl, healthUrl, lastHealth))
      ) {
        return { triggered: true, attempts: attempt, health: lastHealth };
      }
    }

    if (forceRefresh && nowImpl() >= nextAttemptAt && !latestRunActive) {
      await dispatchAttempt();
    }

    const remainingMs = deadline - nowImpl();
    if (remainingMs <= 0) break;
    await sleepImpl(Math.min(pollIntervalMs, remainingMs));
  }

  try {
    console.error(
      "Cloudflare publication bootstrap diagnostics",
      await publicationDiagnostics(
        fetchImpl,
        accountId,
        apiToken,
        namespaceId,
        deploymentId
      )
    );
  } catch (error) {
    console.error(
      "Cloudflare publication bootstrap diagnostics unavailable",
      error instanceof Error ? error.message : String(error)
    );
  }

  throw new Error(
    `Cloudflare publication did not become ready or publish a verified degraded edition within ${Math.ceil(timeoutMs / 1000)} seconds after ${attempt} bootstrap attempt${attempt === 1 ? "" : "s"}; last status=${JSON.stringify(lastHealth)}`
  );
}

async function main() {
  const result = await bootstrapCloudflarePublication({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    deploymentId: process.env.GITHUB_SHA,
    queueName: process.env.QUEUE_NAME,
    healthUrl: process.env.HEALTH_URL,
    namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID,
    timeoutMs: process.env.BOOTSTRAP_TIMEOUT_MS,
    recoveryIntervalMs: process.env.BOOTSTRAP_RECOVERY_INTERVAL_MS,
    forceRefresh: process.env.FORCE_PUBLICATION_REFRESH === "true",
    forceComparison: process.env.FORCE_COMPARISON_REFRESH === "true",
  });
  console.log(
    result.triggered
      ? `Cloudflare publication bootstrap completed after ${result.attempts} attempt${result.attempts === 1 ? "" : "s"}.`
      : "Cloudflare prepared publication was already deployable; bootstrap skipped."
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export {
  DEFAULT_HEALTH_URL,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_QUEUE_NAME,
  DEFAULT_RECOVERY_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  bootstrapAttemptId,
  bootstrapCloudflarePublication,
  deploymentPublicationAvailable,
  findQueueId,
  publicationDiagnostics,
  readKvValue,
  positiveInteger,
  pushBootstrapMessage,
  readHealth,
  hasPreparedPublication,
  isDegradedPublicationHealth,
  waitForReady,
};
