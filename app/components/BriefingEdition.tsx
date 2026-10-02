import Link from "next/link";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

export default function BriefingEdition({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const catalog = snapshot?.meta.measureCatalog as MeasureCatalog | undefined;
  const summary = snapshot?.meta.editionSummary;
  const measures = catalog ? Object.values(catalog.measures) : [];
  return <>
    <section aria-labelledby="edition-changes-heading" className="border-y-2 border-foreground bg-white p-5 md:p-8">
      <p className="eyebrow">Verified publication record</p>
      <h2 id="edition-changes-heading" className="mt-2 text-3xl font-black">What changed in the accepted edition</h2>
      {summary?.changes.length ? <ol className="mt-6 list-none divide-y divide-line p-0">{summary.changes.map((change, index) => <li key={`${change.measureId}-${change.period}-${change.kind}-${index}`} className="grid gap-2 py-4 sm:grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)]">
        <p className="font-bold">{change.kind === "new-observation" ? "New observation" : change.kind === "revision" ? "Historical revision" : "Method or definition change"}<span className="block text-xs font-normal text-gray-600">{change.period ?? "Measure definition"} · {change.observedAt ?? "date unavailable"}</span></p>
        <div><p className="font-semibold">{catalog?.measures[change.measureId]?.label ?? change.measureId}: {change.previous === null ? "not previously reported" : `${change.previous} ${catalog?.measures[change.measureId]?.unit ?? ""}`} → {change.next === null ? "unavailable" : `${change.next} ${catalog?.measures[change.measureId]?.unit ?? ""}`}</p><p className="mt-1 text-xs text-gray-600">Source edition {change.previousSourceEditionId ?? "no earlier catalog"} → {change.nextSourceEditionId}; revision {change.previousRevisionId ?? "none"} → {change.nextRevisionId}.</p><Link href={`/measure/${encodeURIComponent(change.measureId)}/`} className="mt-2 inline-block text-sm font-bold underline">Inspect measure record →</Link></div>
      </li>)}</ol> : <p role="status" className="mt-4 max-w-3xl text-sm leading-6 text-gray-700">{summary ? "The accepted catalog has no difference from its immediate predecessor." : "No comparable previous publication is archived for this edition. This briefing does not infer change from a missing baseline."}</p>}
      {summary ? <p className="mt-5 border-t border-line pt-4 font-mono text-xs text-gray-600">Edition {summary.id} · published {summary.publishedAt.slice(0, 10)} · {summary.sourceEditionIds.length} source editions</p> : null}
    </section>
    <section aria-labelledby="briefing-measures-heading" className="mt-10">
      <p className="eyebrow">Current evidence</p><h2 id="briefing-measures-heading" className="mt-2 text-3xl font-black">Measures available in this edition</h2>
      {measures.length ? <ul className="mt-5 grid list-none gap-px border border-line-strong bg-line-strong p-0 sm:grid-cols-2 lg:grid-cols-3">{measures.map((measure) => <li key={measure.id} className="bg-white p-5"><p className="text-sm font-bold">{measure.label}</p><p className="mt-2 text-3xl font-black tabular-nums">{measure.value === null ? "Unavailable" : `${measure.value} ${measure.unit}`}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{measure.availability === "current" ? "Current accepted observation" : "Historical edition · not a current headline"}</p><p className="mt-2 text-xs text-gray-600">{measure.observationPeriod.label} · {measure.geography.label}</p><Link href={`/measure/${encodeURIComponent(measure.id)}/`} className="mt-3 inline-block text-sm font-semibold underline">Source and history →</Link></li>)}</ul> : <p role="status" className="mt-4 border-l-4 border-accent bg-white p-5 text-sm">No validated measure catalog is available in this edition.</p>}
    </section>
  </>;
}
