import { refreshSectionPayload } from "./publication-entry.js";
import { collectExternalSection } from "./live-feed-collectors.js";
import { collectionPlanFor } from "./publication-plan.js";
import { fragmentRetrievalTime, storedFragmentWins, writeFeedAttempt } from "./feed-store.js";
import { RUN_PREFIX, RUN_TTL_SECONDS, kvGet, kvPut } from "./publication-run-store.js";
import { isRecord } from "../contracts/records.js";

const PUBLICATION_SECTION_PREFIX = "v12:publication:section:";

function sectionFragmentKey(section) {
  return `${PUBLICATION_SECTION_PREFIX}${String(section)}`;
}

function runSectionFragmentKey(runId, section) {
  return `${RUN_PREFIX}${String(runId)}:section:${String(section)}`;
}

/**
 * Write a record to a shared (monotonic) legacy key unless the stored copy is
 * newer or more current. One get, at most one put.
 *
 * @returns {Promise<"written" | "kept-newer">}
 */
async function writeGlobalFragment(env, key, record, { now = new Date(), runId = null } = {}) {
  const section = record?.section;
  const stored = await kvGet(env, key);
  if (storedFragmentWins(stored, record, section, now)) {
    console.warn("Publication fragment kept newer stored evidence", {
      section,
      runId: typeof runId === "string" ? runId : null,
      storedFetchedAt: stored?.source?.fetchedAt ?? stored?.fetchedAt ?? null,
      candidateFetchedAt: record?.source?.fetchedAt ?? record?.fetchedAt ?? null,
    });
    return "kept-newer";
  }
  await kvPut(env, key, record);
  return "written";
}

/**
 * Store a collected section record for one run and, when it does not regress
 * the shared evidence, as the global section fragment.
 *
 * Writes: one run-scoped put (when runId is given), at most one global put and
 * one per-feed put.
 * The comparison is read-then-write; KV has no compare-and-swap, so two
 * writers racing within the same instant can still interleave.
 *
 * @returns {Promise<"written" | "kept-newer">}
 */
async function writeSectionFragment(env, runId, section, record, options = {}) {
  if (!isRecord(record) || record.section !== section || !isRecord(record.data)) {
    throw new Error(`Section '${section}' produced a record for another section`);
  }
  const now = options.now instanceof Date ? options.now : new Date();
  if (typeof runId === "string" && runId.trim()) {
    await kvPut(env, runSectionFragmentKey(runId, section), record, {
      expirationTtl: RUN_TTL_SECONDS,
    });
  }
  const result = await writeGlobalFragment(env, sectionFragmentKey(section), record, { now, runId });
  // Dual-write window: the per-feed record is written beside the legacy keys.
  // It must never fail a collection that the legacy path accepted.
  try {
    await writeFeedAttempt(env, section, typeof runId === "string" && runId ? runId : "unscoped", { record }, now);
  } catch (error) {
    console.warn("Feed record dual-write failed", {
      section,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return result;
}

async function storeSectionFragment(section, env, ctx, runId = null) {
  const plan = collectionPlanFor(section);
  if (!plan || plan.jobType !== "refresh-section") {
    throw new Error(`Section '${section}' is outside the generic publication set`);
  }
  const record = await refreshSectionPayload(section, env, ctx);
  await writeSectionFragment(env, runId, section, record);
  return record;
}

async function storeExternalSection(section, env, options = {}) {
  const plan = collectionPlanFor(section);
  if (!plan || plan.jobType !== "refresh-external-section") {
    throw new Error(`Section '${section}' is outside the external publication set`);
  }
  const record = await collectExternalSection(section, options);
  await writeSectionFragment(env, options.runId ?? null, section, record, {
    now: options.now,
  });
  return record;
}

export {
  PUBLICATION_SECTION_PREFIX,
  fragmentRetrievalTime,
  runSectionFragmentKey,
  sectionFragmentKey,
  storeExternalSection,
  storeSectionFragment,
  writeGlobalFragment,
  writeSectionFragment,
};
