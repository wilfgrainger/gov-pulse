/**
 * Curated registry of well-known, uncontroversial UK reference-point events for
 * chart annotations.
 *
 * These are DESCRIPTIVE date markers only. They label a date on the timeline so
 * a reader can orient a chart against a known event; they carry NO claim that
 * the event caused, explains, or correlates with any change in any measure.
 * Do not add causal language to a label, and do not add an event because it
 * might explain a change in a specific series — that is exactly the inference
 * north_star.md prohibits (never assert interpretation as fact).
 *
 * Keep this list small and genuinely uncontroversial: dates that are matters
 * of public record, not matters of political dispute.
 */

export type ChartEvent = {
  id: string;
  /** ISO date (YYYY-MM-DD), interpreted as UTC midnight. */
  date: string;
  /** Short, neutral label. No causal or evaluative language. */
  label: string;
};

export const CHART_EVENTS: ChartEvent[] = [
  {
    id: "covid-lockdown-1",
    date: "2020-03-23",
    label: "UK COVID-19 lockdown announced",
  },
  {
    id: "brexit-transition-end",
    date: "2021-01-01",
    label: "Brexit transition period ended",
  },
  {
    id: "mini-budget-2022",
    date: "2022-09-23",
    label: "September 2022 fiscal statement",
  },
  {
    id: "energy-price-guarantee",
    date: "2022-10-01",
    label: "Energy Price Guarantee introduced",
  },
  {
    id: "bank-rate-peak-2023",
    date: "2023-08-03",
    label: "Bank Rate reached 5.25%",
  },
  {
    id: "general-election-2024",
    date: "2024-07-04",
    label: "UK general election",
  },
];

function parseIsoDateUtc(value: string): number {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Return the curated events whose date falls within [start, end] inclusive,
 * as millisecond timestamps paired with their label. Filtering to the visible
 * range keeps annotations additive-only: a chart whose date range does not
 * cover a given event simply never renders it.
 */
export function visibleChartEvents(
  start: number,
  end: number,
): { id: string; label: string; timestamp: number }[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  return CHART_EVENTS.flatMap((event) => {
    const timestamp = parseIsoDateUtc(event.date);
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
      ? [{ id: event.id, label: event.label, timestamp }]
      : [];
  });
}
