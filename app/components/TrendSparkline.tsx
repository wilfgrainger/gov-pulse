import type { SignalHistoryPoint } from "@/app/lib/nationalEvidence";

type Props = {
  label: string;
  points: SignalHistoryPoint[];
  large?: boolean;
};

const date = (value: number) => new Intl.DateTimeFormat("en-GB", {
  month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(value));

export default function TrendSparkline({ label, points, large = false }: Props) {
  const observations = points.slice(large ? -36 : -24);
  if (observations.length < 2) return null;

  const values = observations.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(Math.abs(max) * 0.02, 1);
  const first = observations[0].observedAt;
  const last = observations.at(-1)!.observedAt;
  const x = (point: SignalHistoryPoint) => 8 + 344 * (point.observedAt - first) / (last - first || 1);
  const y = (point: SignalHistoryPoint) => 80 - 64 * (point.value - min) / span;
  const intervals = observations.slice(1).map((point, index) => point.observedAt - observations[index].observedAt).sort((a, b) => a - b);
  const typicalInterval = intervals[Math.floor(intervals.length / 2)] || 1;
  const segments: SignalHistoryPoint[][] = [];
  observations.forEach((point, index) => {
    if (index === 0 || point.observedAt - observations[index - 1].observedAt > typicalInterval * 1.7) {
      segments.push([]);
    }
    segments.at(-1)!.push(point);
  });

  return (
    <figure className={large ? "mt-8" : "mt-5"}>
      <svg
        viewBox="0 0 360 96"
        role="img"
        aria-label={`${label} from ${date(first)} to ${date(last)}. ${observations.length} published observations. The vertical scale is fitted to these values and does not start at zero. Open the topic for exact values.`}
        className={`w-full ${large ? "h-36" : "h-24"}`}
        preserveAspectRatio="none"
      >
        <line x1="8" x2="352" y1="80" y2="80" stroke="currentColor" opacity="0.18" />
        <line x1="8" x2="352" y1="48" y2="48" stroke="currentColor" opacity="0.10" />
        {segments.map((segment, index) => segment.length > 1 ? (
          <polyline
            key={index}
            points={segment.map((point) => `${x(point)},${y(point)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={large ? 3 : 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray={1}
            className="chart-draw-in"
          />
        ) : null)}
        {(observations.length < 7 ? observations : [observations[0], observations.at(-1)!]).map((point) => (
          <circle key={point.observedAt} cx={x(point)} cy={y(point)} r={large ? 4 : 3.5} fill="currentColor" />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between gap-3 text-xs font-medium text-current opacity-75">
        <span>{date(first)}</span>
        <span>{observations.length} observations · fitted scale</span>
        <span>{date(last)}</span>
      </figcaption>
    </figure>
  );
}
