const COLLECTION_STATUSES = Object.freeze(["succeeded", "failed", "blocked", "not_due"]);
const VERIFICATION_STATUSES = Object.freeze(["accepted", "rejected", "pending"]);
const FRESHNESS_STATES = Object.freeze(["current", "update_due", "expired"]);
const PUBLICATION_STATES = Object.freeze(["published", "held", "retired"]);
const EVIDENCE_CLASSES = Object.freeze([
  "official-statistics",
  "official-policy",
  "administrative-data",
  "polling",
  "market-signal",
  "derived-analysis",
]);
const VALUE_STATUSES = Object.freeze(["observed", "estimate", "projection"]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function text(value, label, maximum = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new Error(`${label} must be a non-empty string of at most ${maximum} characters`);
  }
  return value.trim();
}

function optionalText(value, label, maximum = 500) {
  if (value === undefined || value === null) return null;
  return text(value, label, maximum);
}

function oneOf(value, allowed, label) {
  const normalized = text(value, label, 80);
  if (!allowed.includes(normalized)) {
    throw new Error(`${label} '${normalized}' is not supported`);
  }
  return normalized;
}

function date(value, label) {
  const normalized = text(value, label, 40);
  if (!ISO_DATE.test(normalized)) throw new Error(`${label} must be an ISO calendar date`);
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${label} must be a valid calendar date`);
  }
  return normalized;
}

function instant(value, label) {
  const normalized = text(value, label, 40);
  if (!UTC_INSTANT.test(normalized) || !Number.isFinite(Date.parse(normalized))) {
    throw new Error(`${label} must be an ISO 8601 UTC timestamp`);
  }
  const canonical = new Date(normalized).toISOString();
  const normalizedCanonical = normalized.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_, fraction = "") => `.${String(fraction).padEnd(3, "0")}Z`,
  );
  if (canonical !== normalizedCanonical) {
    throw new Error(`${label} must be a valid UTC timestamp`);
  }
  return canonical;
}

function geography(value, label = "Geography") {
  const input = object(value, label);
  return {
    code: text(input.code, `${label} code`, 40),
    label: text(input.label, `${label} label`, 160),
  };
}

function httpsUrl(value, label) {
  const raw = text(value, label, 1200);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  parsed.hash = "";
  return parsed.toString();
}

function stringArray(value, label, { minimum = 0, maximumItemLength = 500 } = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const normalized = value.map((entry, index) => text(entry, `${label} ${index + 1}`, maximumItemLength));
  if (normalized.length < minimum) throw new Error(`${label} must contain at least ${minimum} item${minimum === 1 ? "" : "s"}`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates`);
  return normalized;
}

function caveats(value) {
  return stringArray(value, "Caveats", { maximumItemLength: 800 });
}

function normalizeError(value, label = "Collection error") {
  const input = object(value, label);
  if (typeof input.retryable !== "boolean") throw new Error(`${label} retryable must be boolean`);
  return {
    code: text(input.code, `${label} code`, 120),
    message: text(input.message, `${label} message`, 1000),
    retryable: input.retryable,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function fnv64(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function validateSourceDefinition(input) {
  const value = object(input, "Source definition");
  const primaryUrls = Array.isArray(value.primaryUrls)
    ? value.primaryUrls.map((entry, index) => httpsUrl(entry, `Primary URL ${index + 1}`))
    : null;
  if (!primaryUrls || primaryUrls.length === 0) throw new Error("Primary URLs must contain at least one URL");
  if (new Set(primaryUrls).size !== primaryUrls.length) throw new Error("Primary URLs must not contain duplicates");

  return deepFreeze({
    id: text(value.id, "Source id", 160),
    name: text(value.name, "Source name", 240),
    publisher: text(value.publisher, "Publisher", 240),
    evidenceClass: oneOf(value.evidenceClass, EVIDENCE_CLASSES, "Evidence class"),
    geography: geography(value.geography),
    primaryUrls,
    cadence: text(value.cadence, "Cadence", 160),
    caveats: caveats(value.caveats ?? []),
  });
}

function validateMeasureDefinition(input) {
  const value = object(input, "Measure definition");
  return deepFreeze({
    id: text(value.id, "Measure id", 180),
    sourceId: text(value.sourceId, "Measure source id", 160),
    label: text(value.label, "Measure label", 240),
    topic: text(value.topic, "Measure topic", 120),
    geography: geography(value.geography),
    unit: text(value.unit, "Measure unit", 100),
    basis: text(value.basis, "Measure basis", 500),
    valueStatus: oneOf(value.valueStatus, VALUE_STATUSES, "Value status"),
    comparisonKey: text(value.comparisonKey, "Comparison key", 240),
    caveats: caveats(value.caveats ?? []),
  });
}

function validateCollectionResult(input) {
  const value = object(input, "Collection result");
  const status = oneOf(value.status, COLLECTION_STATUSES, "Collection status");
  const base = {
    id: text(value.id, "Collection result id", 200),
    runId: text(value.runId, "Collection run id", 200),
    sourceId: text(value.sourceId, "Collection source id", 160),
    status,
    checkedAt: instant(value.checkedAt, "Collection check time"),
  };

  if (status === "succeeded") {
    if (value.error !== undefined && value.error !== null) {
      throw new Error("Successful collection results cannot contain an error");
    }
    return deepFreeze({
      ...base,
      retrievedAt: instant(value.retrievedAt, "Collection retrieval time"),
      sourceEditionId: text(value.sourceEditionId, "Source edition id", 240),
      artifactRef: text(value.artifactRef, "Collection artifact reference", 1000),
    });
  }

  if (status === "failed" || status === "blocked") {
    if (value.sourceEditionId !== undefined || value.retrievedAt !== undefined || value.artifactRef !== undefined) {
      throw new Error(`${status} collection results cannot expose a source edition or artifact`);
    }
    return deepFreeze({ ...base, error: normalizeError(value.error) });
  }

  if (value.sourceEditionId !== undefined || value.retrievedAt !== undefined || value.artifactRef !== undefined || value.error !== undefined) {
    throw new Error("Not-due collection results cannot expose collection output or errors");
  }
  return deepFreeze({
    ...base,
    reasonCode: text(value.reasonCode, "Not-due reason code", 120),
    reason: text(value.reason, "Not-due reason", 1000),
  });
}

function validateVerificationResult(input) {
  const value = object(input, "Verification result");
  const status = oneOf(value.status, VERIFICATION_STATUSES, "Verification status");
  const evidenceIds = stringArray(value.evidenceIds ?? [], "Verification evidence ids", { maximumItemLength: 240 });
  const reasons = stringArray(value.reasons ?? [], "Verification reasons", { maximumItemLength: 1000 });

  if (status === "accepted" && evidenceIds.length === 0) {
    throw new Error("Accepted verification results require at least one evidence id");
  }
  if (status !== "accepted" && evidenceIds.length > 0) {
    throw new Error("Only accepted verification results may expose evidence ids");
  }
  if (status === "rejected" && reasons.length === 0) {
    throw new Error("Rejected verification results require at least one reason");
  }

  return deepFreeze({
    id: text(value.id, "Verification result id", 200),
    collectionResultId: text(value.collectionResultId, "Collection result id", 200),
    sourceId: text(value.sourceId, "Verification source id", 160),
    sourceEditionId: text(value.sourceEditionId, "Verification source edition id", 240),
    status,
    verifiedAt: instant(value.verifiedAt, "Verification time"),
    evidenceIds,
    reasons,
  });
}

function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function normalizeObservation(value, index) {
  const input = object(value, `Observation ${index + 1}`);
  return {
    period: text(input.period, `Observation ${index + 1} period`, 180),
    observedAt: date(input.observedAt, `Observation ${index + 1} date`),
    value: input.value === null ? null : finite(input.value, `Observation ${index + 1} value`),
    valueStatus: oneOf(input.valueStatus, VALUE_STATUSES, `Observation ${index + 1} value status`),
    revisionId: text(input.revisionId, `Observation ${index + 1} revision id`, 240),
  };
}

function validateEvidenceRecord(input) {
  const value = object(input, "Evidence record");
  if (value.schemaVersion !== 1) throw new Error("Evidence record schemaVersion must be 1");

  const period = object(value.observationPeriod, "Observation period");
  const start = date(period.start, "Observation period start");
  const end = date(period.end, "Observation period end");
  if (start > end) throw new Error("Observation period starts after it ends");

  const publishedAt = instant(value.publishedAt, "Evidence publication time");
  const fetchedAt = instant(value.fetchedAt, "Evidence fetch time");
  if (Date.parse(publishedAt) > Date.parse(fetchedAt)) {
    throw new Error("Evidence publication time cannot follow fetch time");
  }

  if (!Array.isArray(value.observations)) throw new Error("Evidence observations must be an array");
  const observations = value.observations.map(normalizeObservation);
  for (let index = 1; index < observations.length; index += 1) {
    if (observations[index - 1].observedAt >= observations[index].observedAt) {
      throw new Error("Evidence observations must be strictly chronological");
    }
  }

  const headlineValue = finite(value.value, "Evidence value");
  const latestNumeric = [...observations].reverse().find((point) => point.value !== null);
  if (latestNumeric && latestNumeric.value !== headlineValue) {
    throw new Error("Evidence value must match the latest numeric observation");
  }

  return deepFreeze({
    schemaVersion: 1,
    id: text(value.id, "Evidence id", 240),
    measureId: text(value.measureId, "Evidence measure id", 180),
    sourceId: text(value.sourceId, "Evidence source id", 160),
    sourceEditionId: text(value.sourceEditionId, "Evidence source edition id", 240),
    revisionId: text(value.revisionId, "Evidence revision id", 240),
    geography: geography(value.geography),
    unit: text(value.unit, "Evidence unit", 100),
    basis: text(value.basis, "Evidence basis", 500),
    valueStatus: oneOf(value.valueStatus, VALUE_STATUSES, "Evidence value status"),
    value: headlineValue,
    observationPeriod: {
      start,
      end,
      label: text(period.label, "Observation period label", 180),
    },
    publishedAt,
    fetchedAt,
    sourceUrl: httpsUrl(value.sourceUrl, "Evidence source URL"),
    observations,
    caveats: caveats(value.caveats ?? []),
  });
}

function validateFreshnessAssessment(input) {
  const value = object(input, "Freshness assessment");
  const state = oneOf(value.state, FRESHNESS_STATES, "Freshness state");
  const evaluatedAt = instant(value.evaluatedAt, "Freshness evaluation time");
  const validUntil = instant(value.validUntil, "Freshness deadline");
  const evaluated = Date.parse(evaluatedAt);
  const deadline = Date.parse(validUntil);

  if ((state === "current" || state === "update_due") && deadline <= evaluated) {
    throw new Error(`${state} freshness state contradicts its deadline`);
  }
  if (state === "expired" && deadline > evaluated) {
    throw new Error("Expired freshness state contradicts its deadline");
  }

  return deepFreeze({
    evidenceId: text(value.evidenceId, "Freshness evidence id", 240),
    state,
    evaluatedAt,
    validUntil,
    reasonCode: text(value.reasonCode, "Freshness reason code", 120),
    reason: text(value.reason, "Freshness reason", 1000),
  });
}

function validatePublicationDecision(input) {
  const value = object(input, "Publication decision");
  return deepFreeze({
    id: text(value.id, "Publication decision id", 240),
    evidenceId: text(value.evidenceId, "Publication evidence id", 240),
    state: oneOf(value.state, PUBLICATION_STATES, "Publication state"),
    decidedAt: instant(value.decidedAt, "Publication decision time"),
    reasonCode: text(value.reasonCode, "Publication reason code", 120),
    reason: text(value.reason, "Publication reason", 1000),
  });
}

function createImmutableEdition(input) {
  const value = object(input, "Edition input");
  const publishedAt = instant(value.publishedAt, "Edition publication time");
  const previousEditionId = value.previousEditionId === null
    ? null
    : text(value.previousEditionId, "Previous edition id", 240);
  if (!Array.isArray(value.decisions) || value.decisions.length === 0) {
    throw new Error("Immutable editions require at least one published decision");
  }

  const decisions = value.decisions.map(validatePublicationDecision);
  if (decisions.some((decision) => decision.state !== "published")) {
    throw new Error("Immutable editions can contain published decisions only");
  }
  if (decisions.some((decision) => Date.parse(decision.decidedAt) > Date.parse(publishedAt))) {
    throw new Error("Edition publication time cannot precede its publication decisions");
  }

  const decisionIds = decisions.map((decision) => decision.id);
  const evidenceIds = decisions.map((decision) => decision.evidenceId);
  if (new Set(decisionIds).size !== decisionIds.length) throw new Error("Edition publication decisions must be unique");
  if (new Set(evidenceIds).size !== evidenceIds.length) throw new Error("Edition evidence ids must be unique");

  const entries = decisions
    .map((decision) => ({ evidenceId: decision.evidenceId, decisionId: decision.id }))
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const fingerprint = `content-${fnv64(JSON.stringify(entries))}`;
  const id = `edition-${fnv64(JSON.stringify({ publishedAt, previousEditionId, entries }))}`;

  return deepFreeze({
    schemaVersion: 1,
    id,
    fingerprint,
    publishedAt,
    previousEditionId,
    evidenceIds: entries.map((entry) => entry.evidenceId),
    decisionIds: entries.map((entry) => entry.decisionId),
  });
}

export {
  COLLECTION_STATUSES,
  EVIDENCE_CLASSES,
  FRESHNESS_STATES,
  PUBLICATION_STATES,
  VALUE_STATUSES,
  VERIFICATION_STATUSES,
  createImmutableEdition,
  fnv64,
  validateCollectionResult,
  validateEvidenceRecord,
  validateFreshnessAssessment,
  validateMeasureDefinition,
  validatePublicationDecision,
  validateSourceDefinition,
  validateVerificationResult,
};
