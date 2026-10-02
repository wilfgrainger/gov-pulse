import type { MeasurePoint, MeasureRecord } from "@/app/lib/measureCatalog";
import type { DateWindow } from "@/app/lib/chartModel";

type GenericRow = { observedAt: number; period: string; [key: string]: string | number | null };
type GenericSeries = { key: string; label: string };

function valueText(value: number | null, unit: string) {
  if (value === null) return "Not available";
  const formatted = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
}

type MeasureTableProps = { measure: MeasureRecord; points: MeasurePoint[]; window: DateWindow };
type GenericTableProps = {
  caption: string;
  rows: GenericRow[];
  series: GenericSeries[];
  valueFormatter: (value: number) => string;
};

export default function ObservationTable(props: MeasureTableProps | GenericTableProps) {
  if (!("measure" in props)) {
    return (
      <details className="mt-4 border-t border-black/15 pt-3">
        <summary className="cursor-pointer text-sm font-semibold underline decoration-black/30 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">Show observation table ({props.rows.length})</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">{props.caption}</caption>
            <thead><tr className="border-b border-black/20 text-xs uppercase tracking-wide text-gray-600">
              <th scope="col" className="py-2 pr-4">Period</th>
              <th scope="col" className="py-2 pr-4">Observed at</th>
              {props.series.map((series) => <th key={series.key} scope="col" className="py-2 pr-4">{series.label}</th>)}
            </tr></thead>
            <tbody>{props.rows.map((row) => <tr key={row.observedAt} className="border-b border-black/10">
              <th scope="row" className="py-2 pr-4 font-medium">{row.period}</th>
              <td className="py-2 pr-4 tabular-nums">{new Date(row.observedAt).toISOString().slice(0, 10)}</td>
              {props.series.map((series) => {
                const value = row[series.key];
                return <td key={series.key} className="py-2 pr-4 tabular-nums">{typeof value === "number" ? props.valueFormatter(value) : "Not available"}</td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    );
  }
  const { measure, points, window } = props;
  return (
    <details className="mt-4 border-t border-black/15 pt-3">
      <summary className="cursor-pointer text-sm font-semibold underline decoration-black/30 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
        Show observation table ({points.length})
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            {measure.label} observations from {window.start} through {window.end}; source edition {measure.sourceEditionId}.
          </caption>
          <thead>
            <tr className="border-b border-black/20 text-xs uppercase tracking-wide text-gray-600">
              <th scope="col" className="py-2 pr-4">Observation period</th>
              <th scope="col" className="py-2 pr-4">Observed at</th>
              <th scope="col" className="py-2 pr-4">Value ({measure.unit})</th>
              <th scope="col" className="py-2 pr-4">Status</th>
              <th scope="col" className="py-2 pr-4">Revision</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={`${point.observedAt}-${point.revisionId}`} className="border-b border-black/10">
                <th scope="row" className="py-2 pr-4 font-medium">{point.period}</th>
                <td className="py-2 pr-4 tabular-nums">{point.observedAt}</td>
                <td className="py-2 pr-4 tabular-nums">{valueText(point.value, measure.unit)}</td>
                <td className="py-2 pr-4">{point.valueStatus}</td>
                <td className="py-2 pr-4 font-mono text-xs">{point.revisionId}</td>
              </tr>
            ))}
            {points.length === 0 ? (
              <tr><td colSpan={5} className="py-3 text-gray-600">No observations fall within this date window.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </details>
  );
}
