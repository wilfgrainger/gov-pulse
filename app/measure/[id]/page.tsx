import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { selectMeasure } from "@/app/lib/measureCatalog";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";

async function findMeasure(id: string) {
  const snapshot = await readServerMetricsSnapshot();
  const catalog = snapshot?.meta.measureCatalog;
  return catalog ? selectMeasure(catalog, id, new Date()) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const measure = await findMeasure(id);
  return measure ? {
    title: measure.label,
    description: `${measure.basis}. ${measure.geography.label}; ${measure.observationPeriod.label}. Source edition ${measure.sourceEditionId}.`,
    alternates: { canonical: `https://public-data.org/measure/${encodeURIComponent(id)}/` },
  } : {};
}

export default async function MeasureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const measure = await findMeasure(id);
  if (!measure) notFound();
  const values = measure.points.flatMap((point) => point.value === null ? [] : [point.observedAt]);
  const window = { start: values.length ? values[0] : measure.observationPeriod.start, end: values.length ? values.at(-1)! : measure.observationPeriod.end };
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#measure-evidence" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to measure evidence</a>
    <SectionNav sections={SECTIONS} />
    <main id="measure-evidence">
      <PageHeader eyebrow={`${measure.evidenceClass.replaceAll("-", " ")} · ${measure.availability}`} title={measure.label} subtitle={measure.basis} current="Measure library" />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <dl className="mb-8 grid gap-px border border-line-strong bg-line-strong sm:grid-cols-2 lg:grid-cols-4">
          {[["Unit", measure.unit], ["Geography", measure.geography.label], ["Cadence", measure.cadence], ["Observation period", measure.observationPeriod.label], ["Source edition", measure.sourceEditionId], ["Published", measure.publishedAt.slice(0, 10)], ["Fetched", measure.fetchedAt.slice(0, 10)], ["Validity", measure.validUntil ?? "Not established"]].map(([label, value]) => <div key={label} className="bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wider text-gray-600">{label}</dt><dd className="mt-2 break-words font-semibold">{value}</dd></div>)}
        </dl>
        <EvidenceFigure measure={measure} title={`${measure.label}: published observations`} description={`${measure.basis}. ${measure.geography.label}.`} window={window} variant="line" />
        <p className="mt-8 text-sm">Publisher source: <a className="font-semibold underline" href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.sourceId} · edition {measure.sourceEditionId}</a></p>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
