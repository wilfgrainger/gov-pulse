/**
 * Release notes are short, dated strips that situate the latest headline figure
 * in context computed strictly from data the site already holds (the headline
 * and its own history series). They are templated sentences built from
 * computable facts only -- release recency, direction of change versus the
 * immediately preceding comparable period, the number of consecutive periods
 * moving in the same direction, and a provisional/revision-in-development
 * status already carried by the source payload.
 *
 * No clause here asserts an opinion, a prediction, or a claim that is not
 * directly derivable from the fields passed in. A fact whose inputs are
 * missing or ambiguous is omitted rather than guessed -- see the individual
 * `null` returns below.
 */

export type ReleaseNoteDirection = "rose" | "fell" | "unchanged";

export type ReleaseNoteHistoryPoint = {
  /** Millisecond timestamp of the observation (matches each section's history shape). */
  observedAt: number;
  value: number;
};

export type ReleaseNoteInput = {
  /** Human-readable label for the measure, e.g. "Net migration", "Monthly GDP". */
  measureLabel: string;
  /** The latest published value, already formatted for display (e.g. "171,000", "+0.2%"). */
  latestValueDisplay: string;
  /** The latest observation period, already formatted (e.g. "the year ending December 2025"). */
  latestPeriod: string;
  /** ISO date (YYYY-MM-DD) or any Date-parseable string for the publication date. */
  releaseDate: string;
  /**
   * Ordered (oldest to newest) comparable history for this exact measure, used only to
   * compute the direction of change and how many consecutive periods have moved the same
   * way. Must be at least 2 points for any comparison clause to be produced.
   */
  history: ReleaseNoteHistoryPoint[];
  /**
   * Whether the source payload itself marks this release as provisional / in development.
   * Omit (or pass undefined) when the source does not carry this signal -- the clause is
   * then skipped rather than guessed.
   */
  provisional?: boolean;
  /** "now" injection point for day-count arithmetic, defaults to the real clock. Testing hook only. */
  now?: Date;
};

export type ReleaseNote = {
  /** 1-3 complete sentences, strictly derived from the inputs above. */
  sentences: string[];
  /** Convenience: sentences joined with a single space, ready to render. */
  text: string;
};

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function directionOf(current: number, previous: number): ReleaseNoteDirection {
  if (current === previous) return "unchanged";
  return current > previous ? "rose" : "fell";
}

/**
 * Counts how many consecutive history points, ending at the latest one, moved in the
 * same direction as the latest step. Returns null when there are fewer than two
 * comparable steps (i.e. fewer than 3 history points), since "consecutive" is undefined
 * for a single comparison.
 */
function consecutiveDirectionRun(history: ReleaseNoteHistoryPoint[]): {
  direction: ReleaseNoteDirection;
  count: number;
} | null {
  if (history.length < 3) return null;
  const sorted = [...history].sort((a, b) => a.observedAt - b.observedAt);
  const steps: ReleaseNoteDirection[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    steps.push(directionOf(sorted[i].value, sorted[i - 1].value));
  }
  const latestDirection = steps.at(-1);
  if (!latestDirection || latestDirection === "unchanged") return null;
  let count = 0;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (steps[i] !== latestDirection) break;
    count += 1;
  }
  return count >= 2 ? { direction: latestDirection, count } : null;
}

/**
 * Builds 1-3 strictly factual sentences from already-available data:
 *  1. A releases-since sentence: how many releases since the earliest comparable history
 *     point, and the recency of this one relative to "now" -- always produced when history
 *     has at least 2 points and the release date parses.
 *  2. A direction-and-magnitude sentence comparing the latest value with the immediately
 *     preceding comparable period -- produced when history has at least 2 points.
 *  3. A consecutive-direction sentence ("the Nth consecutive period of decline/increase")
 *     -- produced only when at least 3 comparable periods exist and the run is at least 2.
 *  4. A provisional/revision-in-development clause -- produced only when `provisional` is
 *     explicitly true in the source payload.
 *
 * Any fact whose inputs are missing/invalid is silently omitted; the function never
 * fabricates a clause to fill a gap.
 */
export function buildReleaseNote(input: ReleaseNoteInput): ReleaseNote {
  const sentences: string[] = [];
  const releaseDate = parseDate(input.releaseDate);
  const now = input.now ?? new Date();
  const sorted = [...input.history].sort((a, b) => a.observedAt - b.observedAt);
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.length >= 2 ? sorted.at(-2) ?? null : null;

  if (releaseDate && sorted.length >= 1) {
    const releaseCount = sorted.length;
    const ageDays = daysBetween(releaseDate, now);
    const recency =
      ageDays < 0
        ? ""
        : ageDays === 0
          ? " (published today)"
          : ageDays === 1
            ? " (published 1 day ago)"
            : ` (published ${ageDays} days ago)`;
    sentences.push(
      `This is release ${releaseCount} of ${input.measureLabel.toLowerCase()} in the retained history, covering ${input.latestPeriod}${recency}.`
    );
  }

  if (latest && previous && previous.value !== 0) {
    const direction = directionOf(latest.value, previous.value);
    const changePercent = ((latest.value - previous.value) / Math.abs(previous.value)) * 100;
    const roundedChange = Math.abs(changePercent) < 0.05 ? "0.0" : Math.abs(changePercent).toFixed(1);
    if (direction === "unchanged") {
      sentences.push(`${input.measureLabel} was unchanged from the prior comparable period, at ${input.latestValueDisplay}.`);
    } else {
      sentences.push(
        `${input.measureLabel} ${direction} to ${input.latestValueDisplay}, a change of ${direction === "rose" ? "+" : "-"}${roundedChange}% from the prior comparable period.`
      );
    }
  }

  const run = consecutiveDirectionRun(sorted);
  if (run) {
    const movement = run.direction === "rose" ? "increase" : "decline";
    sentences.push(`This is the ${ordinal(run.count)} consecutive period of ${movement}.`);
  }

  if (input.provisional === true) {
    sentences.push("This release is provisional and may be revised in a later publication.");
  }

  return { sentences, text: sentences.join(" ") };
}

function ordinal(value: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const mod100 = value % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : suffixes[value % 10] ?? "th";
  return `${value}${suffix}`;
}
