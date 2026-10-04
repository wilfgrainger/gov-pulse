import { validateMeasureRecord } from "../contracts/measure-record.js";
import { catalogRevisionIdentity } from "./measure-catalog.js";

const EDITION_SUMMARY_PREFIX = "v1:edition:summary:";
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
  return {
    id: editionId,
    publishedAt: input.publishedAt,
    ...(input.previousEditionId === undefined ? {} : { previousEditionId: input.previousEditionId }),
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
  if (!Array.isArray(index) || index.length > EDITION_SUMMARY_RETENTION || index.some((entry) => !entry || typeof entry.id !== "string" || typeof entry.contentHash !== "string" || !entry.summary)) throw new Error("Edition index is invalid");
  return index;
}

async function writeIndex(env, entries) {
  const encoded = stableStringify(entries);
  if (new TextEncoder().encode(encoded).byteLength > MAX_INDEX_BYTES) throw new Error("Edition index exceeds the configured byte limit");
  await env.METRICS_CACHE.put(EDITION_INDEX_KEY, encoded, { metadata: { editionCount: entries.length } });
}

async function retainIndex(env, entries) {
  const ordered = entries.toSorted((left, right) => right.summary.publishedAt.localeCompare(left.summary.publishedAt) || right.id.localeCompare(left.id));
  const retained = ordered.slice(0, EDITION_SUMMARY_RETENTION);
  const retainedHashes = new Set(retained.map((entry) => entry.contentHash));
  await writeIndex(env, retained);
  for (const expired of ordered.slice(EDITION_SUMMARY_RETENTION)) {
    await env.METRICS_CACHE.delete(`${EDITION_SUMMARY_PREFIX}${expired.id}`);
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
  const existing = await env.METRICS_CACHE.getWithMetadata(summaryKey, "json");
  const index = await readIndex(env);
  if (existing?.value) {
    if (existing.metadata?.fingerprint === fingerprint) {
      const archivedHash = existing.metadata.contentHash;
      const archivedSummary = validateSummary(existing.value.summary, id);
      if (!index.some((entry) => entry.id === id && entry.contentHash === archivedHash && stableStringify(entry.summary) === stableStringify(archivedSummary))) {
        const fixed = await retainIndex(env, [...index.filter((entry) => entry.id !== id), { id, contentHash: archivedHash, summary: archivedSummary }]);
        return { archived: false, duplicate: true, id, contentHash: archivedHash, retained: fixed.length };
      }
      return { archived: false, duplicate: true, id, contentHash: archivedHash, retained: index.length };
    }
    throw new Error("An archived edition id cannot be rewritten");
  }
  const contentExisting = await env.METRICS_CACHE.get(contentKey, "text");
  if (contentExisting && contentExisting !== content) throw new Error("Content-addressed edition hash collision");
  if (!contentExisting) await env.METRICS_CACHE.put(contentKey, content, { metadata: { contentHash, schemaVersion: 2 } });
  await env.METRICS_CACHE.put(summaryKey, JSON.stringify({ summary }), { metadata: { contentHash, fingerprint, publishedAt: summary.publishedAt } });
  const retained = await retainIndex(env, [...index.filter((entry) => entry.id !== id), { id, contentHash, summary }]);
  return { archived: true, duplicate: false, id, contentHash, retained: retained.length };
}

async function readEdition(env, id) {
  validateEditionId(id);
  if (!env?.METRICS_CACHE?.getWithMetadata) return null;
  const record = await env.METRICS_CACHE.getWithMetadata(`${EDITION_SUMMARY_PREFIX}${id}`, "json");
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

async function listEditionSummaries(env, limit = EDITION_SUMMARY_RETENTION) {
  if (!env?.METRICS_CACHE?.get) return [];
  if (!Number.isInteger(limit) || limit < 1 || limit > EDITION_SUMMARY_RETENTION) throw new Error("Edition summary limit is invalid");
  const index = await readIndex(env);
  const summaries = await Promise.all(index.slice(0, limit).map(async (entry) => {
    try {
      const id = validateEditionId(entry.id);
      const summary = validateSummary(entry.summary, id);
      const archived = await readEdition(env, id);
      if (!archived || archived.contentHash !== entry.contentHash || stableStringify(archived.summary) !== stableStringify(summary)) return null;
      return summary;
    } catch {
      return null;
    }
  }));
  return summaries.filter((summary) => summary !== null);
}

export {
  EDITION_CONTENT_PREFIX,
  EDITION_INDEX_KEY,
  EDITION_ID,
  EDITION_SUMMARY_PREFIX,
  EDITION_SUMMARY_RETENTION,
  archiveEdition,
  listEditionSummaries,
  readEdition,
  validateCatalog,
  validateEditionId,
  validateSummary,
};
