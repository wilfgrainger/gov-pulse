const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export const SECTION_FRESH_TTL_SECONDS = Object.freeze({
  bettingOdds: 4 * HOUR_SECONDS,
  electionPolling: 14 * DAY_SECONDS,
  nationalDebt: 40 * DAY_SECONDS,
  gdpTracker: 36 * HOUR_SECONDS,
  sentimentPulse: 36 * HOUR_SECONDS,
  taxRevenue: 36 * HOUR_SECONDS,
  employmentStats: 36 * HOUR_SECONDS,
  nhsStats: 45 * DAY_SECONDS,
  migrationStats: 36 * HOUR_SECONDS,
  // Keep the legacy descriptor path no looser than the public publication path.
  crimeStatistics: 36 * HOUR_SECONDS,
});

export function applyFreshnessPolicy(descriptors) {
  if (!descriptors || typeof descriptors !== "object" || Array.isArray(descriptors)) {
    throw new Error("Worker descriptors must be an object");
  }

  const policySections = Object.keys(SECTION_FRESH_TTL_SECONDS);
  const descriptorSections = Object.keys(descriptors);

  for (const section of policySections) {
    if (!descriptors[section]) {
      throw new Error(`Freshness policy references unknown section '${section}'`);
    }
  }

  for (const section of descriptorSections) {
    if (!(section in SECTION_FRESH_TTL_SECONDS)) {
      throw new Error(`Worker section '${section}' is missing a freshness policy`);
    }
  }

  for (const [section, freshTtlSeconds] of Object.entries(SECTION_FRESH_TTL_SECONDS)) {
    descriptors[section].freshTtlSeconds = freshTtlSeconds;
  }

  return descriptors;
}
