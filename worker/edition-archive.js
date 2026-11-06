import { validateMeasureRecord } from "../contracts/measure-record.js";
import { catalogRevisionIdentity } from "./measure-catalog.js";
import { buildEditionSummary } from "./edition-summary.js";

const EDITION_SUMMARY_PREFIX = "v1:edition:summary:";
const EDITION_SUMMARY_CORRECTION_PREFIX = "v1:edition:summary-correction:";
const EDITION_CONTENT_PREFIX = "v1:edition:content:";
const EDITION_INDEX_KEY = "v1:edition:index";
const EDITION_SUMMARY_RETENTION = 60;
const MAX_EDITION_BYTES = 2 * 1024 * 1024;
const MAX_INDEX_BYTES = 512 * 1024;
const MAX_EDITION_CHANGES = 5_000;
const EDITION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validInstant(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function validOptionalText(value) {
  return value === undefined || value === null || typeof value === "string" && Boolean(value.trim()) && value.length <= 1000;
}

function validOptionalSourceUrl(value) {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

function validateEditionId(id) {
  if (typeof id !== "string" || !EDITION_ID.test(id)) throw new Error("Edition id is invalid");
  return id;
}

function validateCatalog(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || input.schemaVersion !== 2 || !validInstant(input.generatedAt) || !(input.validUntil === null || validInstant(input.validUntil)) || !input.measures || typeof input.measures !== "object" || Array.isArray(input.measures)) {
    throw new Error("Archived measure catalog is invalid");
  }
  const id = validateEditionId(input.editionId);
  const measures = {};
  for (const [key, raw] of Object.entries(input.measures)) {
    const measure = validateMeasureRecord(raw);
    if (key !== measure.id) throw new Error("Archived measure key and id do not match");
    measures[key] = measure;
  }
  return { schemaVersion: 2, editionId: id, generatedAt: input.generatedAt, validUntil: input.validUntil, measures };
}

function validateSummary(input, editionId) {
  if (!input || typeof input !== "object" || input.id !== editionId || !validInstant(input.publishedAt) ||
    !(input.previousEditionId === undefined || input.previousEditionId === null || EDITION_ID.test(input.previousEditionId)) ||
    !Array.isArray(input.sourceEditionIds) || input.sourceEditionIds.length > 100 || !Array.isArray(input.changes) || input.changes.length > MAX_EDITION_CHANGES) {
    throw new Error("Edition summary is invalid");
  }
  const sourceEditionIds = input.sourceEditionIds.map((value) => {
    if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error("Edition source identity is invalid");
    return value;
  });
  const changes = input.changes.map((change) => {
    if (!change || typeof change !== "object" || typeof change.measureId !== "string" || !change.measureId.trim() || !["new-observation", "revision", "method-change", "metadata-change"].includes(change.kind) || !(change.observedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(change.observedAt)) || !(change.period === null || typeof change.period === "string") || !(change.previous === null || Number.isFinite(change.previous)) || !(change.next === null || Number.isFinite(change.next)) || typeof change.nextSourceEditionId !== "string" || !change.nextSourceEditionId.trim() ||
      !(change.previousSourcePublishedAt === undefined || change.previousSourcePublishedAt === null || validInstant(change.previousSourcePublishedAt)) || !(change.nextSourcePublishedAt === undefined || validInstant(change.nextSourcePublishedAt)) ||
      !validOptionalSourceUrl(change.previousSourceUrl) || !validOptionalSourceUrl(change.nextSourceUrl) || !validOptionalText(change.previousUnit) || !validOptionalText(change.nextUnit) ||
      !(change.changedFields === undefined || Array.isArray(change.changedFields) && change.changedFields.length <= 20 && change.changedFields.every((field) => typeof field === "string" && /^[A-Za-z][A-Za-z0-9.]{0,79}$/.test(field)))) throw new Error("Edition summary change is invalid");
    return { ...change };
  });
  const summaryCorrection = input.summaryCorrection;
  if (summaryCorrection !== undefined && (
    !summaryCorrection ||
    summaryCorrection.kind !== "baseline-reconciliation" ||
    !EDITION_ID.test(summaryCorrection.baselineEditionId) ||
    summaryCorrection.baselineEditionId === editionId ||
    typeof summaryCorrection.note !== "string" ||
    !summaryCorrection.note.trim() ||
    summaryCorrection.note.length > 500 ||
    input.previousEditionId !== summaryCorrection.baselineEditionId
  )) throw new Error("Edition summary correction is invalid");
  return {
    id: editionId,
    publishedAt: input.publishedAt,
    ...(input.previousEditionId === undefined ? {} : { previousEditionId: input.previousEditionId }),
    ...(summaryCorrection === undefined ? {} : { summaryCorrection: { ...summaryCorrection } }),
    sourceEditionIds: [...new Set(sourceEditionIds)].sort(),
    changes,
  };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readIndex(env) {
  const index = await env.METRICS_CACHE.get(EDITION_INDEX_KEY, "json");
  if (index === null) return [];
  if (!Array.isArray(index) || index.length > EDITION_SUMMARY_RETENTION || index.some((entry) => !entry || typeof entry.id !== "string" || typeof entry.contentHash !== "string" || !entry.summary || entry.asOf !== undefined && !validInstant(entry.asOf))) throw new Error("Edition index is invalid");
  return index;
}

function listedSummary(entry) {
  const id = validateEditionId(entry.id);
  const original = validateSummary(entry.summary, id);
  if (original.previousEditionId || original.summaryCorrection || entry.correctedSummary === undefined) return original;
  const corrected = validateSummary(entry.correctedSummary, id);
  return corrected.summaryCorrection?.kind === "baseline-reconciliation" && corrected.previousEditionId === corrected.summaryCorrection.baselineEditionId ? corrected : original;
}

async function writeIndex(env, entries) {
  const encoded = stableStringify(entries);
  if (new TextEncoder().encode(encoded).byteLength > MAX_INDEX_BYTES) throw new Error("Edition index exceeds the configured byte limit");
  await env.METRICS_CACHE.put(EDITION_INDEX_KEY, encoded, { metadata: { editionCount: entries.length } });
}

async function retainIndex(env, entries) {
  const datedEntries = await Promise.all(entries.map(async (entry) => {
    if (validInstant(entry.asOf)) return entry;
    const archived = await readEditionRaw(env, entry.id, entries);
    return archived ? { ...entry, asOf: archived.asOf } : entry;
  }));
  const ordered = datedEntries.toSorted((left, right) =>
    (right.asOf ?? right.summary.publishedAt).localeCompare(left.asOf ?? left.summary.publishedAt) ||
    right.summary.publishedAt.localeCompare(left.summary.publishedAt) ||
    right.id.localeCompare(left.id)
  );
  const retained = ordered.slice(0, EDITION_SUMMARY_RETENTION);
  const retainedHashes = new Set(retained.map((entry) => entry.contentHash));
  await writeIndex(env, retained);
  for (const expired of ordered.slice(EDITION_SUMMARY_RETENTION)) {
    await env.METRICS_CACHE.delete(`${EDITION_SUMMARY_PREFIX}${expired.id}`);
    await env.METRICS_CACHE.delete(`${EDITION_SUMMARY_CORRECTION_PREFIX}${expired.id}`);
    if (!retainedHashes.has(expired.contentHash)) await env.METRICS_CACHE.delete(`${EDITION_CONTENT_PREFIX}${expired.contentHash}`);
  }
  return retained;
}

async function archiveEdition(env, catalogInput, summaryInput) {
  if (!env?.METRICS_CACHE?.put || !env?.METRICS_CACHE?.get || !env?.METRICS_CACHE?.getWithMetadata || !env?.METRICS_CACHE?.delete) throw new Error("METRICS_CACHE archive operations are required");
  const catalog = validateCatalog(catalogInput);
  const id = validateEditionId(catalog.editionId);
  const summary = validateSummary(summaryInput, id);
  const content = stableStringify(catalog);
  if (new TextEncoder().encode(content).byteLength > MAX_EDITION_BYTES) throw new Error("Archived edition exceeds the configured byte limit");
  const contentHash = await sha256(content);
  const fingerprint = catalogRevisionIdentity(catalog.measures);
  const summaryKey = `${EDITION_SUMMARY_PREFIX}${id}`;
  const contentKey = `${EDITION_CONTENT_PREFIX}${contentHash}`;
  const index = await readIndex(env);
  const indexed = index.find((entry) => entry.id === id);
  // Older editions kept their identity in a per-edition summary key; read it only to confirm identity, never to write it.
  const legacy = indexed && typeof indexed.fingerprint === "string" ? null : await env.METRICS_CACHE.getWithMetadata(summaryKey, "json");
  const knownFingerprint = indexed?.fingerprint ?? legacy?.metadata?.fingerprint;
  if (indexed) {
    if (knownFingerprint === fingerprint || knownFingerprint === undefined && indexed.contentHash === contentHash) {
      return { archived: false, duplicate: true, id, contentHash: indexed.contentHash, retained: index.length };
    }
    throw new Error("An archived edition id cannot be rewritten");
  }
  if (legacy?.value) {
    if (legacy.metadata?.fingerprint === fingerprint) {
      const archivedHash = legacy.metadata.contentHash;
      const archivedSummary = validateSummary(legacy.value.summary, id);
      const fixed = await retainIndex(env, [...index, { id, contentHash: archivedHash, fingerprint, summary: archivedSummary }]);
      return { archived: false, duplicate: true, id, contentHash: archivedHash, retained: fixed.length };
    }
    throw new Error("An archived edition id cannot be rewritten");
  }
  const contentExisting = await env.METRICS_CACHE.get(contentKey, "text");
  if (contentExisting && contentExisting !== content) throw new Error("Content-addressed edition hash collision");
  if (!contentExisting) {
    await env.METRICS_CACHE.put(contentKey, content, { metadata: { contentHash, schemaVersion: 2 } });
    const stored = await env.METRICS_CACHE.get(contentKey, "text");
    if (stored !== content || await sha256(stored) !== contentHash) throw new Error("Archived edition content hash mismatch; the edition was not indexed");
  }
  const retained = await retainIndex(env, [...index, { id, contentHash, fingerprint, summary, asOf: catalog.generatedAt }]);
  return { archived: true, duplicate: false, id, contentHash, retained: retained.length };
}

async function readEditionRaw(env, id, preloadedIndex) {
  validateEditionId(id);
  if (!env?.METRICS_CACHE?.getWithMetadata || !env?.METRICS_CACHE?.get) return null;
  const indexed = (preloadedIndex ?? await readIndex(env)).find((entry) => entry.id === id);
  // Editions archived before the index carried their identity fall back to the per-edition summary key.
  const record = indexed ? { value: { summary: indexed.summary }, metadata: { contentHash: indexed.contentHash } } : await env.METRICS_CACHE.getWithMetadata(`${EDITION_SUMMARY_PREFIX}${id}`, "json");
  const contentHash = record?.metadata?.contentHash;
  if (typeof contentHash !== "string" || !/^[a-f0-9]{64}$/.test(contentHash) || !record.value?.summary) return null;
  const content = await env.METRICS_CACHE.get(`${EDITION_CONTENT_PREFIX}${contentHash}`, "text");
  if (typeof content !== "string" || await sha256(content) !== contentHash) return null;
  try {
    const catalog = validateCatalog(JSON.parse(content));
    const summary = validateSummary(record.value.summary, id);
    if (catalog.editionId !== id) return null;
    return { catalog, summary, asOf: catalog.generatedAt, contentHash };
  } catch { return null; }
}

async function readSummaryCorrection(env, archived) {
  if (!env?.METRICS_CACHE?.getWithMetadata) return null;
  let stored;
  try {
    stored = await env.METRICS_CACHE.getWithMetadata(
      `${EDITION_SUMMARY_CORRECTION_PREFIX}${archived.summary.id}`,
      "json",
    );
  } catch {
    return null;
  }
  const correction = stored?.value;
  if (!correction || correction.schemaVersion !== 1 || correction.editionId !== archived.summary.id ||
    correction.editionContentHash !== archived.contentHash ||
    !/^[a-f0-9]{64}$/.test(correction.originalSummaryHash ?? "") ||
    correction.originalSummaryHash !== await sha256(stableStringify(archived.summary)) ||
    !EDITION_ID.test(correction.baselineEditionId ?? "") || correction.baselineEditionId === correction.editionId ||
    !/^[a-f0-9]{64}$/.test(correction.baselineContentHash ?? "")) return null;
  try {
    const summary = validateSummary(correction.summary, archived.summary.id);
    if (summary.previousEditionId !== correction.baselineEditionId ||
      summary.summaryCorrection?.kind !== "baseline-reconciliation" ||
      summary.summaryCorrection?.baselineEditionId !== correction.baselineEditionId) return null;
    return summary;
  } catch { return null; }
}

async function readEdition(env, id) {
  const archived = await readEditionRaw(env, id);
  if (!archived) return null;
  if (archived.summary.previousEditionId || archived.summary.summaryCorrection) return archived;
  const correctedSummary = await readSummaryCorrection(env, archived);
  return correctedSummary ? { ...archived, summary: correctedSummary } : archived;
}

// The list reads only the index, so a validated correction is mirrored there. The original summary stays untouched.
async function mirrorCorrectionInIndex(env, index, id, correctedSummary) {
  const entry = index.find((candidate) => candidate.id === id);
  if (!entry || stableStringify(entry.correctedSummary ?? null) === stableStringify(correctedSummary)) return;
  await writeIndex(env, index.map((candidate) => candidate.id === id ? { ...candidate, correctedSummary } : candidate));
}

async function reconcileEditionSummaryFromRetainedPrior(env, id) {
  validateEditionId(id);
  if (!env?.METRICS_CACHE?.getWithMetadata || !env?.METRICS_CACHE?.get || !env?.METRICS_CACHE?.put) {
    throw new Error("METRICS_CACHE summary reconciliation operations are required");
  }

  const index = await readIndex(env);
  const archived = await readEditionRaw(env, id, index);
  if (!archived) return { corrected: false, duplicate: false, summary: null };
  if (archived.summary.previousEditionId || archived.summary.summaryCorrection) {
    return { corrected: false, duplicate: Boolean(archived.summary.summaryCorrection), summary: archived.summary };
  }
  const existingCorrection = await readSummaryCorrection(env, archived);
  if (existingCorrection) {
    await mirrorCorrectionInIndex(env, index, id, existingCorrection);
    return { corrected: false, duplicate: true, summary: existingCorrection };
  }
  if (archived.summary.previousEditionId) {
    return { corrected: false, duplicate: false, summary: archived.summary };
  }

  let prior = null;
  for (const entry of index) {
    if (entry.id === id) continue;
    const candidate = await readEditionRaw(env, entry.id, index);
    if (candidate && Date.parse(candidate.asOf) < Date.parse(archived.asOf) &&
      (!prior || Date.parse(candidate.asOf) > Date.parse(prior.asOf))) {
      prior = candidate;
    }
  }
  if (!prior) return { corrected: false, duplicate: false, summary: archived.summary };

  const originalSummaryHash = await sha256(stableStringify(archived.summary));
  const correctedSummary = {
    ...buildEditionSummary(prior.catalog, archived.catalog),
    summaryCorrection: {
      kind: "baseline-reconciliation",
      baselineEditionId: prior.catalog.editionId,
      note: "The change summary was reconciled against an earlier retained edition; archived observations were not changed.",
    },
  };
  const summary = validateSummary(correctedSummary, id);
  const correction = {
    schemaVersion: 1,
    editionId: id,
    editionContentHash: archived.contentHash,
    originalSummaryHash,
    baselineEditionId: prior.catalog.editionId,
    baselineContentHash: prior.contentHash,
    summary,
  };
  const correctionKey = `${EDITION_SUMMARY_CORRECTION_PREFIX}${id}`;
  const existing = await env.METRICS_CACHE.getWithMetadata(correctionKey, "json");
  if (existing?.value) {
    const existingSummary = await readSummaryCorrection(env, archived);
    if (existingSummary && stableStringify(existingSummary) === stableStringify(summary)) {
      await mirrorCorrectionInIndex(env, index, id, existingSummary);
      return { corrected: false, duplicate: true, summary: existingSummary };
    }
    throw new Error("A corrected edition summary cannot be rewritten");
  }
  await env.METRICS_CACHE.put(correctionKey, JSON.stringify(correction), {
    metadata: {
      editionId: id,
      baselineEditionId: prior.catalog.editionId,
      editionContentHash: archived.contentHash,
      schemaVersion: 1,
    },
  });
  await mirrorCorrectionInIndex(env, index, id, summary);
  return { corrected: true, duplicate: false, summary };
}

async function reconcileRetainedEditionSummaries(env, currentId) {
  validateEditionId(currentId);
  const index = await readIndex(env);
  const reconciledIds = [];
  for (const entry of index) {
    if (entry.id === currentId) continue;
    const summary = validateSummary(entry.summary, entry.id);
    if (summary.previousEditionId) continue;
    const result = await reconcileEditionSummaryFromRetainedPrior(env, entry.id);
    if (result.corrected) reconciledIds.push(entry.id);
  }
  const current = await reconcileEditionSummaryFromRetainedPrior(env, currentId);
  if (current.corrected) reconciledIds.push(currentId);
  return { reconciledIds, summary: current.summary };
}

async function listEditionSummaries(env, limit = EDITION_SUMMARY_RETENTION) {
  if (!env?.METRICS_CACHE?.get) return [];
  if (!Number.isInteger(limit) || limit < 1 || limit > EDITION_SUMMARY_RETENTION) throw new Error("Edition summary limit is invalid");
  // One KV read. The index entry carries the validated summary and archive time; the content is not re-hashed per request.
  const index = await readIndex(env);
  const editions = [];
  for (const entry of index) {
    try {
      editions.push({ summary: listedSummary(entry), asOf: validInstant(entry.asOf) ? entry.asOf : undefined });
    } catch { /* an invalid entry is not advertised */ }
  }
  return editions
    .toSorted((left, right) =>
      (right.asOf ?? right.summary.publishedAt).localeCompare(left.asOf ?? left.summary.publishedAt) ||
      right.summary.publishedAt.localeCompare(left.summary.publishedAt) ||
      right.summary.id.localeCompare(left.summary.id))
    .slice(0, limit)
    .map(({ summary, asOf }) => ({ ...summary, ...(asOf ? { asOf } : {}) }));
}

export {
  EDITION_CONTENT_PREFIX,
  EDITION_INDEX_KEY,
  EDITION_ID,
  EDITION_SUMMARY_PREFIX,
  EDITION_SUMMARY_CORRECTION_PREFIX,
  EDITION_SUMMARY_RETENTION,
  archiveEdition,
  listEditionSummaries,
  readEdition,
  reconcileEditionSummaryFromRetainedPrior,
  reconcileRetainedEditionSummaries,
  validateCatalog,
  validateEditionId,
  validateSummary,
};
