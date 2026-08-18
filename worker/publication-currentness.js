import {
  FEED_REGISTRY,
  PUBLICATION_SOURCE_REGISTRY,
  retrievalMaxAgeMsForSection,
} from "./feed-registry.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const ISO_UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

// Compatibility export for diagnostics/tests. Policy ownership lives in
// feed-registry.js; this object is derived rather than maintained separately.
const RETRIEVAL_MAX_AGE_MS = Object.freeze(
  Object.fromEntries(
    [...Object.entries(FEED_REGISTRY), ...Object.entries(PUBLICATION_SOURCE_REGISTRY)].map(
      ([section, definition]) => [section, definition.retrievalMaxAgeMs]
    )
  )
);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsedTime(value) {
  const match = typeof value === "string" ? value.match(ISO_UTC_INSTANT) : null;
  if (!match) return null;

  const milliseconds = (match[7] ?? "").padEnd(3, "0");
  const normalized = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${milliseconds}Z`;
  const time = Date.parse(normalized);
  return Number.isFinite(time) && new Date(time).toISOString() === normalized ? time : null;
}

function sectionCurrentness(section, data, source, now = new Date()) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || !isRecord(data) || !isRecord(source)) {
    return { current: false, reason: "invalid-record" };
  }

  const retrievalLimit = retrievalMaxAgeMsForSection(section);
  if (!Number.isFinite(retrievalLimit)) {
    return { current: false, reason: "missing-policy" };
  }

  if (Object.prototype.hasOwnProperty.call(source, "status") && source.status !== "ok") {
    return { current: false, reason: "source-not-current" };
  }

  if (
    Object.prototype.hasOwnProperty.call(source, "cacheState") &&
    source.cacheState !== "fresh"
  ) {
    return { current: false, reason: "source-cache-not-current" };
  }

  const hasExplicitExpiry = Object.prototype.hasOwnProperty.call(data, "expiresAt");
  const explicitExpiry = parsedTime(data.expiresAt);
  if (hasExplicitExpiry && explicitExpiry === null) {
    return { current: false, reason: "invalid-expiry" };
  }
  if (explicitExpiry !== null && nowMs >= explicitExpiry) {
    return { current: false, reason: "explicit-expiry" };
  }

  const fetchedAt = parsedTime(source.fetchedAt);
  if (fetchedAt === null) return { current: false, reason: "missing-retrieval-time" };
  if (fetchedAt > nowMs + MAX_CLOCK_SKEW_MS) {
    return { current: false, reason: "retrieval-in-future" };
  }
  if (explicitExpiry !== null && explicitExpiry <= fetchedAt) {
    return { current: false, reason: "expiry-not-after-retrieval" };
  }
  if (nowMs - fetchedAt >= retrievalLimit) {
    return { current: false, reason: "retrieval-expired" };
  }

  const hasObservation = Object.prototype.hasOwnProperty.call(data, "__observation");
  const sourceOwned = isRecord(source.provenance) && source.provenance.section === section;
  if (!hasObservation && sourceOwned) {
    return { current: false, reason: "missing-observation" };
  }
  if (hasObservation && !isRecord(data.__observation)) {
    return { current: false, reason: "invalid-observation" };
  }

  const observation = hasObservation ? data.__observation : null;
  if (observation) {
    if (observation.status !== "current") {
      return { current: false, reason: "observation-not-current" };
    }

    const observedAt = parsedTime(observation.observedAt);
    if (observedAt === null) {
      return { current: false, reason: "invalid-observation-time" };
    }
    if (explicitExpiry !== null && explicitExpiry <= observedAt) {
      return { current: false, reason: "expiry-not-after-observation" };
    }

    const maximumAgeDays = observation.maxAgeDays;
    const maximumAgeMs = maximumAgeDays * DAY_MS;
    if (
      !Number.isSafeInteger(maximumAgeDays) ||
      maximumAgeDays <= 0 ||
      !Number.isSafeInteger(maximumAgeMs)
    ) {
      return { current: false, reason: "invalid-observation-policy" };
    }

    if (observedAt > nowMs + MAX_CLOCK_SKEW_MS) {
      return { current: false, reason: "observation-in-future" };
    }
    if (observedAt > fetchedAt + MAX_CLOCK_SKEW_MS) {
      return { current: false, reason: "observation-after-retrieval" };
    }
    if (explicitExpiry === null && nowMs - observedAt >= maximumAgeMs) {
      return { current: false, reason: "observation-expired" };
    }
  }

  return { current: true, reason: "current" };
}

function sectionValidityDeadline(section, data, source, now = new Date()) {
  if (!sectionCurrentness(section, data, source, now).current) return null;

  const retrievalLimit = retrievalMaxAgeMsForSection(section);
  if (!Number.isFinite(retrievalLimit)) return null;

  const deadlines = [parsedTime(source.fetchedAt) + retrievalLimit];
  const explicitExpiry = parsedTime(data.expiresAt);
  if (explicitExpiry !== null) deadlines.push(explicitExpiry);

  if (isRecord(data.__observation) && explicitExpiry === null) {
    deadlines.push(
      parsedTime(data.__observation.observedAt) + data.__observation.maxAgeDays * DAY_MS
    );
  }

  return Math.min(...deadlines);
}

function snapshotValidityDeadline(snapshot, now = new Date()) {
  if (!isRecord(snapshot) || !isRecord(snapshot.meta) || !isRecord(snapshot.meta.sources)) {
    return null;
  }

  let earliest = null;
  for (const [section, source] of Object.entries(snapshot.meta.sources)) {
    const deadline = sectionValidityDeadline(section, snapshot[section], source, now);
    if (!Number.isFinite(deadline)) return null;
    earliest = earliest === null ? deadline : Math.min(earliest, deadline);
  }
  return earliest;
}

function filterCurrentSnapshot(snapshot, now = new Date()) {
  if (!isRecord(snapshot) || !isRecord(snapshot.meta) || !isRecord(snapshot.meta.sources)) {
    return null;
  }

  const filtered = structuredClone(snapshot);
  for (const section of Object.keys(snapshot)) {
    if (
      section !== "meta" &&
      !Object.prototype.hasOwnProperty.call(snapshot.meta.sources, section)
    ) {
      delete filtered[section];
    }
  }

  for (const [section, source] of Object.entries(snapshot.meta.sources)) {
    const data = snapshot[section];
    const result = sectionCurrentness(section, data, source, now);
    if (!result.current) {
      delete filtered[section];
      delete filtered.meta.sources[section];
    }
  }

  const currentSections = new Set(Object.keys(filtered.meta.sources));
  if (Array.isArray(filtered.meta.verifiedSections)) {
    filtered.meta.verifiedSections = filtered.meta.verifiedSections.filter(
      (section) => typeof section === "string" && currentSections.has(section)
    );
  }

  return currentSections.size > 0 ? filtered : null;
}

function currentSectionRecord(record, now = new Date()) {
  if (!isRecord(record) || typeof record.section !== "string") return false;
  return sectionCurrentness(record.section, record.data, record.source, now).current;
}

export {
  ISO_UTC_INSTANT,
  MAX_CLOCK_SKEW_MS,
  RETRIEVAL_MAX_AGE_MS,
  currentSectionRecord,
  filterCurrentSnapshot,
  sectionCurrentness,
  sectionValidityDeadline,
  snapshotValidityDeadline,
};