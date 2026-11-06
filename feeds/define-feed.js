// Feed definition schema (target design section 2.2).
//
// A definition is a plain declaration: it owns the feed's identity, evidence
// metadata, cadence, validity contract, measures, downloads and release titles.
// Everything the hand-written registries used to repeat is projected from it by
// feeds/registry.js. Publication state (published / held / retired) is
// deliberately NOT part of a definition: it lives only in
// config/publications.json, so an unknown feed still fails closed.
//
// This module is pure and isomorphic. It imports only the source definitions
// (not source-catalog.js) so contracts/source-catalog.js can project feeds
// without an import cycle.
import { SOURCE_CATALOG, deepFreeze } from "../contracts/source-definitions.js";

const ID = /^[a-z][A-Za-z0-9]*$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLLECT_CADENCES = new Set(["daily", "3h", "weekly"]);
const REQUIREMENTS = new Set(["required", "optional", "independent"]);
const AUTOMATION = new Set(["automated", "static", "interactive", "withdrawn"]);
const JOB_TYPES = new Set(["refresh-section", "refresh-external-section"]);
const PUBLICATION_STATE_KEYS = ["publication", "publicationState", "published", "decision", "held", "retired"];
const KNOWN_KEYS = new Set([
  "id", "slug", "title", "displayName", "description", "category", "evidenceClass", "geography", "editorial",
  "sources", "automation", "collectionLayer", "retrieval", "cadence", "collection", "validity", "requirement",
  "measures", "downloads", "releaseTitles", "discovery", "view",
]);

function fail(id, message) {
  throw new Error(`Feed '${id}': ${message}`);
}

function text(id, def, key) {
  if (typeof def[key] !== "string" || !def[key].trim()) fail(id, `${key} is required`);
}

function regexSource(id, value, label) {
  try {
    new RegExp(value);
  } catch {
    fail(id, `${label} is not a valid regular expression`);
  }
}

/**
 * @param {Record<string, any>} def
 * @returns {Readonly<Record<string, any>>}
 */
export function defineFeed(def) {
  if (!def || typeof def !== "object") throw new Error("Feed definition must be an object");
  const id = def.id;
  if (typeof id !== "string" || !ID.test(id)) throw new Error(`Feed id '${String(id)}' must be camelCase`);
  for (const key of PUBLICATION_STATE_KEYS) {
    if (Object.hasOwn(def, key)) fail(id, `'${key}' is publication state; it belongs only in config/publications.json`);
  }
  for (const key of Object.keys(def)) {
    if (!KNOWN_KEYS.has(key)) fail(id, `unknown field '${key}'`);
  }
  if (typeof def.slug !== "string" || !SLUG.test(def.slug)) fail(id, `slug '${String(def.slug)}' must be kebab-case`);
  for (const key of ["title", "displayName", "description", "category", "evidenceClass", "retrieval"]) text(id, def, key);
  if (!def.geography || typeof def.geography.code !== "string" || typeof def.geography.label !== "string") {
    fail(id, "geography {code, label} is required");
  }
  const editorial = def.editorial;
  for (const key of ["publicationPeriod", "unit", "revisionStatus", "caveat"]) {
    if (typeof editorial?.[key] !== "string" || !editorial[key].trim()) fail(id, `editorial.${key} is required`);
  }

  if (!Array.isArray(def.sources) || def.sources.length === 0 || new Set(def.sources).size !== def.sources.length) {
    fail(id, "sources must be a non-empty unique array of source ids");
  }
  for (const sourceId of def.sources) {
    if (!Object.hasOwn(SOURCE_CATALOG, sourceId)) fail(id, `references unknown source '${sourceId}' (not in SOURCE_CATALOG)`);
  }

  if (!AUTOMATION.has(def.automation)) fail(id, "automation is invalid");
  if (def.collectionLayer !== "worker" && def.collectionLayer !== "publication") fail(id, "collectionLayer is invalid");

  const cadence = def.cadence;
  if (!cadence || !COLLECT_CADENCES.has(cadence.collect)) fail(id, "cadence.collect must be daily, 3h or weekly");
  for (const key of ["publication", "frequency"]) {
    if (typeof cadence[key] !== "string" || !cadence[key].trim()) fail(id, `cadence.${key} is required`);
  }

  if (!JOB_TYPES.has(def.collection?.jobType) || typeof def.collection?.collector !== "string") {
    fail(id, "collection {jobType, collector} is required");
  }

  const validity = def.validity;
  if (!validity || typeof validity !== "object") fail(id, "validity is required");
  if (!Number.isFinite(validity.retrievalMaxAgeMs) || validity.retrievalMaxAgeMs <= 0) {
    fail(id, "validity.retrievalMaxAgeMs must be a positive number");
  }
  const windows = ["observationMaxAgeDays", "maxAgeHours", "explicitExpiry"].filter((key) => validity[key] !== undefined);
  if (windows.length !== 1) fail(id, "validity needs exactly one of observationMaxAgeDays, maxAgeHours or explicitExpiry");
  if (windows[0] !== "explicitExpiry" && !(validity[windows[0]] > 0)) fail(id, `validity.${windows[0]} must be positive`);
  if (typeof validity.extractor !== "string" || !validity.extractor) fail(id, "validity.extractor is required");

  if (!REQUIREMENTS.has(def.requirement)) fail(id, "requirement must be required, optional or independent");

  if (!Array.isArray(def.measures)) fail(id, "measures must be an array");
  for (const measure of def.measures) {
    if (typeof measure?.id !== "string" || !measure.id) fail(id, "every measure needs an id");
    if (measure.section !== id) fail(id, `measure '${measure.id}' section must equal the feed id`);
  }

  const downloads = def.downloads;
  if (!downloads || typeof downloads.json !== "boolean" || typeof downloads.csv !== "boolean") {
    fail(id, "downloads {json, csv, geography} is required");
  }
  if (typeof downloads.geography !== "string" || !downloads.geography) fail(id, "downloads.geography is required");

  if (!Array.isArray(def.releaseTitles)) fail(id, "releaseTitles must be an array");
  for (const title of def.releaseTitles) {
    regexSource(id, title.pattern, "releaseTitles pattern");
    if (title.exclude !== undefined) regexSource(id, title.exclude, "releaseTitles exclude");
  }

  const discovery = def.discovery;
  if (typeof discovery?.title !== "string" || discovery.kind !== "dataset" || !Array.isArray(discovery.sameAs)) {
    fail(id, "discovery {title, kind, sameAs} is required");
  }
  text(id, def, "view");

  return deepFreeze(structuredClone(def));
}

/**
 * The legacy contracts/source-catalog.js FEED_CATALOG entry for a definition.
 * Pure; shared by source-catalog.js (which owns the legacy catalogue) and
 * feeds/registry.js so the two can never disagree.
 */
export function catalogEntryOf(def) {
  return {
    id: def.id,
    registry: "feed",
    title: def.title,
    displayName: def.displayName,
    evidenceClass: def.evidenceClass,
    geography: { ...def.geography },
    sourceIds: [...def.sources],
    automation: def.automation,
    collectionLayer: def.collectionLayer,
    frequency: def.cadence.frequency,
    retrieval: def.retrieval,
    refreshCadence: def.cadence.collect,
    publicationCadence: def.cadence.publication,
    retrievalMaxAgeMs: def.validity.retrievalMaxAgeMs,
    publicationRequirement: def.requirement,
    ...(def.validity.freshnessWindow ? { freshnessWindow: def.validity.freshnessWindow } : {}),
    ...(def.validity.freshnessRationale ? { freshnessRationale: def.validity.freshnessRationale } : {}),
    editorial: { ...def.editorial },
  };
}
