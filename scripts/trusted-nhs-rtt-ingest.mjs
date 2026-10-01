// Trusted-egress NHS RTT ingest: runs on a GitHub Actions runner (a
// non-Cloudflare IP) because NHS England sits behind AWS WAF, which serves
// the Cloudflare Worker egress a JS/CAPTCHA bot-challenge page instead of the
// RTT page (diagnosed 2026-09-29: htmlLen~2KB, zero links,
// awsWafCookieDomainList / gokuProps — an IP-reputation block, not a
// User-Agent/header issue; see worker/feed-registry.js's nhsStats comment and
// the rejected header-only fix in PR #107). This script reuses the Worker's
// EXISTING discovery/collection/normalisation logic unchanged
// (collectNhsRttPublication) and only adds the Cloudflare KV write, which the
// Worker cannot do for itself because it cannot reach the source.
//
// The record this script builds and the KV key it writes under are an exact,
// deliberate match for worker/queued-publication-entry.js's own
// storeExternalSection(): the Worker's read path (publicationFragments ->
// mergePublication) consumes this record unchanged, with no awareness that it
// was written by a script instead of the Worker's own queue consumer.
import process from "node:process";
import { pathToFileURL } from "node:url";
import { collectNhsRttPublication } from "../worker/live-nhs-publication-collector.js";
import { sectionRecord } from "../worker/live-feed-common.js";
import { currentSectionRecord } from "../worker/publication-currentness.js";

const SECTION = "nhsStats";
const SOURCE_LABEL =
  "NHS England RTT press notice and overview time-series workbook";
const BACKEND = "cloudflare-official-publication";
// Mirrors worker/queued-publication-entry.js's PUBLICATION_SECTION_PREFIX +
// section. Keep these in sync by construction, not by convention: a drift
// here would silently write a key the Worker's read path never looks at.
const PUBLICATION_SECTION_PREFIX = "v12:publication:section:";
const KV_KEY = `${PUBLICATION_SECTION_PREFIX}${SECTION}`;

function required(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

/**
 * Build the exact KV record the Worker's own collector would have written.
 * Pure function: no network, no KV — this is what the unit test exercises.
 */
function buildKvRecord(data, now) {
  const record = sectionRecord(SECTION, data, now, SOURCE_LABEL, BACKEND);
  if (!currentSectionRecord(record, now)) {
    throw new Error(
      "NHS RTT publication is outside its currentness window immediately after collection; refusing to write stale evidence"
    );
  }
  return record;
}

async function readKvValue(fetchImpl, accountId, apiToken, namespaceId, key) {
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
  if (!response.ok) {
    throw new Error(
      `Cloudflare KV read for '${key}' failed: ${response.status} ${response.statusText}`
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`Cloudflare KV read for '${key}' did not return JSON`);
  }
}

async function putKvValue(fetchImpl, accountId, apiToken, namespaceId, key, value) {
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      message =
        payload?.errors?.map((error) => error?.message).filter(Boolean).join("; ") ||
        message;
    } catch {
      // Status text remains sufficient.
    }
    throw new Error(`Cloudflare KV write for '${key}' failed: ${message}`);
  }
}

async function run(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const accountId = required(options.accountId, "CLOUDFLARE_ACCOUNT_ID");
  const apiToken = required(options.apiToken, "CLOUDFLARE_API_TOKEN");
  const namespaceId = required(options.namespaceId, "CLOUDFLARE_KV_NAMESPACE_ID");

  // Fail loudly on fetch/parse failure rather than writing bad data: any
  // throw here (NHS WAF challenge, workbook/PDF shape mismatch, reconciliation
  // failure in normalizeNhsRttPayload) propagates out of run() unhandled, main()
  // exits non-zero, and nothing is written to KV — the previous value is
  // untouched.
  const data = await collectNhsRttPublication(fetchImpl, now);
  const record = buildKvRecord(data, now);

  if (options.dryRun) {
    return { record, written: false };
  }

  await putKvValue(fetchImpl, accountId, apiToken, namespaceId, KV_KEY, record);
  // Best-effort read-back verification; a failure here still leaves the
  // write committed (Cloudflare KV writes are not transactional with this
  // script), but it turns a silent corruption into a loud CI failure instead
  // of a quiet bad publish.
  const confirmed = await readKvValue(
    fetchImpl,
    accountId,
    apiToken,
    namespaceId,
    KV_KEY
  );
  if (confirmed?.fetchedAt !== record.fetchedAt) {
    throw new Error(
      "Cloudflare KV read-back after write did not match the record just written"
    );
  }

  return { record, written: true };
}

async function main() {
  const result = await run({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID,
  });
  console.log(
    `NHS RTT ingest wrote '${KV_KEY}' for period ${result.record.data.headline.period} ` +
      `(fetchedAt ${result.record.fetchedAt}).`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { KV_KEY, PUBLICATION_SECTION_PREFIX, buildKvRecord, run };
