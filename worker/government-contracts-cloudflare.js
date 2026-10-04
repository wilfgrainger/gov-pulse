import {
  CAVEATS,
  EVIDENCE_POLICY,
  FIND_A_TENDER_API,
  FIND_A_TENDER_DOCUMENTATION,
  FIND_A_TENDER_USER_AGENT,
  OPEN_GOVERNMENT_LICENCE,
  DISPLAYED_AWARD_LIMIT,
  buildGovernmentContractsPayload,
  buildSummary,
  ukNationFromCountryName,
  ukNationFromPostcode,
} from "../contracts/government-contracts.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHARD_PREFIX = "v12:contracts:day:";
const CURRENT_RECORD_KEY = "v12:section:governmentContracts";
const CONTRACT_SHARD_SCHEMA_VERSION = 2;
const SHARD_TTL_SECONDS = 10 * 24 * 60 * 60;
const SLICES_PER_DAY = 4;
const PAGE_LIMIT = 100;
const MAX_PAGES_PER_SLICE = 8;
const MAX_PAGES_PER_REFRESH = 64;
const MAX_RELEASES_PER_SLICE = MAX_PAGES_PER_SLICE * PAGE_LIMIT;
const MAX_RELEASES_PER_REFRESH = MAX_PAGES_PER_REFRESH * PAGE_LIMIT;
const MAX_CONTRACT_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_RETRIEVAL_DURATION_MS = 4 * 60 * 1000;
// Workers KV documents a 25 MiB maximum value. Measure the encoded JSON
// before writing so valid records are retained up to the actual store limit.
const MAX_SHARD_BYTES = 25 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

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

function supplierReferences(award) {
  const seen = new Set();
  const references = [];
  for (const supplier of Array.isArray(award?.suppliers) ? award.suppliers : []) {
    const name = text(supplier?.name);
    if (!name) continue;
    const id = text(supplier?.id) || null;
    const identity = id ? `publisher-id:${id}` : `exact-name:${name.toLocaleLowerCase("en-GB")}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    references.push({ id, name });
  }
  return references;
}

function supplierNames(award) {
  return supplierReferences(award).map((supplier) => supplier.name);
}

function supplierIds(award) {
  return supplierReferences(award).map((supplier) => supplier.id);
}

// OCDS 1.1 moves organization details (including address) out of embedded
// objects into a top-level `parties` array, cross-referenced by `id` from
// an OrganizationReference such as `award.suppliers[]`. This builds an
// id -> explicit country-name lookup from `release.parties`. Postcode areas
// do not reliably follow national borders and cannot resolve England vs
// Jersey/Guernsey; a country name is used only when OCDS supplies an exact
// UK nation label.
function partyCountryById(release) {
  const parties = Array.isArray(release?.parties) ? release.parties : [];
  const byId = new Map();
  for (const party of parties) {
    const id = text(party?.id);
    const countryName = text(party?.address?.countryName);
    if (id) byId.set(id, countryName);
  }
  return byId;
}

// Resolves each award supplier from an exact nation value on its linked
// party. Missing, broad-country, and non-UK labels stay Other/Unknown.
function supplierNationsFor(award, countryById) {
  return supplierReferences(award).map((supplier) => {
    const countryName = supplier.id ? countryById.get(supplier.id) : "";
    return ukNationFromCountryName(countryName) ?? ukNationFromPostcode("");
  });
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
    if (text(award?.status).toLowerCase() === "cancelled") {
      const ocid = text(release?.ocid);
      const releaseId = text(release?.id);
      const awardId = text(award?.id);
      const publishedAt = text(release?.date);
      if (
        /^ocds-h6vhtk-[0-9a-f]+$/i.test(ocid) &&
        /^\d{6}-\d{4}$/.test(releaseId) &&
        awardId &&
        Number.isFinite(Date.parse(publishedAt))
      ) {
        counters.cancelledAwards += 1;
        result.push({
          key: `${ocid}:${awardId}`,
          ocid,
          releaseId,
          awardId,
          publishedAt: new Date(publishedAt).toISOString(),
          amount: null,
          cancelled: true,
        });
      } else {
        counters.excludedMalformed += 1;
      }
      continue;
    }
    let rawValue = award?.value;
    let valueBasis = "award-value";
    if (rawValue === null || rawValue === undefined) {
      const linkedContracts = (Array.isArray(release?.contracts) ? release.contracts : [])
        .filter((contract) => text(contract?.awardID) === text(award?.id));
      if (linkedContracts.length > 1) {
        counters.excludedAmbiguousContractValue += 1;
        continue;
      }
      if (linkedContracts.length === 1) {
        rawValue = linkedContracts[0]?.value;
        valueBasis = "contract-value";
      }
    }
    const amount = finiteAmount(rawValue?.amount);
    const currency = text(rawValue?.currency).toUpperCase();
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
      buyerId: text(release?.buyer?.id) || null,
      suppliers,
      supplierIds: supplierIds(award),
      supplierNations: supplierNationsFor(award, partyCountryById(release)),
      awardDate: new Date(awardDate).toISOString(),
      publishedAt: new Date(publishedAt).toISOString(),
      amount,
      currency: "GBP",
      valueBasis,
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

function isLaterRevision(candidate, existing) {
  const dateDifference = Date.parse(candidate.publishedAt) - Date.parse(existing.publishedAt);
  if (dateDifference !== 0) return dateDifference > 0;
  return candidate.releaseId.localeCompare(existing.releaseId, "en-GB") > 0;
}

function initialUrl(slice) {
  const url = new URL(FIND_A_TENDER_API);
  url.searchParams.set("updatedFrom", slice.updatedFrom);
  url.searchParams.set("updatedTo", slice.updatedTo);
  url.searchParams.set("stages", "award");
  url.searchParams.set("limit", String(PAGE_LIMIT));
  return url.toString();
}

function createContractsRetrievalBudget(nowMs = Date.now()) {
  return {
    pagesFetched: 0,
    releasesSeen: 0,
    deadlineAt: nowMs + MAX_RETRIEVAL_DURATION_MS,
  };
}

function apiUrl(value, baseUrl, label) {
  let url;
  try {
    url = new URL(value, baseUrl);
  } catch {
    throw new Error(`Find a Tender returned an invalid ${label} URL`);
  }
  const base = new URL(baseUrl);
  const allowedParameters = new Set(["updatedFrom", "updatedTo", "stages", "limit", "cursor"]);
  const cursorValues = url.searchParams.getAll("cursor");
  if (
    url.protocol !== "https:" ||
    url.hostname !== base.hostname ||
    url.pathname !== base.pathname ||
    url.username ||
    url.password ||
    url.port ||
    url.searchParams.get("updatedFrom") !== base.searchParams.get("updatedFrom") ||
    url.searchParams.get("updatedTo") !== base.searchParams.get("updatedTo") ||
    url.searchParams.get("stages") !== "award" ||
    url.searchParams.get("limit") !== String(PAGE_LIMIT) ||
    [...url.searchParams.keys()].some((parameter) => !allowedParameters.has(parameter)) ||
    cursorValues.length > 1 ||
    (cursorValues.length === 1 &&
      (cursorValues[0].length > 300 || !/^[A-Za-z0-9=]+$/.test(cursorValues[0])))
  ) {
    throw new Error(`Find a Tender ${label} URL left the requested API window`);
  }
  return url.toString();
}

function nextPageUrl(payload, response, currentUrl) {
  const cursor = payload?.pagination?.nextCursor ?? payload?.nextCursor;
  if (cursor !== undefined && cursor !== null && cursor !== "") {
    if (typeof cursor !== "string" || cursor.length > 300 || !/^[A-Za-z0-9=]+$/.test(cursor)) {
      throw new Error("Find a Tender returned an invalid pagination cursor");
    }
    const url = new URL(currentUrl);
    url.searchParams.set("cursor", cursor);
    return apiUrl(url.toString(), currentUrl, "next-page");
  }

  const headerLink = response.headers.get("link") ?? "";
  const headerNext = headerLink
    .split(",")
    .map((part) => part.trim())
    .find((part) => /rel=["']?next["']?/i.test(part))
    ?.match(/<([^>]+)>/)?.[1];
  const next = [payload?.links?.next, payload?.pagination?.next, payload?.next, payload?.nextPage, headerNext]
    .find((value) => typeof value === "string" && value.trim());
  return next ? apiUrl(next, currentUrl, "next-page") : null;
}

async function fetchSlice(slice, fetchImpl = fetch, budget = createContractsRetrievalBudget()) {
  const releases = [];
  const seenPages = new Set();
  let url = initialUrl(slice);
  let pagesFetched = 0;

  while (url) {
    if (pagesFetched >= MAX_PAGES_PER_SLICE) {
      throw new Error(`Find a Tender slice page budget exceeded (${MAX_PAGES_PER_SLICE})`);
    }
    if (budget.pagesFetched >= MAX_PAGES_PER_REFRESH) {
      throw new Error(`Find a Tender refresh page budget exceeded (${MAX_PAGES_PER_REFRESH})`);
    }
    const remainingMs = budget.deadlineAt - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      throw new Error("Find a Tender refresh time budget exceeded");
    }
    if (seenPages.has(url)) throw new Error("Find a Tender pagination repeated a page");
    seenPages.add(url);
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": FIND_A_TENDER_USER_AGENT },
      signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remainingMs)),
    });
    if (!response.ok) {
      const error = new Error(`Find a Tender returned ${response.status}`);
      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          error.retryAfterSeconds = Math.min(retryAfter, 43_200);
        }
      }
      throw error;
    }
    assertSameHttpsHost(response, url, "Find a Tender");
    if (response.url) apiUrl(response.url, url, "response");
    const payload = await readResponseJson(response, {
      limit: MAX_CONTRACT_PAGE_BYTES,
      label: "Find a Tender JSON",
    });
    if (
      payload?.publisher?.name !== "Cabinet Office" ||
      !String(payload?.version ?? "").startsWith("1.1") ||
      !Array.isArray(payload?.releases)
    ) {
      throw new Error("Find a Tender returned an unexpected OCDS release package");
    }
    if (payload.releases.length > PAGE_LIMIT) {
      throw new Error(`Find a Tender page exceeded its ${PAGE_LIMIT}-release page limit`);
    }
    if (releases.length + payload.releases.length > MAX_RELEASES_PER_SLICE) {
      throw new Error(`Find a Tender slice release budget exceeded (${MAX_RELEASES_PER_SLICE})`);
    }
    if (budget.releasesSeen + payload.releases.length > MAX_RELEASES_PER_REFRESH) {
      throw new Error(`Find a Tender refresh release budget exceeded (${MAX_RELEASES_PER_REFRESH})`);
    }
    releases.push(...payload.releases);
    pagesFetched += 1;
    budget.pagesFetched += 1;
    budget.releasesSeen += payload.releases.length;
    url = nextPageUrl(payload, response, url);
  }

  return { releases, pagesFetched, requestsMade: pagesFetched };
}

function rankDailyAwards(releases, day, collectedAt = new Date(), retrieval = {}) {
  const counters = {
    pagesFetched: retrieval.pagesFetched ?? 0,
    requestsMade: retrieval.requestsMade ?? 0,
    releasesSeen: releases.length,
    awardsSeen: 0,
    validComparableAwards: 0,
    excludedMissingValue: 0,
    excludedAmbiguousContractValue: 0,
    excludedNonGbp: 0,
    excludedMissingBuyer: 0,
    excludedMissingSupplier: 0,
    excludedMalformed: 0,
    cancelledAwards: 0,
    duplicatesRemoved: 0,
  };
  const byKey = new Map();
  for (const release of releases) {
    for (const award of extractComparableAwards(release, counters)) {
      const existing = byKey.get(award.key);
      if (!existing || isLaterRevision(award, existing)) {
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
    );
  counters.validComparableAwards = [...byKey.values()].filter((award) => !award.cancelled).length;
  const shard = {
    schemaVersion: CONTRACT_SHARD_SCHEMA_VERSION,
    day,
    complete: true,
    collectedAt: collectedAt.toISOString(),
    awards,
    dataQuality: counters,
  };
  const serialized = JSON.stringify(shard);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SHARD_BYTES) {
    throw new Error(`Find a Tender day exceeded the ${MAX_SHARD_BYTES}-byte shard limit`);
  }
  return shard;
}

async function readJson(env, key) {
  return env?.METRICS_CACHE?.get ? env.METRICS_CACHE.get(key, "json") : null;
}

async function writeJson(env, key, value, expirationTtl) {
  if (!env?.METRICS_CACHE?.put) throw new Error("METRICS_CACHE KV binding is required");
  const options = expirationTtl ? { expirationTtl } : undefined;
  await env.METRICS_CACHE.put(key, JSON.stringify(value), options);
}

async function collectDayShard(
  day,
  env,
  fetchImpl = fetch,
  now = new Date(),
  budget = createContractsRetrievalBudget(),
) {
  const releases = [];
  let pagesFetched = 0;
  for (const slice of daySlices(day)) {
    const result = await fetchSlice(slice, fetchImpl, budget);
    releases.push(...result.releases);
    pagesFetched += result.pagesFetched;
  }
  const shard = rankDailyAwards(releases, day, now, {
    pagesFetched,
    requestsMade: pagesFetched,
  });
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
    "excludedAmbiguousContractValue",
    "excludedNonGbp",
    "excludedMissingBuyer",
    "excludedMissingSupplier",
    "excludedMalformed",
    "cancelledAwards",
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
  if (!Array.isArray(shards) || shards.length !== 7 || shards.some((shard) =>
    !shard?.complete || shard.schemaVersion !== CONTRACT_SHARD_SCHEMA_VERSION
  )) {
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
      if (!existing || isLaterRevision(award, existing)) {
        if (existing) duplicatesRemoved += 1;
        byKey.set(award.key, award);
      } else {
        duplicatesRemoved += 1;
      }
    }
  }
  const comparable = [...byKey.values()].filter((award) => !award.cancelled).sort(
    (left, right) =>
      right.amount - left.amount ||
      Date.parse(right.awardDate) - Date.parse(left.awardDate) ||
      left.key.localeCompare(right.key, "en-GB")
  );
  if (comparable.length === 0) return null;
  if (new Set(comparable.map((award) => award.valueBasis ?? "award-value")).size !== 1) return null;
  const awards = comparable.slice(0, DISPLAYED_AWARD_LIMIT).map((award, index) => ({
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
          "Find a Tender award-stage releases from seven complete UTC day shards collected by public-data.org",
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
  if (options.force === true) {
    missing.push(...days);
  } else {
    for (const day of days) {
      const shard = await readJson(env, `${SHARD_PREFIX}${day}`);
      if (
        shard?.complete &&
        shard.schemaVersion === CONTRACT_SHARD_SCHEMA_VERSION &&
        shard.day === day
      ) shards.push(shard);
      else missing.push(day);
    }
  }

  let requestsMade = 0;
  const budget = createContractsRetrievalBudget();
  const collected = [];
  for (const day of missing) {
    const shard = await collectDayShard(day, env, fetchImpl, now, budget);
    requestsMade += shard.dataQuality.requestsMade;
    collected.push(day);
    shards.push(shard);
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
  };
  await writeJson(env, CURRENT_RECORD_KEY, record);
  return { updated: true, collected, completeDays: 7, requestsMade, record };
}

export {
  CURRENT_RECORD_KEY,
  MAX_CONTRACT_PAGE_BYTES,
  MAX_PAGES_PER_REFRESH,
  MAX_PAGES_PER_SLICE,
  MAX_RELEASES_PER_REFRESH,
  MAX_RELEASES_PER_SLICE,
  SHARD_PREFIX,
  buildContractsFromShards,
  collectDayShard,
  createContractsRetrievalBudget,
  daySlices,
  fetchSlice,
  previousCompleteDays,
  rankDailyAwards,
  refreshGovernmentContracts,
};
