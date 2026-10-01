/**
 * Per-poll margin-of-error estimation for election polling uncertainty
 * visualization.
 *
 * public-data.org never synthesises a value (see north_star.md NON-GOALS).
 * No pollster in the current feed publishes a structured, machine-readable
 * margin of error -- only a free-text uncertainty statement (e.g. "a 9-in-10
 * interval of plus or minus four points"), whose phrasing and confidence
 * level vary by pollster and are not safe to parse into a number. So the
 * margin of error shown here is always the standard sampling-error estimate
 * derived from the poll's own disclosed sample size, and is always labelled
 * "estimated from sample size" -- never presented as the pollster's own
 * stated figure.
 *
 * This is per-poll uncertainty only. It is not a composite, not a rolling
 * average, and not a trend fit across polls.
 */

const Z_SCORE_95_PERCENT = 1.96;

export type MarginOfErrorEstimate = {
  /** Margin of error in percentage points (e.g. 3.1 means +/-3.1pp). */
  marginOfErrorPoints: number;
  /** Always "estimated-from-sample-size": no structured pollster MoE exists in the feed. */
  source: "estimated-from-sample-size";
  /** Confidence level the estimate is computed at. */
  confidenceLevel: 0.95;
};

/**
 * Standard margin of error for a simple-random-sample proportion, at 95%
 * confidence, using the conservative worst-case p = 0.5 (which maximises
 * p(1-p) and so never understates the true uncertainty for any observed
 * share).
 *
 * MoE = z * sqrt(p(1-p) / n), expressed in percentage points.
 */
export function marginOfErrorFromSampleSize(sampleSize: number): MarginOfErrorEstimate {
  if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
    throw new Error("Sample size must be a positive finite number");
  }

  const proportion = 0.5;
  const standardError = Math.sqrt((proportion * (1 - proportion)) / sampleSize);
  const marginOfErrorPoints = Z_SCORE_95_PERCENT * standardError * 100;

  return {
    marginOfErrorPoints: Math.round(marginOfErrorPoints * 10) / 10,
    source: "estimated-from-sample-size",
    confidenceLevel: 0.95,
  };
}

/** Midpoint timestamp (ms since epoch, UTC) between two ISO date-only strings. */
export function fieldworkMidpointMs(fieldworkStart: string, fieldworkEnd: string): number {
  const start = Date.parse(`${fieldworkStart}T00:00:00.000Z`);
  const end = Date.parse(`${fieldworkEnd}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("Fieldwork dates must be valid ISO date-only strings");
  }
  return start + (end - start) / 2;
}
