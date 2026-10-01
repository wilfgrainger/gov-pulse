// The data Worker's real recurring refresh cadence, as configured in
// worker/wrangler.toml `[triggers] crons`. This file does not duplicate that
// schedule from memory — it names the one cron expression this constant
// encodes, so a future change to wrangler.toml is a visible mismatch here
// rather than a silent drift.
//
//   [triggers]
//   crons = ["17 3 * * *", "47 */3 * * *"]
//
// "47 */3 * * *" (every 3 hours at :47 UTC) is the recurring collection
// cadence; "17 3 * * *" is a once-daily supplementary run. The indicator
// surfaces only the recurring cadence, since that is the one a reader can
// use to predict the next check.
export const PUBLICATION_CRON_INTERVAL_HOURS = 3;
export const PUBLICATION_CRON_MINUTE = 47;

/**
 * Next UTC instant the recurring collection cron is due to fire, computed
 * from the real cron expression above — never an invented cadence. Returns
 * null only if given a non-finite `from`.
 */
export function nextScheduledCheck(from: Date): Date | null {
  const fromMs = from.getTime();
  if (!Number.isFinite(fromMs)) return null;

  const hourSlot =
    Math.floor(from.getUTCHours() / PUBLICATION_CRON_INTERVAL_HOURS) *
    PUBLICATION_CRON_INTERVAL_HOURS;

  const candidate = new Date(from);
  candidate.setUTCHours(hourSlot, PUBLICATION_CRON_MINUTE, 0, 0);

  if (candidate.getTime() <= fromMs) {
    candidate.setUTCHours(candidate.getUTCHours() + PUBLICATION_CRON_INTERVAL_HOURS);
  }

  return candidate;
}
