import {
  FEED_REGISTRY,
  PUBLICATION_SOURCE_REGISTRY,
  retrievalMaxAgeMsForSection,
} from "./feed-registry.js";
import {
  ISO_UTC_INSTANT,
  MAX_CLOCK_SKEW_MS,
  cacheLifetime,
  filterCurrentSnapshotWith,
  isRecord,
  sectionCurrentnessWith,
  sectionValidityDeadlineWith,
  snapshotValidityDeadlineWith,
} from "../contracts/evidence-policy.js";

// Decision logic lives in contracts/evidence-policy.js. This module keeps the
// existing call-site API and binds it to the Worker feed registry.

// Compatibility export for diagnostics/tests. Policy ownership lives in
// feed-registry.js; this object is derived rather than maintained separately.
const RETRIEVAL_MAX_AGE_MS = Object.freeze(
  Object.fromEntries(
    [...Object.entries(FEED_REGISTRY), ...Object.entries(PUBLICATION_SOURCE_REGISTRY)].map(
      ([section, definition]) => [section, definition.retrievalMaxAgeMs]
    )
  )
);

function sectionCurrentness(section, data, source, now = new Date()) {
  return sectionCurrentnessWith(section, data, source, now, retrievalMaxAgeMsForSection);
}

function sectionValidityDeadline(section, data, source, now = new Date()) {
  return sectionValidityDeadlineWith(section, data, source, now, retrievalMaxAgeMsForSection);
}

function snapshotValidityDeadline(snapshot, now = new Date()) {
  return snapshotValidityDeadlineWith(snapshot, now, retrievalMaxAgeMsForSection);
}

function filterCurrentSnapshot(snapshot, now = new Date()) {
  return filterCurrentSnapshotWith(snapshot, now, retrievalMaxAgeMsForSection);
}

function currentSectionRecord(record, now = new Date()) {
  if (!isRecord(record) || typeof record.section !== "string") return false;
  return sectionCurrentness(record.section, record.data, record.source, now).current;
}

export {
  ISO_UTC_INSTANT,
  MAX_CLOCK_SKEW_MS,
  RETRIEVAL_MAX_AGE_MS,
  cacheLifetime,
  currentSectionRecord,
  filterCurrentSnapshot,
  sectionCurrentness,
  sectionValidityDeadline,
  snapshotValidityDeadline,
};
