// The single place that turns clocks and publication decisions into public
// availability. Isomorphic: no Node or DOM APIs. Missing, stale or
// unreconciled evidence is unavailable, never zero or interpolated.
//
// Call sites import from here directly (tests/unit/policy-single-owner.test.ts
// enforces it); tests/worker/evidence-policy-parity.test.ts proves equivalence
// with the legacy behaviour.
import PUBLICATION_CONFIG from "../config/publications.json" with { type: "json" };
import definitions from "./measure-definitions.json" with { type: "json" };
import { FEED_CATALOG } from "./source-catalog.js";
import { isRecord } from "./records.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const ISO_UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
// sentimentPulse validity is independent per measure.
const SENTIMENT_MEASURE_IDS = Object.freeze(["inflation", "bankRate", "unemployment"]);
const PUBLICATION_STATES = Object.freeze(["published", "held", "retired"]);

/**
 * @typedef {"published"|"held"|"retired"} Decision
 * @typedef {"held"|"no-record"|"shape"|"retrieval-expired"|"observation-expired"|"clock-skew"|"not-current"} UnavailableReason
 * @typedef {{state:"current"|"unavailable"|"held", reason:UnavailableReason|null, validUntil:string|null}} Verdict
 * @typedef {{state:"published"|"held"|"retired", reasonCode:string, reason:string, sections?:string[]}} PublicationDecision
 * @typedef {{version:number, publications: Record<string, PublicationDecision>}} PublicationConfig
 */

function parsedTime(value) {
  const match = typeof value === "string" ? value.match(ISO_UTC_INSTANT) : null;
  if (!match) return null;

  const milliseconds = (match[7] ?? "").padEnd(3, "0");
  const normalized = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${milliseconds}Z`;
  const time = Date.parse(normalized);
  return Number.isFinite(time) && new Date(time).toISOString() === normalized ? time : null;
}

function cacheLifetime(validUntil, now = new Date()) {
  const deadline = parsedTime(validUntil);
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  if (deadline === null || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((deadline - nowMs) / 1000));
}

/** Retrieval-age limit for a registered feed or publication source, else null. */
function retrievalMaxAgeMsForSection(section) {
  if (typeof section !== "string" || !Object.hasOwn(FEED_CATALOG, section)) return null;
  const feed = FEED_CATALOG[section];
  if (feed?.registry !== "feed" && feed?.registry !== "publication") return null;
  return feed.retrievalMaxAgeMs ?? null;
}

/**
 * The one maxAgeDays/maxAgeHours conversion. Returns null unless the
 * observation declares a positive, finite window.
 */
function observationMaxAge(observation) {
  const days =
    Number.isSafeInteger(observation?.maxAgeDays) && observation.maxAgeDays > 0
      ? observation.maxAgeDays
      : Number.isFinite(observation?.maxAgeHours) && observation.maxAgeHours > 0
        ? observation.maxAgeHours / 24
        : null;
  if (days === null || !Number.isFinite(days) || days <= 0) return null;
  const ms = days * DAY_MS;
  return Number.isFinite(ms) ? { days, ms } : null;
}

/** Expiry instant for an observation clock plus a day-based contract window. */
function observationExpiryMs(observedAtMs, maxAgeDays) {
  return observedAtMs + maxAgeDays * DAY_MS;
}

/** True when an observation is strictly older than its contract window. */
function observationOutsideContract(ageMs, maxAgeDays) {
  return ageMs > maxAgeDays * DAY_MS;
}

function sentimentMeasureState(data, nowMs, redactExpired = false) {
  if (!isRecord(data?.__measureValidity) || !isRecord(data?.series)) return null;
  const ids = SENTIMENT_MEASURE_IDS;
  if (ids.some((id) => !isRecord(data.__measureValidity[id]) || !isRecord(data.series[id]))) {
    return { valid: false, current: [] };
  }
  const current = [];
  for (const id of ids) {
    const series = data.series[id];
    const deadline = parsedTime(data.__measureValidity[id].validUntil);
    const usable =
      deadline !== null &&
      nowMs < deadline &&
      series.status === "current" &&
      typeof series.value === "number" &&
      Number.isFinite(series.value);
    if (usable) current.push(id);
    else if (redactExpired) {
      data.series[id] = {
        ...series,
        value: null,
        annualDelta: null,
        status: "expired",
      };
    }
  }
  return { valid: true, current };
}

/**
 * Currentness and validity deadline in one pass, so the deadline can never
 * disagree with the verdict. `deadline` is epoch ms, or null when not current
 * (or when a current sentimentPulse carries no per-measure validity).
 */
function assessSection(section, data, source, now, retrievalLimit) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || !isRecord(data) || !isRecord(source)) {
    return { current: false, reason: "invalid-record", deadline: null };
  }
  const no = (reason) => ({ current: false, reason, deadline: null });

  if (!Number.isFinite(retrievalLimit)) return no("missing-policy");

  const hasExplicitExpiry = Object.prototype.hasOwnProperty.call(data, "expiresAt");
  const explicitExpiry = parsedTime(data.expiresAt);
  if (hasExplicitExpiry && explicitExpiry === null) return no("invalid-expiry");
  if (explicitExpiry !== null && nowMs >= explicitExpiry) return no("explicit-expiry");

  const independentMeasures = section === "sentimentPulse"
    ? sentimentMeasureState(data, nowMs)
    : null;
  if (independentMeasures && !independentMeasures.valid) return no("invalid-measure-validity");
  const hasCurrentIndependentMeasure = Boolean(independentMeasures?.current.length);
  const sourceStatus = source.status;
  if (
    Object.prototype.hasOwnProperty.call(source, "status") &&
    sourceStatus !== "ok" &&
    !(sourceStatus === "stale" && (explicitExpiry !== null || hasCurrentIndependentMeasure))
  ) {
    return no("source-not-current");
  }

  if (
    Object.prototype.hasOwnProperty.call(source, "cacheState") &&
    source.cacheState !== "fresh" &&
    !(["stale", "expired"].includes(source.cacheState) && (explicitExpiry !== null || hasCurrentIndependentMeasure))
  ) {
    return no("source-cache-not-current");
  }

  if (section === "sentimentPulse" && independentMeasures) {
    if (!hasCurrentIndependentMeasure) return no("all-measures-expired");
    const fetchedAt = parsedTime(source.fetchedAt);
    if (fetchedAt === null) return no("missing-retrieval-time");
    if (fetchedAt > nowMs + MAX_CLOCK_SKEW_MS) return no("retrieval-in-future");
    const deadline = Math.min(
      ...independentMeasures.current.map((id) => parsedTime(data.__measureValidity[id].validUntil)),
    );
    return { current: true, reason: "current", deadline };
  }

  const fetchedAt = parsedTime(source.fetchedAt);
  if (fetchedAt === null) return no("missing-retrieval-time");
  if (fetchedAt > nowMs + MAX_CLOCK_SKEW_MS) return no("retrieval-in-future");
  if (explicitExpiry !== null && explicitExpiry <= fetchedAt) return no("expiry-not-after-retrieval");
  // Retrieval age is an operational-health clock. Once a source-owned
  // statistical release has a verified explicit expiry, that publication
  // remains valid until its evidence clock expires even if the next refresh
  // attempt is late or fails. Sections without explicit expiry retain the
  // registry retrieval-age policy.
  if (explicitExpiry === null && nowMs - fetchedAt >= retrievalLimit) return no("retrieval-expired");

  const hasObservation = Object.prototype.hasOwnProperty.call(data, "__observation");
  const sourceOwned = isRecord(source.provenance) && source.provenance.section === section;
  if (!hasObservation && sourceOwned) return no("missing-observation");
  if (hasObservation && !isRecord(data.__observation)) return no("invalid-observation");

  const deadlines = [explicitExpiry !== null ? explicitExpiry : fetchedAt + retrievalLimit];
  const observation = hasObservation ? data.__observation : null;
  if (observation) {
    if (observation.status !== "current") return no("observation-not-current");

    const observedAt = parsedTime(observation.observedAt);
    if (observedAt === null) return no("invalid-observation-time");
    if (explicitExpiry !== null && explicitExpiry <= observedAt) return no("expiry-not-after-observation");

    const maxAge = observationMaxAge(observation);
    if (maxAge === null) return no("invalid-observation-policy");

    if (observedAt > nowMs + MAX_CLOCK_SKEW_MS) return no("observation-in-future");
    if (observedAt > fetchedAt + MAX_CLOCK_SKEW_MS) return no("observation-after-retrieval");
    if (explicitExpiry === null) {
      if (nowMs - observedAt >= maxAge.ms) return no("observation-expired");
      deadlines.push(observedAt + maxAge.days * DAY_MS);
    }
  }

  // A sentimentPulse without per-measure validity is current but has no
  // publishable deadline (preserves the legacy sectionValidityDeadline).
  const deadline = section === "sentimentPulse" ? null : Math.min(...deadlines);
  return { current: true, reason: "current", deadline };
}

function sectionCurrentnessWith(section, data, source, now, limitFor) {
  const { current, reason } = assessSection(section, data, source, now, limitFor(section));
  return { current, reason };
}

function sectionValidityDeadlineWith(section, data, source, now, limitFor) {
  return assessSection(section, data, source, now, limitFor(section)).deadline;
}

function snapshotValidityDeadlineWith(snapshot, now, limitFor) {
  if (!isRecord(snapshot) || !isRecord(snapshot.meta) || !isRecord(snapshot.meta.sources)) {
    return null;
  }

  let earliest = null;
  for (const [section, source] of Object.entries(snapshot.meta.sources)) {
    const deadline = sectionValidityDeadlineWith(section, snapshot[section], source, now, limitFor);
    if (!Number.isFinite(deadline)) return null;
    earliest = earliest === null ? deadline : Math.min(earliest, deadline);
  }
  return earliest;
}

function filterCurrentSnapshotWith(snapshot, now, limitFor) {
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
    if (section === "sentimentPulse" && isRecord(data)) {
      const sourceCurrentness = sectionCurrentnessWith(section, data, source, now, limitFor);
      if (!sourceCurrentness.current) {
        delete filtered[section];
        delete filtered.meta.sources[section];
        continue;
      }
      // `filtered` is already a deep copy, so expired measures are redacted
      // in place rather than cloning the section a second time.
      const independentState = sentimentMeasureState(filtered[section], now.getTime(), true);
      if (!independentState?.valid || independentState.current.length === 0) {
        delete filtered[section];
        delete filtered.meta.sources[section];
      }
      continue;
    }
    const result = sectionCurrentnessWith(section, data, source, now, limitFor);
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

/* ------------------------- publication decisions ------------------------- */

/** @param {string} id @param {PublicationConfig} config */
function publicationDecision(id, config = PUBLICATION_CONFIG) {
  const decision = config?.publications?.[id];
  if (!decision || !PUBLICATION_STATES.includes(decision.state)) return null;
  return decision;
}

/** @param {string} id @param {PublicationConfig} config */
function publicationState(id, config = PUBLICATION_CONFIG) {
  return publicationDecision(id, config)?.state ?? null;
}

/** @param {string} id @param {PublicationConfig} config */
function publicationPublished(id, config = PUBLICATION_CONFIG) {
  return publicationState(id, config) === "published";
}

/** @param {string} id @param {PublicationConfig} config */
function publicationHeld(id, config = PUBLICATION_CONFIG) {
  return publicationState(id, config) === "held";
}

/** @param {string} id @param {PublicationConfig} config */
function publicationRetired(id, config = PUBLICATION_CONFIG) {
  return publicationState(id, config) === "retired";
}

/** Unknown feed ids are held. @returns {Decision} */
function decisionFor(feedId, config = PUBLICATION_CONFIG) {
  return publicationState(feedId, config) ?? "held";
}

/** @param {any} catalog @param {PublicationConfig} config */
function filterPublicationCatalog(catalog, config = PUBLICATION_CONFIG) {
  if (!catalog?.measures) return null;
  return {
    ...catalog,
    measures: Object.fromEntries(
      Object.entries(catalog.measures).filter(([, measure]) => publicationPublished(measure.sourceId, config)),
    ),
  };
}

/** @param {any} summary @param {PublicationConfig} config @param {any} catalog */
function filterPublicationSummary(summary, config = PUBLICATION_CONFIG, catalog = null) {
  const changes = (summary?.changes ?? []).filter((change) =>
    publicationPublished(
      catalog?.measures?.[change.measureId]?.sourceId ??
        definitions.measures.find((measure) => measure.id === change.measureId)?.section ??
        "",
      config,
    )
  );
  return {
    id: summary.id,
    publishedAt: summary.publishedAt,
    ...(summary.asOf ? { asOf: summary.asOf } : {}),
    ...(summary.previousEditionId !== undefined ? { previousEditionId: summary.previousEditionId } : {}),
    ...(changes.length === summary.changes?.length && summary.summaryCorrection
      ? { summaryCorrection: summary.summaryCorrection }
      : {}),
    sourceEditionIds: [...new Set(changes.map((change) => change.nextSourceEditionId))],
    changes,
  };
}

/** @param {any} input @param {PublicationConfig} config */
function filterPublicationSnapshot(input, config = PUBLICATION_CONFIG) {
  if (!input?.meta?.sources) return null;
  const sources = Object.fromEntries(
    Object.entries(input.meta.sources).filter(([id]) => publicationPublished(id, config)),
  );
  if (Object.keys(sources).length === 0) return null;

  const publishedSections = Object.keys(sources).sort();
  const snapshot = {
    meta: {
      registryVersion: input.meta.registryVersion,
      generatedAt: input.meta.generatedAt,
      sources,
      verifiedSections: (input.meta.verifiedSections ?? []).filter((id) => Object.hasOwn(sources, id)),
      measureCatalog: filterPublicationCatalog(input.meta.measureCatalog, config),
      publicProjection: {
        state: "published",
        publishedSections,
      },
      ...(publicationPublished("editionArchive", config) && input.meta.editionSummary
        ? { editionSummary: filterPublicationSummary(input.meta.editionSummary, config, input.meta.measureCatalog) }
        : {}),
    },
  };
  for (const id of publishedSections) {
    if (Object.hasOwn(input, id)) snapshot[id] = structuredClone(input[id]);
  }
  return snapshot;
}

const FILTERED_SNAPSHOT_META_FIELDS = new Set([
  "registryVersion",
  "generatedAt",
  "sources",
  "verifiedSections",
  "measureCatalog",
  "publicProjection",
  "editionSummary",
]);
const FILTERED_SUMMARY_FIELDS = new Set([
  "id",
  "publishedAt",
  "asOf",
  "previousEditionId",
  "summaryCorrection",
  "sourceEditionIds",
  "changes",
]);

/**
 * True when `snapshot` already is a filterPublicationSnapshot output under
 * `config`, so filtering it again would withhold nothing. It inspects keys
 * and identifiers only (no copies), letting the public read path accept a
 * publisher-normalised artifact cheaply. Keep it in step with
 * filterPublicationSnapshot: any field that filter drops or narrows must make
 * this return false when present. False only means "filter a copy".
 *
 * @param {any} snapshot @param {PublicationConfig} config
 */
function isPublicationFilteredSnapshot(snapshot, config = PUBLICATION_CONFIG) {
  const meta = snapshot?.meta;
  if (!meta?.sources || typeof meta.sources !== "object") return false;
  for (const key of Object.keys(meta)) {
    if (!FILTERED_SNAPSHOT_META_FIELDS.has(key)) return false;
  }
  for (const key of Object.keys(snapshot)) {
    if (key !== "meta" && !Object.hasOwn(meta.sources, key)) return false;
  }
  const sourceIds = Object.keys(meta.sources);
  if (sourceIds.length === 0 || sourceIds.some((id) => !publicationPublished(id, config))) return false;
  if (!Array.isArray(meta.verifiedSections) || meta.verifiedSections.some((id) => !Object.hasOwn(meta.sources, id))) {
    return false;
  }
  const catalog = meta.measureCatalog;
  if (catalog !== null) {
    if (!catalog?.measures || typeof catalog.measures !== "object") return false;
    if (Object.values(catalog.measures).some((measure) => !publicationPublished(measure?.sourceId, config))) {
      return false;
    }
  }
  if (Object.hasOwn(meta, "editionSummary")) {
    const summary = meta.editionSummary;
    if (!publicationPublished("editionArchive", config) || !summary || !Array.isArray(summary.changes)) return false;
    if (Object.keys(summary).some((key) => !FILTERED_SUMMARY_FIELDS.has(key))) return false;
    const changesPublished = summary.changes.every((change) =>
      publicationPublished(
        catalog?.measures?.[change?.measureId]?.sourceId ??
          definitions.measures.find((measure) => measure.id === change?.measureId)?.section ??
          "",
        config,
      )
    );
    if (!changesPublished) return false;
  }
  return true;
}

/* ------------------------------ public API ------------------------------- */

const SHAPE_REASONS = new Set([
  "invalid-record", "missing-policy", "invalid-expiry", "invalid-measure-validity",
  "missing-retrieval-time", "expiry-not-after-retrieval", "missing-observation",
  "invalid-observation", "invalid-observation-time", "expiry-not-after-observation",
  "invalid-observation-policy",
]);
const OBSERVATION_REASONS = new Set(["explicit-expiry", "observation-expired", "all-measures-expired"]);
const SKEW_REASONS = new Set(["retrieval-in-future", "observation-in-future", "observation-after-retrieval"]);

/** @returns {UnavailableReason} */
function unavailableReason(detail) {
  if (SHAPE_REASONS.has(detail)) return "shape";
  if (detail === "retrieval-expired") return "retrieval-expired";
  if (OBSERVATION_REASONS.has(detail)) return "observation-expired";
  if (SKEW_REASONS.has(detail)) return "clock-skew";
  return "not-current";
}

/**
 * The only function that turns clocks into availability. Order: decision
 * (held wins), then record presence, shape, retrieval age, observation
 * validity. now >= validUntil is unavailable.
 *
 * @param {{id:string, requirement?:string, validity:{retrievalMaxAgeMs:number}}} feed
 * @param {any} record inner verified section record, or null
 * @param {Decision} decision
 * @param {Date} now
 * @returns {Verdict}
 */
function evaluate(feed, record, decision, now) {
  if (decision === "held") return { state: "held", reason: "held", validUntil: null };
  if (decision !== "published") return { state: "unavailable", reason: "held", validUntil: null };
  if (!isRecord(record)) return { state: "unavailable", reason: "no-record", validUntil: null };

  const result = assessSection(feed.id, record.data, record.source, now, feed.validity?.retrievalMaxAgeMs);
  if (!result.current) {
    return { state: "unavailable", reason: unavailableReason(result.reason), validUntil: null };
  }
  return {
    state: "current",
    reason: null,
    validUntil: Number.isFinite(result.deadline) ? new Date(result.deadline).toISOString() : null,
  };
}

/**
 * Current, published projection of an internal edition. snapshot is null when
 * no feed is current; callers render unavailable and never fall back to older data.
 */
// Registry-bound entry points: the retrieval limit comes from the source catalog.
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

// The instant after which filterCurrentSnapshot drops the section, or null
// when it is not current now. It equals sectionValidityDeadline except for
// sentimentPulse, which stays (with expired measures redacted) while any of
// its independently dated measures is current.
function sectionPresenceDeadline(section, data, source, now = new Date()) {
  if (!sectionCurrentness(section, data, source, now).current) return null;
  if (section === "sentimentPulse") {
    const state = sentimentMeasureState(data, now.getTime());
    if (state) {
      if (!state.valid || state.current.length === 0) return null;
      const latest = Math.max(
        ...state.current.map((id) => parsedTime(data.__measureValidity[id].validUntil))
      );
      const explicitExpiry = parsedTime(data.expiresAt);
      return explicitExpiry === null ? latest : Math.min(explicitExpiry, latest);
    }
  }
  return sectionValidityDeadline(section, data, source, now);
}

// True when filterCurrentSnapshot(snapshot, now) would return the snapshot
// unchanged: no undeclared sections, every declared section current, verified
// sections all declared and no sentiment measure awaiting redaction. Lets the
// public read path serve an already-normalised artifact without a deep copy;
// it never relaxes currentness, because any doubt returns false and the caller
// then filters a copy.
function snapshotIsCurrentAsIs(snapshot, now = new Date()) {
  if (!isRecord(snapshot) || !isRecord(snapshot.meta) || !isRecord(snapshot.meta.sources)) {
    return false;
  }
  const sources = snapshot.meta.sources;
  const sectionIds = Object.keys(sources);
  if (sectionIds.length === 0) return false;
  for (const key of Object.keys(snapshot)) {
    if (key !== "meta" && !Object.prototype.hasOwnProperty.call(sources, key)) return false;
  }
  if (
    snapshot.meta.verifiedSections !== undefined &&
    (!Array.isArray(snapshot.meta.verifiedSections) ||
      snapshot.meta.verifiedSections.some(
        (section) => typeof section !== "string" || !Object.prototype.hasOwnProperty.call(sources, section)
      ))
  ) {
    return false;
  }
  const nowMs = now.getTime();
  for (const section of sectionIds) {
    const data = snapshot[section];
    if (!sectionCurrentness(section, data, sources[section], now).current) return false;
    if (section !== "sentimentPulse") continue;
    const state = sentimentMeasureState(data, nowMs);
    if (!state) continue;
    if (!state.valid || state.current.length === 0) return false;
    for (const [id, series] of Object.entries(data.series)) {
      if (state.current.includes(id) || !SENTIMENT_MEASURE_IDS.includes(id)) continue;
      // An unusable measure must already carry its redacted form.
      if (
        series.status !== "expired" ||
        series.value !== null ||
        !Object.prototype.hasOwnProperty.call(series, "annualDelta") ||
        series.annualDelta !== null
      ) {
        return false;
      }
    }
  }
  return true;
}

function currentSectionRecord(record, now = new Date()) {
  if (!isRecord(record) || typeof record.section !== "string") return false;
  return sectionCurrentness(record.section, record.data, record.source, now).current;
}

// Source-status predicates, so no caller spells out the status vocabulary.
/**
 * status is "ok" or "stale": the source carries a usable snapshot section.
 * @template {{status?: unknown}} T
 * @param {T|null|undefined} source
 * @returns {source is T}
 */
function sourceHasUsableStatus(source) {
  return Boolean(source) && (source.status === "ok" || source.status === "stale");
}

/**
 * status is exactly "ok".
 * @template {{status?: unknown}} T
 * @param {T|null|undefined} source
 * @returns {source is T}
 */
function sourceStatusOk(source) {
  return Boolean(source) && source.status === "ok";
}

/**
 * A present source whose status is not "ok" or whose cache is not "fresh".
 * @param {{status?: unknown, cacheState?: unknown}} source
 */
function sourceUpdateDue(source) {
  return source.status !== "ok" || source.cacheState !== "fresh";
}

function projectPublic(edition, now, config = PUBLICATION_CONFIG) {
  const current = filterCurrentSnapshotWith(edition, now, retrievalMaxAgeMsForSection);
  const snapshot = filterPublicationSnapshot(current, config);
  if (snapshot === null) return { snapshot: null, validUntil: null };
  const deadline = snapshotValidityDeadlineWith(snapshot, now, retrievalMaxAgeMsForSection);
  return {
    snapshot,
    validUntil: Number.isFinite(deadline) ? new Date(deadline).toISOString() : null,
  };
}

/**
 * Gate evaluation for a route manifest entry.
 * @param {{path:string, kind:string, feeds:string[], gate:string}} route
 * @param {Date} now
 * @param {Record<string, Verdict>} verdicts
 */
function routeAccess(route, _now, verdicts) {
  const currentOf = (id) => verdicts?.[id]?.state === "current";
  switch (route?.gate) {
    case "none":
      return "serve";
    case "any-published":
      return route.feeds.some(currentOf) ? "serve" : "unavailable";
    case "all-of":
      return route.feeds.length > 0 && route.feeds.every(currentOf) ? "serve" : "unavailable";
    case "product":
      return "serve";
    default:
      return "not-found";
  }
}

export {
  DAY_MS,
  HOUR_MS,
  ISO_UTC_INSTANT,
  MAX_CLOCK_SKEW_MS,
  PUBLICATION_CONFIG,
  PUBLICATION_STATES,
  SENTIMENT_MEASURE_IDS,
  assessSection,
  cacheLifetime,
  currentSectionRecord,
  decisionFor,
  evaluate,
  filterCurrentSnapshot,
  filterCurrentSnapshotWith,
  filterPublicationCatalog,
  filterPublicationSnapshot,
  filterPublicationSummary,
  isPublicationFilteredSnapshot,
  isRecord,
  observationExpiryMs,
  observationMaxAge,
  observationOutsideContract,
  parsedTime,
  projectPublic,
  publicationDecision,
  publicationHeld,
  publicationPublished,
  publicationRetired,
  publicationState,
  retrievalMaxAgeMsForSection,
  routeAccess,
  sectionCurrentness,
  sectionCurrentnessWith,
  sectionPresenceDeadline,
  sectionValidityDeadline,
  sectionValidityDeadlineWith,
  snapshotIsCurrentAsIs,
  snapshotValidityDeadline,
  snapshotValidityDeadlineWith,
  sourceHasUsableStatus,
  sourceStatusOk,
  sourceUpdateDue,
};
