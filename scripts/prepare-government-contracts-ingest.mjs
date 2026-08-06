import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

const PAGE_LIMIT = 100;
const MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_DELAY_MS = 10_000;
const SLICE_HOURS = 6;
const WINDOW_DAYS = 7;
const USER_AGENT = "public-data.org-procurement-collector/1.0";

function parseArguments(argv) {
  const args = { out: "tmp/government-contracts.json" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--out") args.out = argv[++index];
  }
  if (!args.out) throw new Error("--out requires a file path");
  return args;
}

function completeUtcWindow(now = new Date(), days = WINDOW_DAYS) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Collection time is invalid");
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const updatedTo = new Date(today - 1_000);
  const updatedFrom = new Date(today - days * 24 * 60 * 60 * 1_000);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    updatedFrom: updatedFrom.toISOString(),
    updatedTo: updatedTo.toISOString(),
    label: `${formatter.format(updatedFrom)} to ${formatter.format(updatedTo)}`,
  };
}

function slicedWindow(window, hours = SLICE_HOURS) {
  const start = Date.parse(window.updatedFrom);
  const end = Date.parse(window.updatedTo);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error("Find a Tender collection window is invalid");
  }
  const slices = [];
  const sliceMs = hours * 60 * 60 * 1_000;
  for (let from = start; from <= end; ) {
    const to = Math.min(end, from + sliceMs - 1_000);
    slices.push({
      apiFrom: new Date(from).toISOString().slice(0, 19),
      apiTo: new Date(to).toISOString().slice(0, 19),
    });
    from = to + 1_000;
  }
  return slices;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteAmount(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
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

function awardTitle(release, award) {
  return (
    text(award?.title) ||
    text(release?.tender?.title) ||
    text(release?.title) ||
    text(release?.description)
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

    const ocid = text(release.ocid);
    const releaseId = text(release.id);
    const awardId = text(award.id);
    const title = awardTitle(release, award);
    const awardDate = text(award.date) || text(release.date);
    const publishedAt = text(release.date);
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
      procurementMethodDetails:
        text(release?.tender?.procurementMethodDetails) || null,
      mainProcurementCategory:
        text(release?.tender?.mainProcurementCategory) || null,
      framework: isFramework(release),
      noticeUrl: `https://www.find-tender.service.gov.uk/Notice/${releaseId}`,
      procurementUrl: `https://www.find-tender.service.gov.uk/procurement/${ocid}`,
    });
  }
  return result;
}

function canonicalNextUrl(raw, baseUrl) {
  if (!raw) return null;
  const url = new URL(raw, baseUrl);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.find-tender.service.gov.uk" ||
    url.pathname !== "/api/1.0/ocdsReleasePackages"
  ) {
    throw new Error("Find a Tender pagination left the approved API boundary");
  }
  return url.toString();
}

function nextPageUrl(payload, response, currentUrl) {
  for (const candidate of [
    payload?.links?.next,
    payload?.pagination?.next,
    payload?.next,
    payload?.nextPage,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return canonicalNextUrl(candidate, currentUrl);
    }
  }
  const cursor = payload?.pagination?.nextCursor ?? payload?.nextCursor;
  if (typeof cursor === "string" && cursor.trim()) {
    const url = new URL(currentUrl);
    url.searchParams.set("cursor", cursor.trim());
    return canonicalNextUrl(url.toString(), currentUrl);
  }
  const link = response.headers.get("link") ?? "";
  const nextLink = link
    .split(",")
    .map((part) => part.trim())
    .find((part) => /rel=["']?next["']?/i.test(part));
  const match = nextLink?.match(/<([^>]+)>/);
  return match ? canonicalNextUrl(match[1], currentUrl) : null;
}

async function sleep(milliseconds) {
  if (milliseconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchPackage(url, fetchImpl = fetch) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 429 || response.status === 503) {
        const seconds = Math.min(
          30,
          Math.max(1, Number.parseInt(response.headers.get("retry-after") ?? "10", 10) || 10)
        );
        await response.body?.cancel();
        await sleep(seconds * 1_000);
        continue;
      }
      if (!response.ok) throw new Error(`Find a Tender returned ${response.status}`);
      const payload = await response.json();
      if (
        payload?.publisher?.name !== "Cabinet Office" ||
        !String(payload?.version ?? "").startsWith("1.1") ||
        !Array.isArray(payload?.releases)
      ) {
        throw new Error("Find a Tender returned an unexpected OCDS release package");
      }
      return { response, payload };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep((attempt + 1) * 2_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Find a Tender request failed");
}

function initialSliceUrl(slice) {
  const url = new URL(FIND_A_TENDER_API);
  url.searchParams.set("updatedFrom", slice.apiFrom);
  url.searchParams.set("updatedTo", slice.apiTo);
  url.searchParams.set("stages", "award");
  url.searchParams.set("limit", String(PAGE_LIMIT));
  return url.toString();
}

async function collectReleasePackages(
  window,
  fetchImpl = fetch,
  requestDelayMs = REQUEST_DELAY_MS
) {
  const releases = [];
  let pagesFetched = 0;
  let requestsMade = 0;
  const seenUrls = new Set();

  for (const slice of slicedWindow(window)) {
    let url = initialSliceUrl(slice);
    while (url) {
      if (seenUrls.has(url)) throw new Error("Find a Tender pagination repeated a page");
      if (pagesFetched >= MAX_PAGES) {
        throw new Error("Find a Tender pagination exceeded the bounded page limit");
      }
      seenUrls.add(url);
      if (requestsMade > 0) await sleep(requestDelayMs);
      const { response, payload } = await fetchPackage(url, fetchImpl);
      requestsMade += 1;
      pagesFetched += 1;
      releases.push(...payload.releases);
      const next = nextPageUrl(payload, response, url);
      if (!next && payload.releases.length === PAGE_LIMIT) {
        throw new Error("Find a Tender pagination completeness could not be proved");
      }
      url = next;
    }
  }
  return { releases, pagesFetched, requestsMade };
}

function rankAwards(releases, pagesFetched, now = new Date(), requestsMade = pagesFetched) {
  const counters = {
    pagesFetched,
    requestsMade,
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

  const comparable = [...byKey.values()].sort(
    (left, right) =>
      right.amount - left.amount ||
      Date.parse(right.awardDate) - Date.parse(left.awardDate) ||
      left.key.localeCompare(right.key, "en-GB")
  );
  counters.validComparableAwards = comparable.length;
  if (comparable.length < REQUIRED_AWARD_COUNT) {
    throw new Error(
      `Find a Tender returned only ${comparable.length} comparable GBP awards in the complete window`
    );
  }
  const awards = comparable.slice(0, REQUIRED_AWARD_COUNT).map((award, index) => ({
    ...award,
    rank: index + 1,
  }));
  const window = completeUtcWindow(now);
  return buildGovernmentContractsPayload(
    {
      available: true,
      generatedAt: now.toISOString(),
      window: {
        updatedFrom: window.updatedFrom,
        updatedTo: window.updatedTo,
        label: window.label,
        basis:
          "Find a Tender award-stage releases from the latest complete seven-day UTC window, collected in six-hour slices",
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
      dataQuality: counters,
      caveats: [...CAVEATS],
      evidencePolicy: { ...EVIDENCE_POLICY },
    },
    now
  );
}

async function prepareGovernmentContracts({
  fetchImpl = fetch,
  now = new Date(),
  requestDelayMs = REQUEST_DELAY_MS,
} = {}) {
  const window = completeUtcWindow(now);
  const { releases, pagesFetched, requestsMade } = await collectReleasePackages(
    window,
    fetchImpl,
    requestDelayMs
  );
  return rankAwards(releases, pagesFetched, now, requestsMade);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const payload = await prepareGovernmentContracts();
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        status: "ok",
        output: args.out,
        generatedAt: payload.generatedAt,
        window: payload.window,
        awards: payload.awards.length,
        disclosedValueTotal: payload.summary.disclosedValueTotal,
        requestsMade: payload.dataQuality.requestsMade,
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  collectReleasePackages,
  completeUtcWindow,
  extractComparableAwards,
  nextPageUrl,
  prepareGovernmentContracts,
  rankAwards,
  slicedWindow,
};
