import {
  collectInternationalComparison,
} from "./international-comparison-publication.js";
import {
  validateInternationalComparisonPublication,
} from "./international-comparison.js";

const INTERNATIONAL_COMPARISON_KEY = "v1:international-comparison:current";
const COMPARISON_REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function due(publication, now = new Date()) {
  const checkedAt = Date.parse(String(publication?.meta?.checkedAt ?? ""));
  return !Number.isFinite(checkedAt) || now.getTime() - checkedAt >= COMPARISON_REFRESH_MAX_AGE_MS;
}

async function readInternationalComparison(env) {
  if (!env?.METRICS_CACHE?.get) return null;
  const candidate = await env.METRICS_CACHE.get(INTERNATIONAL_COMPARISON_KEY, "json");
  if (!candidate) return null;
  try {
    return validateInternationalComparisonPublication(candidate);
  } catch {
    return null;
  }
}

async function refreshInternationalComparison(env, options = {}) {
  if (!env?.METRICS_CACHE?.put) throw new Error("METRICS_CACHE KV binding is required");
  const now = options.now ?? new Date();
  const current = await readInternationalComparison(env);
  if (!options.force && current && !due(current, now)) {
    return { updated: false, reason: "not-due", publication: current };
  }

  const collect = options.collect ?? collectInternationalComparison;
  const candidate = await collect(options.fetchImpl ?? fetch, now);
  const publication = validateInternationalComparisonPublication({
    ...candidate,
    meta: {
      ...candidate.meta,
      checkedAt: now.toISOString(),
    },
  });
  const availableMeasureCount = Object.values(publication.measures).filter(
    (measure) => measure.comparableCountryCount > 0
  ).length;
  if (availableMeasureCount === 0) {
    return {
      updated: false,
      reason: "no-available-measures",
      publication: current,
    };
  }

  await env.METRICS_CACHE.put(
    INTERNATIONAL_COMPARISON_KEY,
    JSON.stringify(publication)
  );
  return {
    updated: true,
    reason: current ? "refreshed" : "published",
    publication,
    availableMeasureCount,
  };
}

export {
  COMPARISON_REFRESH_MAX_AGE_MS,
  INTERNATIONAL_COMPARISON_KEY,
  due,
  readInternationalComparison,
  refreshInternationalComparison,
};
