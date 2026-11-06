import { currentSectionRecord } from "../contracts/evidence-policy.js";
import { kvGet, kvPut } from "./publication-run-store.js";

const FEED_KEY_PREFIX = "v20:feed:";
const REASON_MAX_LENGTH = 200;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function feedKey(feedId) {
  return `${FEED_KEY_PREFIX}${String(feedId)}`;
}

// The retrieval clock of a record: when this copy of the source was read.
function fragmentRetrievalTime(record) {
  const value = record?.source?.fetchedAt ?? record?.fetchedAt;
  const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

// A stored record only moves forward: an older retrieval never replaces a newer
// one, and a record that is not current never replaces one that still is.
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

function validRecordFor(feedId, record) {
  return isRecord(record) && record.section === feedId && isRecord(record.data);
}

/**
 * One feed's evidence record and its last attempt, or null when nothing usable
 * is stored. A stored value for another feed is never evidence.
 */
async function readFeedRecord(env, feedId) {
  const stored = await kvGet(env, feedKey(feedId));
  if (!isRecord(stored) || stored.feedId !== feedId || !isRecord(stored.lastAttempt)) {
    return null;
  }
  const record = validRecordFor(feedId, stored.record) ? stored.record : null;
  return { feedId, record, lastAttempt: stored.lastAttempt };
}

/**
 * Record one collection attempt for a feed with exactly one KV put.
 *
 * A success replaces the stored record only when it is not older and does not
 * regress currentness ("kept-newer" otherwise; the attempt is still recorded).
 * A failure keeps the prior record only while it is still within its validity
 * window, so missing or stale evidence is unavailable, never carried forward.
 * KV has no compare-and-swap, so racing writers can still interleave.
 *
 * @returns {Promise<"written" | "kept-newer">}
 */
async function writeFeedAttempt(env, feedId, runId, outcome, now = new Date()) {
  const at = now.toISOString();
  const prior = await readFeedRecord(env, feedId);
  const priorRecord = prior?.record ?? null;
  let record = priorRecord;
  let result = "written";
  let attempt;

  if (outcome?.record) {
    if (!validRecordFor(feedId, outcome.record)) {
      throw new Error(`Feed '${feedId}' produced a record for another section`);
    }
    if (priorRecord && storedFragmentWins(priorRecord, outcome.record, feedId, now)) {
      result = "kept-newer";
    } else {
      record = outcome.record;
    }
    attempt = { runId: String(runId), at, status: "success", reason: null };
  } else {
    if (priorRecord && !currentSectionRecord(priorRecord, now)) record = null;
    const message = outcome?.error instanceof Error ? outcome.error.message : "unknown failure";
    attempt = {
      runId: String(runId),
      at,
      status: "failure",
      reason: message.slice(0, REASON_MAX_LENGTH),
    };
  }

  await kvPut(env, feedKey(feedId), { feedId, record, lastAttempt: attempt });
  return result;
}

export {
  FEED_KEY_PREFIX,
  feedKey,
  fragmentRetrievalTime,
  readFeedRecord,
  storedFragmentWins,
  writeFeedAttempt,
};
