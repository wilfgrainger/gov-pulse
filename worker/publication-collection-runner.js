import { refreshSectionPayload } from "./publication-entry.js";
import { collectExternalSection } from "./live-feed-collectors.js";
import { collectionPlanFor } from "./publication-plan.js";
import { currentSectionRecord } from "./publication-currentness.js";
import { RUN_PREFIX, RUN_TTL_SECONDS, kvGet, kvPut } from "./publication-run-store.js";

const PUBLICATION_SECTION_PREFIX = "v12:publication:section:";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sectionFragmentKey(section) {
  return `${PUBLICATION_SECTION_PREFIX}${String(section)}`;
}

function runSectionFragmentKey(runId, section) {
  return `${RUN_PREFIX}${String(runId)}:section:${String(section)}`;
}

// The retrieval clock of a fragment: when this copy of the source was read.
function fragmentRetrievalTime(record) {
  const value = record?.source?.fetchedAt ?? record?.fetchedAt;
  const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

// The global fragment is shared by every run, so it only moves forward: an
// older retrieval never replaces a newer one, and a record that is not current
// never replaces a fragment that is still within its validity window.
function storedFragmentWins(stored, candidate, section, now) {
  if (!isRecord(stored) || stored.section !== section || !isRecord(stored.data)) {
    return false;
  }
  const storedTime = fragmentRetrievalTime(stored);
  const candidateTime = fragmentRetrievalTime(candidate);
  if (storedTime !== null && (candidateTime === null || candidateTime < storedTime)) {
    return true;
  }
  return currentSectionRecord(stored, now) && !currentSectionRecord(candidate, now);
}

/**
 * Store a collected section record for one run and, when it does not regress
 * the shared evidence, as the global section fragment.
 *
 * Writes: one run-scoped put (when runId is given) and at most one global put.
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
  const key = sectionFragmentKey(section);
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
  writeSectionFragment,
};
