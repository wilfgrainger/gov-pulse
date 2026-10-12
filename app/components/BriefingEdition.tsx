import Link from "next/link";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

function changeHeading(kind: string) {
  if (kind === "new-observation") return "New observation";
  if (kind === "revision") return "Historical revision";
  if (kind === "metadata-change") return "Source metadata changed";
  return "Method or definition change";
}

function changeBadge(kind: string) {
  if (kind === "new-observation") return "NEW DATA";
  if (kind === "revision") return "REVISION";
  return "METHOD CHANGE";
}

function changeDescription(change: NonNullable<MetricsSnapshot["meta"]["editionSummary"]>["changes"][number], unit: string) {
  if (change.kind === "method-change") return "Definition or method changed; values are not treated as like-for-like.";
  if (change.kind === "metadata-change") return `Source metadata changed: ${(change.changedFields ?? []).join(", ") || "details not recorded"}. No numeric change is inferred.`;
  const previousUnit = change.previousUnit ?? unit;
  const nextUnit = change.nextUnit ?? unit;
  return `${change.previous === null ? "not previously reported" : `${change.previous} ${previousUnit}`} → ${change.next === null ? "unavailable" : `${change.next} ${nextUnit}`}`;
}

function SourceChangeLinks({ change, fallbackUrl }: { change: NonNullable<MetricsSnapshot["meta"]["editionSummary"]>["changes"][number]; fallbackUrl?: string }) {
  const previousUrl = change.previousSourceUrl;
  const nextUrl = change.nextSourceUrl ?? fallbackUrl;
  return <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
    {previousUrl ? <a className="underline" href={previousUrl} target="_blank" rel="noopener noreferrer">Previous primary publication</a> : null}
    {nextUrl ? <a className="underline" href={nextUrl} target="_blank" rel="noopener noreferrer">Current primary publication</a> : null}
  </p>;
}

export default function BriefingEdition({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const catalog = snapshot?.meta.measureCatalog as MeasureCatalog | undefined;
  const summary = snapshot?.meta.editionSummary;
  const measures = catalog ? Object.values(catalog.measures) : [];
  return <>
    <section aria-labelledby="edition-changes-heading" className="border-y-2 border-foreground bg-white p-5 md:p-8">
      <p className="eyebrow">Verified publication record</p>
      <h2 id="edition-changes-heading" className="mt-2 text-3xl font-black">What changed in the accepted edition</h2>
      {summary?.changes.length ? <ol className="briefing-change-list">{summary.changes.map((change, index) => {
        const measure = catalog?.measures[change.measureId];
        const badge = changeBadge(change.kind);
        return <li key={`${change.measureId}-${change.period}-${change.kind}-${index}`} className="briefing-change-card" data-change-type={change.kind}>
          <div className="briefing-change-card__meta">
            <span className="briefing-change-badge" data-change-badge={badge}>{badge}</span>
            <p>{change.period ?? "Measure definition"} · {change.observedAt ?? "date unavailable"}{measure ? ` · ${measure.geography.label}` : ""}</p>
          </div>
          <div>
            <p className="briefing-change-card__heading">{changeHeading(change.kind)}</p>
            <h3 className="briefing-change-card__title">{measure?.label ?? change.measureId}</h3>
            <p className="briefing-change-card__description">{changeDescription(change, measure?.unit ?? "")}</p>
            <SourceChangeLinks change={change} fallbackUrl={measure?.sourceUrl}/>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <Link href={`/measure/${encodeURIComponent(change.measureId)}/`} className="text-sm font-bold underline underline-offset-4">Inspect measure record →</Link>
            </div>
            <details className="briefing-technical-record">
              <summary>Technical change record</summary>
              <p>Source edition {change.previousSourceEditionId ?? "no earlier catalog"} → {change.nextSourceEditionId}; revision {change.previousRevisionId ?? "none"} → {change.nextRevisionId}.</p>
              <p>Source publication date {change.previousSourcePublishedAt?.slice(0, 10) ?? "not recorded"} → {change.nextSourcePublishedAt?.slice(0, 10) ?? measure?.publishedAt.slice(0, 10) ?? "not recorded"}.</p>
            </details>
          </div>
        </li>;
      })}</ol> : <p role="status" className="mt-4 max-w-3xl text-sm leading-6 text-gray-700">{!summary ? "No comparable previous publication is archived for this edition. This briefing does not infer change from a missing baseline." : summary.previousEditionId === summary.id ? "The accepted edition is unchanged; no evidence changes were recorded." : summary.previousEditionId === null ? "No comparable previous publication is archived for this edition. This briefing does not infer change from a missing baseline." : summary.previousEditionId ? `No evidence changes were recorded against previous edition ${summary.previousEditionId}.` : "This stored edition does not record whether a comparable previous publication was available. No changes are inferred."}</p>}
      {summary ? <p className="mt-5 border-t border-line pt-4 font-mono text-xs text-gray-600">Edition {summary.id} · published {summary.publishedAt.slice(0, 10)} · {summary.sourceEditionIds.length} source editions</p> : null}
      {summary ? <Link href={`/editions/${encodeURIComponent(summary.id)}`} className="mt-3 inline-block text-sm font-bold underline">Inspect this immutable archived edition →</Link> : <Link href="/editions/" className="mt-3 inline-block text-sm font-bold underline">Browse historical editions →</Link>}
    </section>
    <section aria-labelledby="briefing-measures-heading" className="mt-10">
      <p className="eyebrow">Current evidence</p><h2 id="briefing-measures-heading" className="mt-2 text-3xl font-black">Measures available in this edition</h2>
      {measures.length ? <ul className="mt-5 grid list-none gap-px border border-line-strong bg-line-strong p-0 sm:grid-cols-2 lg:grid-cols-3">{measures.map((measure) => <li key={measure.id} className="min-w-0 bg-white p-5"><p className="text-sm font-bold">{measure.label}</p><p className="mt-2 text-3xl font-black tabular-nums">{measure.value === null ? "Unavailable" : `${measure.value} ${measure.unit}`}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{measure.availability === "current" ? "Current accepted observation" : measure.availability === "historical" ? "Historical edition · not a current headline" : "Unavailable in this edition"}</p><p className="mt-2 text-xs text-gray-600">{measure.observationPeriod.label} · {measure.geography.label} · {measure.unit}</p><p className="mt-1 text-xs text-gray-600">Published {measure.publishedAt.slice(0, 10)} · edition {measure.sourceEditionId}</p>{measure.sourceUrl ? <p className="mt-1 text-xs"><a className="break-all underline" href={measure.sourceUrl}>Primary publication</a></p> : null}<p className="mt-2 text-xs leading-5 text-gray-700">{measure.caveats.length ? measure.caveats.join(" ") : "No material caveat recorded in this edition."}</p><Link href={`/measure/${encodeURIComponent(measure.id)}/`} className="mt-3 inline-block text-sm font-semibold underline">Source and history →</Link></li>)}</ul> : <p role="status" className="mt-4 border-l-4 border-accent bg-white p-5 text-sm">No validated measure catalog is available in this edition.</p>}
    </section>
  </>;
}
