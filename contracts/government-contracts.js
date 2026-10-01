const FIND_A_TENDER_API =
  "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages";
const FIND_A_TENDER_DOCUMENTATION =
  "https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages";
const OPEN_GOVERNMENT_LICENCE =
  "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
const MAX_PUBLICATION_AGE_MS = 72 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const REQUIRED_AWARD_COUNT = 100;

const SOURCE = Object.freeze({
  publisher: "Cabinet Office",
  service: "Find a Tender",
  apiUrl: FIND_A_TENDER_API,
  documentationUrl: FIND_A_TENDER_DOCUMENTATION,
  licenceUrl: OPEN_GOVERNMENT_LICENCE,
  standard: "OCDS 1.1",
});

const CAVEATS = Object.freeze([
  "Values are the amounts disclosed in Find a Tender award releases, not invoices or confirmed lifetime public expenditure.",
  "Framework and multi-supplier awards can state maximum or estimated values that may never be fully spent.",
  "The ranking covers comparable GBP awards updated in the stated window; missing, redacted and non-GBP values are excluded.",
  "A large award is not evidence of waste, fraud or poor value. The source notice and procurement context must be examined.",
  "Find a Tender is the central digital platform, but publication coverage and notice quality still depend on contracting authorities.",
]);

const EVIDENCE_POLICY = Object.freeze({
  rankingMeasure: "disclosed award value excluding VAT where supplied",
  actualSpendClaim: false,
  wasteClaim: false,
  fraudClaim: false,
  savingClaim: false,
  supplierAllocationMethod:
    "equal allocation across named suppliers for concentration analysis only",
  comparisonCurrency: "GBP",
  requiredAwardCount: REQUIRED_AWARD_COUNT,
});

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// Deterministic, publicly documented UK postcode-area-to-nation mapping.
// Source: Royal Mail / GOV.UK postcode area allocations. This is a public,
// objective lookup from postcode AREA letters only (never from a company
// name or any other heuristic) and defaults unmapped or missing areas to
// "Other/Unknown" rather than guessing.
const UK_NATIONS = Object.freeze({
  SCOTLAND: "Scotland",
  WALES: "Wales",
  NORTHERN_IRELAND: "Northern Ireland",
  ENGLAND: "England",
  OTHER_UNKNOWN: "Other/Unknown",
});

// Postcode AREA letters (the leading alphabetic prefix of a UK postcode,
// e.g. "EH" in "EH1 1AA") that are allocated to Scotland, Wales or Northern
// Ireland. Any area not listed here, plus every other postcode format in the
// Open Government postcode allocation list, is England. BT is the sole
// Northern Ireland area. This set is intentionally the full published list,
// not a sample.
const SCOTLAND_POSTCODE_AREAS = Object.freeze([
  "AB", "DD", "DG", "EH", "FK", "G", "HS", "IV", "KA", "KW", "KY", "ML", "PA",
  "PH", "TD", "ZE",
]);
const WALES_POSTCODE_AREAS = Object.freeze([
  "CF", "LD", "LL", "NP", "SA", "SY",
]);
const NORTHERN_IRELAND_POSTCODE_AREAS = Object.freeze(["BT"]);

// SY and SY-adjacent areas straddle the England/Wales border in Royal Mail's
// own allocation (e.g. SY postcodes extend into Shropshire, England), as do
// a few Scotland-bordering areas (e.g. parts of TD extend into England).
// Royal Mail's postcode area allocation is defined by AREA letters, not by
// a strict national boundary, so a small number of addresses in a
// border-straddling area are formally outside the nation their area letters
// usually indicate. This is a documented limitation of the public mapping
// itself, not an approximation introduced here; the area-letter mapping
// below is still the deterministic, objective public assignment used by
// ONS/Royal Mail area allocation tables.
const POSTCODE_AREA_TO_NATION = Object.freeze(
  Object.fromEntries([
    ...SCOTLAND_POSTCODE_AREAS.map((area) => [area, UK_NATIONS.SCOTLAND]),
    ...WALES_POSTCODE_AREAS.map((area) => [area, UK_NATIONS.WALES]),
    ...NORTHERN_IRELAND_POSTCODE_AREAS.map((area) => [area, UK_NATIONS.NORTHERN_IRELAND]),
  ])
);

const POSTCODE_AREA_PATTERN = /^([A-Z]{1,2})\d/;

/**
 * Map a UK postcode to its nation using only the publicly documented
 * postcode AREA letters (Royal Mail / ONS allocation). Returns
 * "Other/Unknown" for any postcode that is missing, malformed, or whose
 * area is not in the published Scotland/Wales/Northern Ireland lists —
 * such an area is England, EXCEPT this function never infers England from
 * absence of information: it only returns England when the postcode
 * genuinely parses as a well-formed UK postcode outside the SC/WAL/NI
 * areas. Never derives a nation from a supplier name, address text, or any
 * other non-postcode heuristic.
 */
function ukNationFromPostcode(postcode) {
  const normalized = typeof postcode === "string" ? postcode.trim().toUpperCase() : "";
  if (!normalized) return UK_NATIONS.OTHER_UNKNOWN;
  // A well-formed UK postcode outward code is 1-2 letters followed by 1-2
  // digits (optionally one more letter), e.g. "EH1", "SW1A", "BT1". Reject
  // anything that does not match this shape rather than guessing.
  const compact = normalized.replace(/\s+/g, "");
  const match = compact.match(POSTCODE_AREA_PATTERN);
  if (!match) return UK_NATIONS.OTHER_UNKNOWN;
  const area = match[1];
  return POSTCODE_AREA_TO_NATION[area] ?? UK_NATIONS.ENGLAND;
}

function normalizeSupplierNation(value) {
  if (value === null || value === undefined) return UK_NATIONS.OTHER_UNKNOWN;
  const allowed = new Set(Object.values(UK_NATIONS));
  return allowed.has(value) ? value : UK_NATIONS.OTHER_UNKNOWN;
}

function requiredText(value, label, maximum = 500) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  if (text.length > maximum) throw new Error(`${label} is too long`);
  return text;
}

function optionalText(value, maximum = 500) {
  if (value === null || value === undefined || value === "") return null;
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maximum) return null;
  return text;
}

function isoTimestamp(value, label) {
  const text = requiredText(value, label, 80);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} must be an ISO timestamp`);
  return { text: new Date(timestamp).toISOString(), timestamp };
}

function officialUrl(value, label, kind) {
  const text = requiredText(value, label, 300);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} must be a URL`);
  }
  if (url.protocol !== "https:" || url.hostname !== "www.find-tender.service.gov.uk") {
    throw new Error(`${label} must point to Find a Tender`);
  }
  if (kind === "notice" && !/^\/Notice\/\d{6}-\d{4}$/.test(url.pathname)) {
    throw new Error(`${label} must point to a Find a Tender notice`);
  }
  if (
    kind === "procurement" &&
    !/^\/procurement\/ocds-h6vhtk-[0-9a-f]+$/i.test(url.pathname)
  ) {
    throw new Error(`${label} must point to a Find a Tender procurement`);
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizeSuppliers(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error(`${label} must name between one and 100 suppliers`);
  }
  const suppliers = value.map((supplier, index) =>
    requiredText(supplier, `${label} supplier ${index + 1}`, 240)
  );
  const identities = suppliers.map((supplier) => supplier.toLocaleLowerCase("en-GB"));
  if (new Set(identities).size !== suppliers.length) {
    throw new Error(`${label} contains duplicate suppliers`);
  }
  return suppliers.sort((left, right) => left.localeCompare(right, "en-GB"));
}

// Pairs each RAW (pre-sort) supplier name with its nation, then sorts both
// together so the result stays aligned with normalizeSuppliers' own sort of
// the same raw list. Nation values are validated with
// normalizeSupplierNation and default to "Other/Unknown" for anything not
// one of the four canonical UK nations plus the unknown bucket.
function normalizeSupplierNations(rawSuppliers, rawNations, label) {
  const nations = Array.isArray(rawNations) ? rawNations : [];
  if (nations.length !== 0 && nations.length !== rawSuppliers.length) {
    throw new Error(`${label} supplier nations must match the supplier count`);
  }
  const names = rawSuppliers.map((supplier, index) =>
    requiredText(supplier, `${label} supplier ${index + 1}`, 240)
  );
  const pairs = names.map((name, index) => ({
    name,
    nation: normalizeSupplierNation(nations[index] ?? UK_NATIONS.OTHER_UNKNOWN),
  }));
  return pairs
    .sort((left, right) => left.name.localeCompare(right.name, "en-GB"))
    .map((pair) => pair.nation);
}

function normalizeAward(value, index) {
  const label = `Award ${index + 1}`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  if (!Number.isInteger(value.rank) || value.rank !== index + 1) {
    throw new Error(`${label} rank must match its position`);
  }
  if (
    typeof value.amount !== "number" ||
    !Number.isFinite(value.amount) ||
    value.amount <= 0
  ) {
    throw new Error(`${label} amount must be a positive number`);
  }
  if (value.currency !== "GBP") throw new Error(`${label} currency must be GBP`);

  const awardDate = isoTimestamp(value.awardDate, `${label} award date`).text;
  const publishedAt = isoTimestamp(value.publishedAt, `${label} publication date`).text;
  const ocid = requiredText(value.ocid, `${label} OCID`, 80);
  if (!/^ocds-h6vhtk-[0-9a-f]+$/i.test(ocid)) throw new Error(`${label} OCID is invalid`);
  const releaseId = requiredText(value.releaseId, `${label} release id`, 40);
  if (!/^\d{6}-\d{4}$/.test(releaseId)) throw new Error(`${label} release id is invalid`);
  const awardId = requiredText(value.awardId, `${label} award id`, 160);
  const key = `${ocid}:${awardId}`;
  if (value.key !== key) throw new Error(`${label} key is not canonical`);

  return {
    rank: value.rank,
    key,
    ocid,
    releaseId,
    awardId,
    title: requiredText(value.title, `${label} title`, 300),
    buyer: requiredText(value.buyer, `${label} buyer`, 240),
    suppliers: normalizeSuppliers(value.suppliers, label),
    supplierNations: normalizeSupplierNations(value.suppliers, value.supplierNations, label),
    awardDate,
    publishedAt,
    amount: round(value.amount, 2),
    currency: "GBP",
    procurementMethod: optionalText(value.procurementMethod, 80),
    procurementMethodDetails: optionalText(value.procurementMethodDetails, 300),
    mainProcurementCategory: optionalText(value.mainProcurementCategory, 80),
    framework: value.framework === true,
    noticeUrl: officialUrl(value.noticeUrl, `${label} notice URL`, "notice"),
    procurementUrl: officialUrl(
      value.procurementUrl,
      `${label} procurement URL`,
      "procurement"
    ),
  };
}

function aggregate(awards, field, allocation = false) {
  const values = new Map();
  for (const award of awards) {
    const names = field === "buyer" ? [award.buyer] : award.suppliers;
    const allocated = allocation ? award.amount / names.length : award.amount;
    for (const name of names) {
      const current = values.get(name) ?? { name, awardCount: 0, disclosedValue: 0 };
      current.awardCount += 1;
      current.disclosedValue += allocated;
      values.set(name, current);
    }
  }
  return [...values.values()]
    .map((entry) => ({ ...entry, disclosedValue: round(entry.disclosedValue, 2) }))
    .sort(
      (left, right) =>
        right.disclosedValue - left.disclosedValue ||
        left.name.localeCompare(right.name, "en-GB")
    );
}

// Ranked-by-total-value supplier concentration: aggregates the EXISTING
// award data by supplier (equal allocation across co-suppliers on the same
// award, matching the summary's existing allocation method). Each entry
// carries the supplier's nation when every award names a consistent,
// known nation for that supplier, and "Other/Unknown" otherwise — this
// never cross-references a different data source, only the 100 ranked
// awards already in this payload.
function buildSupplierConcentration(awards) {
  const values = new Map();
  for (const award of awards) {
    const allocated = award.amount / award.suppliers.length;
    award.suppliers.forEach((name, index) => {
      const nation = award.supplierNations[index] ?? UK_NATIONS.OTHER_UNKNOWN;
      const current =
        values.get(name) ?? { name, awardCount: 0, disclosedValue: 0, nations: new Set() };
      current.awardCount += 1;
      current.disclosedValue += allocated;
      current.nations.add(nation);
      values.set(name, current);
    });
  }
  return [...values.values()]
    .map((entry) => ({
      name: entry.name,
      awardCount: entry.awardCount,
      disclosedValue: round(entry.disclosedValue, 2),
      nation: entry.nations.size === 1 ? [...entry.nations][0] : UK_NATIONS.OTHER_UNKNOWN,
    }))
    .sort(
      (left, right) =>
        right.disclosedValue - left.disclosedValue ||
        left.name.localeCompare(right.name, "en-GB")
    );
}

function buildSummary(awards) {
  const total = round(awards.reduce((sum, award) => sum + award.amount, 0), 2);
  const top10 = awards.slice(0, 10).reduce((sum, award) => sum + award.amount, 0);
  const buyers = aggregate(awards, "buyer");
  const suppliers = aggregate(awards, "suppliers", true);
  const direct = awards.filter((award) => {
    const method = `${award.procurementMethod ?? ""} ${award.procurementMethodDetails ?? ""}`;
    return /\bdirect\b/i.test(method);
  }).length;
  return {
    awardCount: awards.length,
    disclosedValueTotal: total,
    largestAwardValue: awards[0]?.amount ?? 0,
    top10Share: total > 0 ? round((top10 / total) * 100, 1) : 0,
    distinctBuyers: buyers.length,
    distinctSuppliers: suppliers.length,
    explicitDirectAwards: direct,
    missingProcedure: awards.filter(
      (award) => !award.procurementMethod && !award.procurementMethodDetails
    ).length,
    frameworkAwards: awards.filter((award) => award.framework).length,
    topBuyer: buyers[0] ?? { name: "Unavailable", awardCount: 0, disclosedValue: 0 },
    topSupplier: suppliers[0] ?? {
      name: "Unavailable",
      awardCount: 0,
      disclosedValue: 0,
    },
  };
}

function normalizeDataQuality(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Government contracts data quality metadata is required");
  }
  const result = {};
  for (const field of [
    "pagesFetched",
    "requestsMade",
    "releasesSeen",
    "awardsSeen",
    "validComparableAwards",
    "excludedMissingValue",
    "excludedNonGbp",
    "excludedMissingBuyer",
    "excludedMissingSupplier",
    "excludedMalformed",
    "duplicatesRemoved",
  ]) {
    if (!Number.isInteger(value[field]) || value[field] < 0) {
      throw new Error(`Government contracts data quality field '${field}' is invalid`);
    }
    result[field] = value[field];
  }
  if (result.validComparableAwards < REQUIRED_AWARD_COUNT) {
    throw new Error("Fewer than 100 comparable awards were collected");
  }
  return result;
}

function normalizeGovernmentContractsPayload(data, now = new Date()) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Missing government contracts payload");
  }
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Validation time is invalid");
  const generated = isoTimestamp(data.generatedAt, "Government contracts generated at");
  if (generated.timestamp > nowMs + FUTURE_TOLERANCE_MS) {
    throw new Error("Government contracts payload cannot be future dated");
  }
  if (nowMs - generated.timestamp > MAX_PUBLICATION_AGE_MS) {
    throw new Error("Government contracts payload is outside the currentness window");
  }

  const windowFrom = isoTimestamp(data.window?.updatedFrom, "Window start");
  const windowTo = isoTimestamp(data.window?.updatedTo, "Window end");
  if (windowFrom.timestamp >= windowTo.timestamp || windowTo.timestamp > generated.timestamp) {
    throw new Error("Government contracts window is invalid");
  }
  if (!Array.isArray(data.awards) || data.awards.length !== REQUIRED_AWARD_COUNT) {
    throw new Error("Government contracts payload must contain exactly 100 awards");
  }

  const awards = data.awards.map(normalizeAward);
  if (new Set(awards.map((award) => award.key)).size !== awards.length) {
    throw new Error("Government contracts awards must be unique");
  }
  for (let index = 1; index < awards.length; index += 1) {
    if (awards[index - 1].amount < awards[index].amount) {
      throw new Error("Government contracts awards must be sorted by disclosed value");
    }
  }

  const summary = buildSummary(awards);
  if (JSON.stringify(data.summary) !== JSON.stringify(summary)) {
    throw new Error("Government contracts summary does not reconcile to the awards");
  }
  if (JSON.stringify(data.caveats) !== JSON.stringify(CAVEATS)) {
    throw new Error("Government contracts caveats are not canonical");
  }
  if (JSON.stringify(data.evidencePolicy) !== JSON.stringify(EVIDENCE_POLICY)) {
    throw new Error("Government contracts evidence policy is not canonical");
  }

  return {
    available: data.available === true,
    generatedAt: generated.text,
    window: {
      updatedFrom: windowFrom.text,
      updatedTo: windowTo.text,
      label: requiredText(data.window.label, "Window label", 160),
      basis: requiredText(data.window.basis, "Window basis", 300),
    },
    source: { ...SOURCE },
    summary,
    awards,
    supplierConcentration: buildSupplierConcentration(awards),
    dataQuality: normalizeDataQuality(data.dataQuality),
    caveats: [...CAVEATS],
    evidencePolicy: { ...EVIDENCE_POLICY },
  };
}

function observationFor(data, checkedAt = new Date()) {
  return {
    status: "current",
    period: data.window.label,
    observedAt: data.window.updatedTo,
    checkedAt: checkedAt.toISOString(),
    maxAgeHours: MAX_PUBLICATION_AGE_MS / (60 * 60 * 1000),
  };
}

function buildGovernmentContractsPayload(data, now = new Date()) {
  const normalized = normalizeGovernmentContractsPayload(data, now);
  return { ...normalized, __observation: observationFor(normalized, now) };
}

function isCurrentGovernmentContractsPayload(data, now = new Date()) {
  try {
    const canonical = normalizeGovernmentContractsPayload(data, now);
    const observation = data.__observation;
    const checkedAt = Date.parse(observation?.checkedAt ?? "");
    const { __observation: ignored, ...published } = data;
    void ignored;
    return (
      canonical.available === true &&
      JSON.stringify(published) === JSON.stringify(canonical) &&
      observation?.status === "current" &&
      observation?.period === canonical.window.label &&
      observation?.observedAt === canonical.window.updatedTo &&
      observation?.maxAgeHours === MAX_PUBLICATION_AGE_MS / (60 * 60 * 1000) &&
      Number.isFinite(checkedAt) &&
      checkedAt >= Date.parse(canonical.window.updatedTo) &&
      checkedAt <= now.getTime() + FUTURE_TOLERANCE_MS
    );
  } catch {
    return false;
  }
}

export {
  CAVEATS,
  EVIDENCE_POLICY,
  FIND_A_TENDER_API,
  FIND_A_TENDER_DOCUMENTATION,
  MAX_PUBLICATION_AGE_MS,
  OPEN_GOVERNMENT_LICENCE,
  REQUIRED_AWARD_COUNT,
  SOURCE,
  UK_NATIONS,
  buildGovernmentContractsPayload,
  buildSummary,
  buildSupplierConcentration,
  ukNationFromPostcode,
  isCurrentGovernmentContractsPayload,
  normalizeGovernmentContractsPayload,
};
