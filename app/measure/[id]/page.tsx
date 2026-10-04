import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import PageHeader from "@/app/components/PageHeader";
import { formatMeasure } from "@/app/lib/dataExplorer";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { measureForDisplay } from "@/app/lib/measureCatalog";
import { MEASURES } from "@/app/lib/measureDefinitions";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";
import { workspaceUrl } from "@/app/lib/comparisonWorkspace";
import { segmentPoints } from "@/app/lib/chartModel";
import { sourceHistoryHref } from "@/app/lib/sourceHistory";

async function findMeasure(id: string) {
  const definition = MEASURES.find((item) => item.id === id) ?? null;
  const snapshot = await readServerMetricsSnapshot();
  const measure = snapshot?.meta.measureCatalog
    ? measureForDisplay(snapshot.meta.measureCatalog, id, new Date())
    : null;
  const source = definition ? snapshot?.meta.sources[definition.section] : null;
  const status = source && typeof source === "object" ? (source as { status?: string }).status : undefined;
  const reason = !definition ? null : measure?.availability === "historical"
    ? "This verified publication is outside its current validity window. The chart is retained as historical evidence."
    : measure ? null
      : !snapshot ? "No current national evidence edition is available."
        : status === "error" || !source ? "The source section is unavailable in this edition."
          : "No record passed the source, period and history checks for this edition.";
  return { definition, measure, reason };
}

export function generateStaticParams() {
  return MEASURES.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { definition, measure } = await findMeasure(id);
  if (!definition) return {};
  const title = measure?.label ?? definition.label;
  const basis = measure?.basis ?? definition.basis;
  return {
    title,
    description: measure
      ? `${basis}. ${measure.geography.label}; ${measure.observationPeriod.label}. Source edition ${measure.sourceEditionId}.`
      : `${basis}. ${definition.geography}; no verified source record is available in the current edition.`,
    alternates: { canonical: `https://public-data.org/measure/${encodeURIComponent(id)}/` },
  };
}

function MethodFacts({ measure }: { measure: NonNullable<Awaited<ReturnType<typeof findMeasure>>["measure"]> }) {
  const facts = [
    ["Unit", measure.unit],
    ["Geography", measure.geography.label],
    ["Frequency", measure.cadence],
    ["Observation period", measure.observationPeriod.label],
    ["Source edition", measure.sourceEditionId],
    ["Published", measure.publishedAt.slice(0, 10)],
    ["Retrieved", measure.fetchedAt.slice(0, 10)],
    ["Valid through", measure.validUntil?.slice(0, 10) ?? "Not established"],
  ];
  return <dl className="mb-8 grid gap-px border border-line-strong bg-line-strong sm:grid-cols-2 lg:grid-cols-4">{facts.map(([label, value]) => <div key={label} className="bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wider text-gray-600">{label}</dt><dd className="mt-2 break-words font-semibold">{value}</dd></div>)}</dl>;
}

function comparablePointChange(measure: NonNullable<Awaited<ReturnType<typeof findMeasure>>["measure"]>) {
  const latestSegment = segmentPoints(measure.points, measure.cadence).at(-1) ?? [];
  if (latestSegment.length < 2) return null;
  const previous = latestSegment.at(-2)?.value;
  const latest = latestSegment.at(-1)?.value;
  return typeof previous === "number" && typeof latest === "number" ? latest - previous : null;
}

export default async function MeasureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { definition, measure, reason } = await findMeasure(id);
  if (!definition) notFound();
  const comparisonWindow = measure?.points.length
    ? { start: measure.points[0].observedAt, end: measure.points.at(-1)!.observedAt }
    : measure?.observationPeriod ?? { start: "2020-01-01", end: new Date().toISOString().slice(0, 10) };
  const compareHref = measure ? workspaceUrl({ version: 1, measureIds: [measure.id], window: comparisonWindow, mode: "panels" }) : null;
  const pointChange = measure ? comparablePointChange(measure) : null;

  return <div className="min-h-screen bg-background text-foreground">
    <a href="#measure-evidence" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to measure evidence</a>
    <SectionNav sections={SECTIONS} />
    <main id="measure-evidence">
      <PageHeader eyebrow={`${measure ? measure.evidenceClass.replaceAll("-", " ") : definition.topic} · ${measure?.availability ?? "unavailable"}`} title={measure?.label ?? definition.label} subtitle={measure?.basis ?? definition.basis} current="Measure library" />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        {measure ? <>
          {measure.availability === "historical" ? <p role="status" className="mb-6 border-l-4 border-[#8a5a12] bg-surface-warm p-4 text-sm">This verified publication is retained as historical evidence; it is outside its current validity window.</p> : null}
          <section aria-labelledby="measure-latest-title" className="measure-lead mb-6 grid gap-4 border-y-2 border-foreground bg-[#e8f2ef] p-5 sm:p-6 min-[54rem]:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)] min-[54rem]:items-center">
            <div>
              <p className="eyebrow !text-[#08766c]">{measure.availability === "historical" ? "Latest retained observation" : "Latest published observation"}</p>
              <h2 id="measure-latest-title" className="headline-figure mt-2 text-5xl text-[#14243b] sm:text-6xl">
                {measure.value === null ? "Unavailable" : formatMeasure(measure.value, measure.unit)}
              </h2>
              <p className="mt-3 text-sm font-semibold">{measure.observationPeriod.label} · {measure.geography.label}</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {pointChange === null
                  ? "A change is not calculated without two consecutive numeric points from the same source vintage."
                  : `Change from the previous published point: ${pointChange > 0 ? "+" : ""}${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(pointChange)} ${measure.unit === "%" ? "percentage points" : measure.unit}.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {compareHref ? <Link href={compareHref} className="v3-primary-action">Compare this measure</Link> : null}
                <Link href={`/calendar/?follow=${encodeURIComponent(measure.id)}`} className="v3-secondary-action">Follow this measure</Link>
              </div>
            </div>
            <p className="border-t border-black/15 pt-4 text-sm leading-6 text-gray-700 min-[54rem]:border-l min-[54rem]:border-t-0 min-[54rem]:py-2 min-[54rem]:pl-5">
              Published {measure.publishedAt.slice(0, 10)} by {measure.publisher ?? measure.sourceId}. The source edition, unit, frequency and validity dates appear below the chart.
            </p>
          </section>
          {measure.note ? <p className="mb-6 max-w-4xl border-l-4 border-accent bg-surface-warm px-4 py-3 text-sm leading-6">{measure.note}</p> : null}
          <EvidenceFigure measure={measure} title={`${measure.label}: published observations`} description={`${measure.basis}. ${measure.geography.label}.`} window={{ start: measure.points[0]?.observedAt ?? measure.observationPeriod.start, end: measure.points.at(-1)?.observedAt ?? measure.observationPeriod.end }} variant="line" />
          <section aria-label="Measure publication details" className="mt-8">
            <MethodFacts measure={measure} />
          </section>
          <p className="mt-8 text-sm">Primary publisher source: <a className="font-semibold underline" href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.publisher ?? measure.sourceId} · edition {measure.sourceEditionId}</a></p>
          <p className="mt-2 text-sm">Source history: <Link className="font-semibold underline" href={sourceHistoryHref(measure)}>source record and retained changes</Link> · <Link className="font-semibold underline" href="/editions/">browse historical editions</Link></p>
          {measure.caveats.length ? <section aria-labelledby="measure-caveats" className="mt-8 border-t border-line-strong pt-5"><h2 id="measure-caveats" className="text-xl font-bold">Caveats</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{measure.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></section> : null}
        </> : <section role="status" className="border-y-2 border-foreground bg-surface-warm p-6 md:p-8">
          <p className="eyebrow">{definition.topic} · unavailable</p>
          <h2 className="mt-2 text-2xl font-black">No verified observation in this edition</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">{reason}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[ ["Definition", definition.basis], ["Geography", definition.geography], ["Unit", definition.unit], ["Frequency", definition.cadence] ].map(([label, value]) => <div key={label} className="border-t border-black/20 pt-3"><dt className="text-xs font-bold uppercase tracking-wider text-gray-600">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}
          </dl>
          <Link href="/sources/" className="mt-7 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Review sources and methods <span aria-hidden="true" className="ml-2">→</span></Link>
        </section>}
      </div>
    </main>
    <SiteFooter />
  </div>;
}
