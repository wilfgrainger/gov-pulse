const FIND_A_TENDER_API =
  "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages";
const FIND_A_TENDER_DOCUMENTATION =
  "https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages";
const FIND_A_TENDER_RECORD_PACKAGE_DOCUMENTATION =
  "https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsRecordPackages";
const FIND_A_TENDER_USER_AGENT = "public-data.org-cloudflare-contracts/1.0";
const OPEN_GOVERNMENT_LICENCE =
  "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
const MAX_PUBLICATION_AGE_MS = 72 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DISPLAYED_AWARD_LIMIT = 100;

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
  "Supplier value concentration is an equal-share scenario across named suppliers, not publisher attribution or supplier revenue.",
  "Find a Tender is the central digital platform, but publication coverage and notice quality still depend on contracting authorities.",
]);

const EVIDENCE_POLICY = Object.freeze({
  rankingMeasure: "disclosed award value excluding VAT where supplied",
  actualSpendClaim: false,
  wasteClaim: false,
  fraudClaim: false,
  savingClaim: false,
  supplierAllocationMethod:
    "equal-share scenario across named suppliers; not an attribution or supplier revenue measure",
  comparisonCurrency: "GBP",
  displayedAwardLimit: DISPLAYED_AWARD_LIMIT,
});
const LEGACY_COUNT_EVIDENCE_POLICY = { ...EVIDENCE_POLICY };
delete LEGACY_COUNT_EVIDENCE_POLICY.displayedAwardLimit;
LEGACY_COUNT_EVIDENCE_POLICY.requiredAwardCount = DISPLAYED_AWARD_LIMIT;
Object.freeze(LEGACY_COUNT_EVIDENCE_POLICY);
const LEGACY_ALLOCATION_EVIDENCE_POLICY = {
  ...LEGACY_COUNT_EVIDENCE_POLICY,
  supplierAllocationMethod: "equal allocation across named suppliers for concentration analysis only",
};
Object.freeze(LEGACY_ALLOCATION_EVIDENCE_POLICY);
const LEGACY_CAVEATS = Object.freeze([
  "Values are the amounts disclosed in Find a Tender award releases, not invoices or confirmed lifetime public expenditure.",
  "Framework and multi-supplier awards can state maximum or estimated values that may never be fully spent.",
  "The ranking covers comparable GBP awards updated in the stated window; missing, redacted and non-GBP values are excluded.",
  "A large award is not evidence of waste, fraud or poor value. The source notice and procurement context must be examined.",
  "Find a Tender is the central digital platform, but publication coverage and notice quality still depend on contracting authorities.",
]);

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const UK_NATIONS = Object.freeze({
  SCOTLAND: "Scotland",
  WALES: "Wales",
  NORTHERN_IRELAND: "Northern Ireland",
  ENGLAND: "England",
  OTHER_UNKNOWN: "Other/Unknown",
});

// A postcode area is not a country boundary (SY and TD straddle borders, and
// JE/GY must not fall through to England). No authoritative address-level
// lookup is bundled, so postcode-only nation classification is unavailable.
function ukNationFromPostcode() {
  return UK_NATIONS.OTHER_UNKNOWN;
}

function ukNationFromCountryName(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const explicitNations = new Map([
    ["england", UK_NATIONS.ENGLAND],
    ["scotland", UK_NATIONS.SCOTLAND],
    ["wales", UK_NATIONS.WALES],
    ["northern ireland", UK_NATIONS.NORTHERN_IRELAND],
  ]);
  return explicitNations.get(normalized) ?? null;
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

function plainPublisherText(value, maximum = 1200) {
  const text = optionalText(value, maximum * 2);
  if (!text) return null;
  const stripped = text
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_match, entity) => {
      const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      if (!entity.startsWith("#")) return named[entity.toLowerCase()] ?? " ";
      const codePoint = entity[1]?.toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isSafeInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : " ";
    })
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .trim();
  return stripped.length > maximum ? `${stripped.slice(0, maximum - 1).trimEnd()}…` : stripped || null;
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

function normalizeSupplierParties(rawSuppliers, rawIds, rawNations, label) {
  if (!Array.isArray(rawSuppliers) || rawSuppliers.length === 0) {
    throw new Error(`${label} must name at least one supplier`);
  }
  const ids = rawIds === undefined ? rawSuppliers.map(() => null) : rawIds;
  const nations = rawNations === undefined ? rawSuppliers.map(() => UK_NATIONS.OTHER_UNKNOWN) : rawNations;
  if (!Array.isArray(ids) || ids.length !== rawSuppliers.length) {
    throw new Error(`${label} supplier identifiers must match the supplier count`);
  }
  if (!Array.isArray(nations) || nations.length !== rawSuppliers.length) {
    throw new Error(`${label} supplier nations must match the supplier count`);
  }
  const seen = new Set();
  const parties = rawSuppliers.map((supplier, index) => {
    const name = requiredText(supplier, `${label} supplier ${index + 1}`, 240);
    const id = optionalText(ids[index], 240);
    const identity = id ? `publisher-id:${id}` : `exact-name:${name.toLocaleLowerCase("en-GB")}`;
    if (seen.has(identity)) throw new Error(`${label} contains a duplicate supplier identity`);
    seen.add(identity);
    return {
      name,
      id,
      nation: normalizeSupplierNation(nations[index]),
    };
  });
  return parties.sort((left, right) =>
    left.name.localeCompare(right.name, "en-GB") ||
    String(left.id ?? "").localeCompare(String(right.id ?? ""), "en-GB"),
  );
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
  const suppliers = normalizeSupplierParties(value.suppliers, value.supplierIds, value.supplierNations, label);

  return {
    rank: value.rank,
    key,
    ocid,
    releaseId,
    awardId,
    title: requiredText(value.title, `${label} title`, 300),
    buyer: requiredText(value.buyer, `${label} buyer`, 240),
    buyerId: optionalText(value.buyerId, 240),
    suppliers: suppliers.map((supplier) => supplier.name),
    supplierIds: suppliers.map((supplier) => supplier.id),
    supplierNations: suppliers.map((supplier) => supplier.nation),
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
    const parties = field === "buyer"
      ? [{ name: award.buyer, id: award.buyerId ?? null }]
      : award.suppliers.map((name, index) => ({ name, id: award.supplierIds?.[index] ?? null }));
    const allocated = allocation ? award.amount / parties.length : award.amount;
    for (const party of parties) {
      const key = party.id
        ? `publisher-id:${party.id}`
        : `exact-name:${party.name.toLocaleLowerCase("en-GB")}`;
      const current = values.get(key) ?? {
        name: party.name,
        entityId: party.id,
        identityBasis: party.id ? "publisher-id" : "exact-name",
        aliases: new Set(),
        latestPublishedAt: "",
        awardCount: 0,
        disclosedValue: 0,
      };
      current.aliases.add(party.name);
      current.awardCount += 1;
      current.disclosedValue += allocated;
      if (award.publishedAt > current.latestPublishedAt) {
        current.name = party.name;
        current.latestPublishedAt = award.publishedAt;
      }
      values.set(key, current);
    }
  }
  return [...values.values()]
    .map((entry) => ({
      name: entry.name,
      entityId: entry.entityId,
      identityBasis: entry.identityBasis,
      aliases: [...entry.aliases].sort((left, right) => left.localeCompare(right, "en-GB")),
      awardCount: entry.awardCount,
      disclosedValue: round(entry.disclosedValue, 2),
    }))
    .sort(
      (left, right) =>
        right.disclosedValue - left.disclosedValue ||
        left.name.localeCompare(right.name, "en-GB")
    );
}

// Equal-share scenario by publisher identity, kept explicitly separate from
// any claim of actual supplier revenue. Each entry carries only source-owned
// names, identifiers and nations from the included award records.
function buildSupplierConcentration(awards) {
  const nations = new Map();
  for (const award of awards) {
    award.suppliers.forEach((name, index) => {
      const id = award.supplierIds?.[index] ?? null;
      const key = id ? `publisher-id:${id}` : `exact-name:${name.toLocaleLowerCase("en-GB")}`;
      const values = nations.get(key) ?? new Set();
      values.add(award.supplierNations[index] ?? UK_NATIONS.OTHER_UNKNOWN);
      nations.set(key, values);
    });
  }
  return aggregate(awards, "suppliers", true)
    .map((entry) => {
      const key = entry.entityId
        ? `publisher-id:${entry.entityId}`
        : `exact-name:${entry.name.toLocaleLowerCase("en-GB")}`;
      const knownNations = nations.get(key) ?? new Set([UK_NATIONS.OTHER_UNKNOWN]);
      return {
        ...entry,
        nation: knownNations.size === 1 ? [...knownNations][0] : UK_NATIONS.OTHER_UNKNOWN,
      };
    });
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
  return result;
}

function normalizeContractReleaseHistory(packageValue, expectedOcid) {
  const ocid = requiredText(expectedOcid, "Expected OCID", 80);
  if (!/^ocds-h6vhtk-[0-9a-f]+$/i.test(ocid)) throw new Error("Expected OCID is invalid");
  if (!packageValue || typeof packageValue !== "object" || !Array.isArray(packageValue.records) || packageValue.records.length !== 1) {
    throw new Error("Find a Tender record package must contain one record");
  }

  const record = packageValue.records[0];
  if (!record || typeof record !== "object" || record.ocid !== ocid || !Array.isArray(record.releases)) {
    throw new Error("Find a Tender record package OCID or releases are invalid");
  }
  if (record.releases.length < 1 || record.releases.length > 200) {
    throw new Error("Find a Tender record package must contain between one and 200 releases");
  }

  const seen = new Set();
  const releases = record.releases.map((release, index) => {
    const label = `Release ${index + 1}`;
    if (!release || typeof release !== "object" || release.ocid !== ocid) {
      throw new Error(`${label} OCID is invalid`);
    }
    const id = requiredText(release.id, `${label} id`, 40);
    if (!/^\d{6}-\d{4}$/.test(id)) throw new Error(`${label} id is invalid`);
    if (seen.has(id)) throw new Error(`Find a Tender record package contains duplicate release IDs`);
    seen.add(id);
    const date = isoTimestamp(release.date, `${label} date`).text;
    if (!Array.isArray(release.tag) || release.tag.length < 1 || release.tag.length > 8) {
      throw new Error(`${label} tags are invalid`);
    }
    const tags = [...new Set(release.tag.map((tag) => {
      const normalized = requiredText(tag, `${label} tag`, 48);
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(normalized)) throw new Error(`${label} tag is invalid`);
      return normalized;
    }))];
    if (tags.length !== release.tag.length) throw new Error(`${label} tags contain duplicates`);
    const title = optionalText(release.tender?.title ?? release.title, 300);
    const description = plainPublisherText(release.tender?.description ?? release.description);
    return {
      id,
      date,
      tags,
      title,
      description,
      noticeUrl: `https://www.find-tender.service.gov.uk/Notice/${id}`,
    };
  }).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));

  return {
    ocid,
    source: {
      publisher: "Cabinet Office",
      service: "Find a Tender",
      packageUrl: `https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/${ocid}`,
      documentationUrl: FIND_A_TENDER_RECORD_PACKAGE_DOCUMENTATION,
    },
    releases,
  };
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
  if (
    !Array.isArray(data.awards) ||
    data.awards.length === 0 ||
    data.awards.length > DISPLAYED_AWARD_LIMIT
  ) {
    throw new Error(`Government contracts payload must contain between one and ${DISPLAYED_AWARD_LIMIT} displayed awards`);
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

  const dataQuality = normalizeDataQuality(data.dataQuality);
  if (dataQuality.validComparableAwards < awards.length) {
    throw new Error("Displayed contract awards exceed the complete-window comparable count");
  }
  const summary = buildSummary(awards);
  if (JSON.stringify(data.summary) !== JSON.stringify(summary)) {
    throw new Error("Government contracts summary does not reconcile to the awards");
  }
  if (JSON.stringify(data.caveats) !== JSON.stringify(CAVEATS) &&
      JSON.stringify(data.caveats) !== JSON.stringify(LEGACY_CAVEATS)) {
    throw new Error("Government contracts caveats are not canonical");
  }
  if (
    JSON.stringify(data.evidencePolicy) !== JSON.stringify(EVIDENCE_POLICY) &&
    JSON.stringify(data.evidencePolicy) !== JSON.stringify(LEGACY_COUNT_EVIDENCE_POLICY) &&
    JSON.stringify(data.evidencePolicy) !== JSON.stringify(LEGACY_ALLOCATION_EVIDENCE_POLICY)
  ) {
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
    dataQuality,
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
    maxAgeDays: Math.ceil(MAX_PUBLICATION_AGE_MS / (24 * 60 * 60 * 1000)),
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
    const normalizedPublished = {
      ...published,
      evidencePolicy: canonical.evidencePolicy,
      caveats: canonical.caveats,
    };
    const hasValidMaxAge =
      observation?.maxAgeHours === MAX_PUBLICATION_AGE_MS / (60 * 60 * 1000) ||
      observation?.maxAgeDays === Math.ceil(MAX_PUBLICATION_AGE_MS / (24 * 60 * 60 * 1000));
    return (
      canonical.available === true &&
      JSON.stringify(normalizedPublished) === JSON.stringify(canonical) &&
      observation?.status === "current" &&
      observation?.period === canonical.window.label &&
      observation?.observedAt === canonical.window.updatedTo &&
      hasValidMaxAge &&
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
  FIND_A_TENDER_RECORD_PACKAGE_DOCUMENTATION,
  FIND_A_TENDER_USER_AGENT,
  MAX_PUBLICATION_AGE_MS,
  OPEN_GOVERNMENT_LICENCE,
  DISPLAYED_AWARD_LIMIT,
  SOURCE,
  UK_NATIONS,
  ukNationFromCountryName,
  buildGovernmentContractsPayload,
  buildSummary,
  buildSupplierConcentration,
  ukNationFromPostcode,
  isCurrentGovernmentContractsPayload,
  normalizeGovernmentContractsPayload,
  normalizeContractReleaseHistory,
};
