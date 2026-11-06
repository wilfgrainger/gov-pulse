import { refreshJobs } from "./publication-plan.js";

// Core of the three-message publication pipeline (collect, finalise,
// bootstrap). It sits beside the existing dispatcher and is not wired into the
// Worker entry yet: until the legacy keys are retired (gate G4) no message is
// ever acknowledged here unless it is handled.

const MIN_RUN_WINDOW_MS = 25 * 60 * 1000;
const DEADLINE_MARGIN = 1.5;
// Worst measured queue job wall time (refresh-contracts, 21,889 ms in the
// 6 November 2026 tail, docs/operations/free-resource-budget.md). Used only for
// a feed that has no measurement of its own, so a new feed is never under-budgeted.
const DEFAULT_P95_MS = 21_889;

const SCOPES = Object.freeze(["daily", "3h", "weekly", "bootstrap"]);

function feedIdOf(job) {
  return job.type === "refresh-contracts" ? "governmentContracts" : job.section;
}

/**
 * Feed ids due for collection under a scope. Recurring scopes cover published
 * feeds only (held feeds cause no writes and no sends); bootstrap covers the
 * required feeds, plus contracts when `config.includeContracts` is true.
 */
function dueFeeds(_now, scope, config = {}) {
  if (!SCOPES.includes(scope)) throw new Error(`Unknown pipeline scope '${String(scope)}'`);
  if (scope === "weekly") return [];
  if (scope === "3h") {
    return refreshJobs("due", "betting", { publishedOnly: true }).map(feedIdOf);
  }
  const options =
    scope === "bootstrap"
      ? { includeContracts: config.includeContracts === true }
      : { publishedOnly: true };
  return refreshJobs("due", scope, options).map(feedIdOf);
}

/**
 * createdAt + max(25 min, sum of measured p95 job durations x 1.5). Feeds run
 * one at a time (consumer concurrency 1), so the serial sum bounds a healthy run.
 */
function runDeadline(createdAt, feeds, measuredP95Ms = {}) {
  const serialMs = feeds.reduce((sum, id) => {
    const measured = measuredP95Ms[id];
    return sum + (Number.isFinite(measured) && measured > 0 ? measured : DEFAULT_P95_MS);
  }, 0);
  const windowMs = Math.max(MIN_RUN_WINDOW_MS, serialMs * DEADLINE_MARGIN);
  return new Date(createdAt.getTime() + windowMs);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

/** Validate a queue body as one of the three message types, or throw. */
function parseMessage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Pipeline message must be an object");
  }
  switch (body.type) {
    case "collect":
      if (!nonEmptyString(body.runId) || !nonEmptyString(body.feedId)) {
        throw new Error("collect message needs runId and feedId");
      }
      if (body.shard !== undefined && !nonEmptyString(body.shard)) {
        throw new Error("collect message shard must be a non-empty string");
      }
      return body;
    case "finalise":
      if (!nonEmptyString(body.runId) || !Number.isFinite(Date.parse(body.deadlineAt))) {
        throw new Error("finalise message needs runId and a valid deadlineAt");
      }
      return body;
    case "bootstrap":
      if (body.scope !== "bootstrap") throw new Error("bootstrap message needs scope 'bootstrap'");
      return body;
    default:
      throw new Error(`Unknown pipeline message type '${String(body.type)}'`);
  }
}

/**
 * Queue entry for the pipeline. Anything it cannot handle is retried, never
 * acknowledged, so an unknown or not-yet-enabled message is never lost; the
 * Queue's dead-letter queue keeps exhausted messages observable.
 */
async function dispatch(message) {
  try {
    const body = parseMessage(message.body);
    throw new Error(`Pipeline handling for '${body.type}' is not enabled yet`);
  } catch (error) {
    console.error("Pipeline message not handled", {
      type: message.body?.type ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    message.retry();
  }
}

export {
  DEFAULT_P95_MS,
  MIN_RUN_WINDOW_MS,
  dispatch,
  dueFeeds,
  parseMessage,
  runDeadline,
};
