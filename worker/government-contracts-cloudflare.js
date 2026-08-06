import {
  CAVEATS,
  EVIDENCE_POLICY,
  FIND_A_TENDER_API,
  FIND_A_TENDER_DOCUMENTATION,
  OPEN_GOVERNMENT_LICENCE,
  REQUIRED_AWARD_COUNT,
  buildGovernmentContractsPayload,
  buildSummary,
} from "../contracts/government-contracts.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHARD_PREFIX = "v12:contracts:day:";
const CURRENT_RECORD_KEY = "v12:section:governmentContracts";
const SHARD_TTL_SECONDS = 10 * 24 * 60 * 60;
const MAX_DAYS_PER_RUN = 3;
const SLICES_PER_DAY = 4;
const PAGE_LIMIT = 100;
const MAX_REQUESTS_PER_RUN = MAX_DAYS_PER_RUN * SLICES_PER_DAY;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "public-data.org-cloudflare-contracts/1.0";

function utcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid UTC day");
  return date.toISOString().slice(0, 10);
}

function previousCompleteDays(now = new Date(), count = 7) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: count }, (_, index) =>
    utcDay(new Date(midnight - (count - index) * DAY_MS))
  );
}

function daySlices(day) {
  const start = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(start)) throw new Error(`Invalid contract shard day '${day}'`);
  return Array.from({ length: SLICES_PER_DAY }, (_, index) => {
    const from = start + index * 6 * 60 * 60 * 1000;
    const to = from + 6 * 60 * 60 * 1000 - 1_000;
    return {
      updatedFrom: new Date(from).toISOString().slice(0, 19),
      updatedTo: new Date(to).toISOString().slice(0, 19),
    };
  });
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteAmount(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function supplierNames(award) {
  return Array.isArray(award?.suppliers)
    ? [...new Set(award.suppliers.map((supplier) => text(supplier?.name)).filter(Boolean))]
    : [];
}

function isFramework(release) {
  return Boolean(
    release?.tender?.techniques?.hasFrameworkAgreement === true ||
      release?.tender?.techniques?.frameworkAgreement ||
      release?.tender?.framework?.isAFramework === true
  );
}

function extractComparableAwards(release, counters) {
  const awards = Array.isArray(release?.awards) ? release.awards : [];
  counters.awardsSeen += awards.length;
  const result = [];

  for (const award of awards) {
    const amount = finiteAmount(award?.value?.amount);
    const currency = text(award?.value?.currency).toUpperCase();
    const buyer = text(release?.buyer?.name);
    const suppliers = supplierNames(award);
    if (amount === null) {
      counters.excludedMissingValue += 1;
      continue;
    }
    if (currency !== "GBP") {
      counters.excludedNonGbp += 1;
      continue;
    }
    if (!buyer) {
      counters.excludedMissingBuyer += 1;
      continue;
    }
    if (suppliers.length === 0) {
      counters.excludedMissingSupplier += 1;
      continue;
    }

    const ocid = text(release?.ocid);
    const releaseId = text(release?.id);
    const awardId = text(award?.id);
    const title = text(award?.title) || text(release?.tender?.title) || text(release?.title);
    const awardDate = text(award?.date) || text(release?.date);
    const publishedAt = text(release?.date);
    if (
      !/^ocds-h6vhtk-[0-9a-f]+$/i.test(ocid) ||
      !/^\d{6}-\d{4}$/.test(releaseId) ||
      !awardId ||
      !title ||
      !Number.isFinite(Date.parse(awardDate)) ||
      !Number.isFinite(Date.parse(publishedAt))
    ) {
      counters.excludedMalformed += 1;
      continue;
    }

    result.push({
      rank: 0,
      key: `${ocid}:${awardId}`,
      ocid,
      releaseId,
      awardId,
      title,
      buyer,
      suppliers,
      awardDate: new Date(awardDate).toISOString(),
      publishedAt: new Date(publishedAt).toISOString(),
      amount,
      currency: "GBP",
      procurementMethod: text(release?.tender?.procurementMethod) || null,
      procurementMethodDetails: text(release?.tender?.procurementMethodDetails) || null,
      mainProcurementCategory: text(release?.tender?.mainProcurementCategory) || null,
      framework: isFramework(release),
      noticeUrl: `https://www.find-tender.service.gov.uk/Notice/${releaseId}`,
      procurementUrl: `https://www.find-tender.service.gov.uk/procurement/${ocid}`,
    });
  }

  return result;
}

function initialUrl(slice) {
  const url = new URL(FIND_A_TENDER_API);
  url.searchParams.set("updatedFrom", slice.updatedFrom);
  url.searchParams.set("updatedTo", slice.updatedTo);
  url.searchParams.set("stages", "award");
  url.searchParams.set("limit", String(PAGE_LIMIT));
  return url.toString();
}

async function fetchSlice(slice, fetchImpl = fetch) {
  const response = await fetchImpl(initialUrl(slice), {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Find a Tender returned ${response.status}`);
  assertSameHttpsHost(response, FIND_A_TENDER_API, "Find a Tender");
  const payload = await readResponseJson(response, { label: "Find a Tender JSON" });
  if (
    payload?.publisher?.name !== "Cabinet Office" ||
    !String(payload?.version ?? "").startsWith("1.1") ||
    !Array.isArray(payload?.releases)
  ) {
    throw new Error("Find a Tender returned an unexpected OCDS release package");
  }

  const hasNext = Boolean(
    payload?.links?.next ||
      payload?.pagination?.next ||
      payload?.pagination?.nextCursor ||
      payload?.next ||
      payload?.nextPage ||
      response.headers.get("link")
  );
  if (hasNext || payload.releases.length >= PAGE_LIMIT) {
    throw new Error("Find a Tender slice exceeded the one-page free-tier completeness bound");
  }
  return payload.releases;
}

function rankDailyAwards(releases, day, collectedAt = new Date()) {
  const counters = {
    pagesFetched: SLICES_PER_DAY,
    requestsMade: SLICES_PER_DAY,
    releasesSeen: releases.length,
    awardsSeen: 0,
    validComparableAwards: 0,
    excludedMissingValue: 0,
    excludedNonGbp: 0,
    excludedMissingBuyer: 0,
    excludedMissingSupplier: 0,
    excludedMalformed: 0,
    duplicatesRemoved: 0,
  };
  const byKey = new Map();
  for (const release of releases) {
    for (const award of extractComparableAwards(release, counters)) {
      const existing = byKey.get(award.key);
      if (!existing || Date.parse(award.publishedAt) > Date.parse(existing.publishedAt)) {
        if (existing) counters.duplicatesRemoved += 1;
        byKey.set(award.key, award);
      } else {
        counters.duplicatesRemoved += 1;
      }
    }
  }
  const awards = [...byKey.values()]
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        Date.parse(right.awardDate) - Date.parse(left.awardDate) ||
        left.key.localeCompare(right.key, "en-GB")
    )
    .slice(0, REQUIRED_AWARD_COUNT);
  counters.validComparableAwards = byKey.size;
  return {
    schemaVersion: 1,
    day,
    complete: true,
    collectedAt: collectedAt.toISOString(),
    awards,
    dataQuality: counters,
  };
}

async function readJson(env, key) {
  return env?.METRICS_CACHE?.get ? env.METRICS_CACHE.get(key, "json") : null;
}

async function writeJson(env, key, value, expirationTtl) {
  if (!env?.METRICS_CACHE?.put) throw new Error("METRICS_CACHE KV binding is required");
  const options = expirationTtl ? { expirationTtl } : undefined;
  await env.METRICS_CACHE.put(key, JSON.stringify(value), options);
}

async function collectDayShard(day, env, fetchImpl = fetch, now = new Date()) {
  const releases = [];
  for (const slice of daySlices(day)) {
    releases.push(...(await fetchSlice(slice, fetchImpl)));
  }
  const shard = rankDailyAwards(releases, day, now);
  await writeJson(env, `${SHARD_PREFIX}${day}`, shard, SHARD_TTL_SECONDS);
  return shard;
}

function combineQuality(shards, duplicatesRemoved) {
  const fields = [
    "pagesFetched",
    "requestsMade",
    "releasesSeen",
    "awardsSeen",
    "excludedMissingValue",
    "excludedNonGbp",
    "excludedMissingBuyer",
    "excludedMissingSupplier",
    "excludedMalformed",
  ];
  const result = Object.fromEntries(fields.map((field) => [field, 0]));
  for (const shard of shards) {
    for (const field of fields) result[field] += shard.dataQuality?.[field] ?? 0;
  }
  result.duplicatesRemoved =
    shards.reduce((sum, shard) => sum + (shard.dataQuality?.duplicatesRemoved ?? 0), 0) +
    duplicatesRemoved;
  return result;
}

function buildContractsFromShards(shards, now = new Date()) {
  if (!Array.isArray(shards) || shards.length !== 7 || shards.some((shard) => !shard?.complete)) {
    return null;
  }
  const days = shards.map((shard) => shard.day).sort();
  const expected = previousCompleteDays(now, 7);
  if (JSON.stringify(days) !== JSON.stringify(expected)) return null;

  const byKey = new Map();
  let duplicatesRemoved = 0;
  for (const shard of shards) {
    for (const award of shard.awards ?? []) {
      const existing = byKey.get(award.key);
      if (!existing || Date.parse(award.publishedAt) > Date.parse(existing.publishedAt)) {
        if (existing) duplicatesRemoved += 1;
        byKey.set(award.key, award);
      } else {
        duplicatesRemoved += 1;
      }
    }
  }
  const comparable = [...byKey.values()].sort(
    (left, right) =>
      right.amount - left.amount ||
      Date.parse(right.awardDate) - Date.parse(left.awardDate) ||
      left.key.localeCompare(right.key, "en-GB")
  );
  if (comparable.length < REQUIRED_AWARD_COUNT) return null;
  const awards = comparable.slice(0, REQUIRED_AWARD_COUNT).map((award, index) => ({
    ...award,
    rank: index + 1,
  }));
  const from = `${days[0]}T00:00:00.000Z`;
  const to = `${days.at(-1)}T23:59:59.999Z`;
  const quality = combineQuality(shards, duplicatesRemoved);
  quality.validComparableAwards = comparable.length;

  return buildGovernmentContractsPayload(
    {
      available: true,
      generatedAt: now.toISOString(),
      window: {
        updatedFrom: from,
        updatedTo: to,
        label: `${days[0]} to ${days.at(-1)}`,
        basis:
          "Find a Tender award-stage releases from seven complete UTC day shards collected by the Cloudflare Free data worker",
      },
      source: {
        publisher: "Cabinet Office",
        service: "Find a Tender",
        apiUrl: FIND_A_TENDER_API,
        documentationUrl: FIND_A_TENDER_DOCUMENTATION,
        licenceUrl: OPEN_GOVERNMENT_LICENCE,
        standard: "OCDS 1.1",
      },
      summary: buildSummary(awards),
      awards,
      dataQuality: quality,
      caveats: [...CAVEATS],
      evidencePolicy: { ...EVIDENCE_POLICY },
    },
    now
  );
}

async function refreshGovernmentContracts(env, options = {}) {
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const days = previousCompleteDays(now, 7);
  const shards = [];
  const missing = [];
  for (const day of days) {
    const shard = await readJson(env, `${SHARD_PREFIX}${day}`);
    if (shard?.complete && shard.day === day) shards.push(shard);
    else missing.push(day);
  }

  let requestsMade = 0;
  const collected = [];
  for (const day of missing.slice(0, MAX_DAYS_PER_RUN)) {
    const shard = await collectDayShard(day, env, fetchImpl, now);
    requestsMade += SLICES_PER_DAY;
    collected.push(day);
    shards.push(shard);
  }
  if (requestsMade > MAX_REQUESTS_PER_RUN) {
    throw new Error("Government contracts collector exceeded its free-tier request budget");
  }

  const byDay = new Map(shards.map((shard) => [shard.day, shard]));
  const ordered = days.map((day) => byDay.get(day)).filter(Boolean);
  const data = buildContractsFromShards(ordered, now);
  if (!data) {
    return {
      updated: false,
      collected,
      completeDays: ordered.length,
      requestsMade,
      record: await readJson(env, CURRENT_RECORD_KEY),
    };
  }

  const record = {
    section: "governmentContracts",
    data,
    fetchedAt: now.toISOString(),
    sourceLabel: "Cabinet Office Find a Tender OCDS award releases",
    backend: "cloudflare-free-daily-shards",
  };
  await writeJson(env, CURRENT_RECORD_KEY, record);
  return { updated: true, collected, completeDays: 7, requestsMade, record };
}

export {
  CURRENT_RECORD_KEY,
  MAX_DAYS_PER_RUN,
  MAX_REQUESTS_PER_RUN,
  SHARD_PREFIX,
  buildContractsFromShards,
  collectDayShard,
  daySlices,
  previousCompleteDays,
  rankDailyAwards,
  refreshGovernmentContracts,
};
