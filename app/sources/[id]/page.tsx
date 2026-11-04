import EvidenceHoldNotice from "@/app/components/EvidenceHoldNotice";
import { publicationEnabled } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import RevisionLedger from "@/app/components/RevisionLedger";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { availableMeasures } from "@/app/lib/measureCatalog";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { readEditionSummaries } from "@/app/lib/serverEditionArchive";
import { SECTIONS } from "@/app/lib/sections";
import { selectSourceRecordMeasures } from "@/app/lib/sourceHistory";
import { DATA_SOURCE_DETAILS } from "@/app/lib/dataSourceDetails";
import { FEED_REGISTRY, PUBLICATION_SOURCE_REGISTRY } from "@/worker/feed-registry";

type SourcePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ measure?: string | string[] }>;
};

type PublicUpstream = { publisher?: string; label?: string; url: string };

function publicUpstreams(id: string): PublicUpstream[] {
  const sourceConfig = (PUBLICATION_SOURCE_REGISTRY as Record<string, { upstreams?: PublicUpstream[] }>)[id]
    ?? (FEED_REGISTRY as Record<string, { upstreams?: PublicUpstream[] }>)[id];
  const upstreams = (sourceConfig?.upstreams ?? []).filter((upstream) => upstream.url.startsWith("https://"));
  if (upstreams.length > 0) return upstreams;
  if (id === "governmentContracts") {
    return [{ publisher: "Find a Tender", label: "Find a Tender service", url: "https://www.find-tender.service.gov.uk/" }];
  }
  return [];
}

function HeldSourceRecord({ id, title }: { id: string; title: string }) {
  const detail = DATA_SOURCE_DETAILS[id];
  const upstreams = publicUpstreams(id);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#source-record" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to source record</a>
      <SectionNav sections={SECTIONS} />
      <main id="source-record" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="mb-8 border-b-4 border-foreground bg-surface-warm p-5 md:p-8">
          <p className="eyebrow">Publisher and source lineage</p>
          <h1 className="mt-2 break-words text-5xl font-black tracking-[-0.06em] md:text-7xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">This source record explains the evidence family and its measurement limits. Later retrieval alone is not a revision.</p>
        </header>
        <EvidenceHoldNotice id="source-publication-held">
          This source&apos;s evidence is held from publication. The public record contains no current observations or private collection diagnostics.
        </EvidenceHoldNotice>
        {detail ? (
          <section className="mt-8 border border-line-strong bg-white p-5 md:p-7">
            <h2 className="text-2xl font-black">Measurement and coverage</h2>
            <dl className="mt-4 grid gap-px border border-line-strong bg-line-strong sm:grid-cols-2">
              <div className="bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wider text-gray-600">Publication period</dt><dd className="mt-2 text-sm leading-6">{detail.publicationPeriod}</dd></div>
              <div className="bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wider text-gray-600">Unit</dt><dd className="mt-2 text-sm leading-6">{detail.unit}</dd></div>
              <div className="bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wider text-gray-600">Revision status</dt><dd className="mt-2 text-sm leading-6">{detail.revisionStatus}</dd></div>
              <div className="bg-white p-4 sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-wider text-gray-600">Caveat</dt><dd className="mt-2 text-sm leading-6">{detail.caveat}</dd></div>
            </dl>
          </section>
        ) : null}
        {upstreams.length ? (
          <section className="mt-8 border-t border-line-strong pt-6">
            <h2 className="text-xl font-bold">Primary publisher material</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
              {upstreams.map((upstream) => (
                <li key={upstream.url}>
                  <a className="font-semibold underline" href={upstream.url} target="_blank" rel="noreferrer">{upstream.label ?? upstream.publisher ?? "Open publisher source"}</a>
                  {upstream.publisher && upstream.label ? ` · ${upstream.publisher}` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="mt-8 text-sm"><Link className="font-semibold underline" href="/sources/">All sources and methods</Link> · <Link className="font-semibold underline" href="/measure/">Browse the measure library</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(PUBLICATION_SOURCE_REGISTRY).map((id) => ({ id }));
}

async function sourceData(id: string, measureId?: string) {
  const snapshot = await readServerMetricsSnapshot();
  if (!snapshot) return { snapshot: null, measures: [], status: null, invalidMeasureSelection: false };
  const allMeasures = availableMeasures(snapshot.meta.measureCatalog);
  const selectedMeasures = selectSourceRecordMeasures(allMeasures, id, measureId);
  const measures = selectedMeasures ?? [];
  const status = snapshot.meta.sources[id] ?? null;
  return { snapshot, measures, status, invalidMeasureSelection: selectedMeasures === null };
}

function selectedMeasureId(value: string | string[] | undefined): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,160}$/.test(value) ? value : null;
}

function sourceTitle(id: string, measures: Awaited<ReturnType<typeof sourceData>>["measures"], measureId?: string) {
  if (measureId || measures.length === 1) return measures[0]?.label ?? id;
  if (id === "governmentContracts") return "Government contract award releases";
  const feed = (FEED_REGISTRY as Record<string, { title?: string }>)[id];
  const publication = (PUBLICATION_SOURCE_REGISTRY as Record<string, { title?: string }>)[id];
  return feed?.title ?? publication?.title ?? `${id} source collection`;
}

function formatEvidenceClass(value: string) {
  const label = value.replaceAll("-", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function displayEvidenceClass(
  measures: Awaited<ReturnType<typeof sourceData>>["measures"],
  provenance: unknown,
) {
  const labels = [...new Set(measures.map((measure) => measure.evidenceClass).filter(Boolean))]
    .sort()
    .map(formatEvidenceClass);
  if (labels.length === 1) return labels[0];
  if (labels.length > 1) return `Mixed: ${labels.join(", ")}`;
  if (provenance && typeof provenance === "object" && "evidenceClass" in provenance && typeof provenance.evidenceClass === "string") {
    return formatEvidenceClass(provenance.evidenceClass);
  }
  return "Not recorded";
}

export async function generateMetadata({ params, searchParams }: SourcePageProps): Promise<Metadata> {
  const { id } = await params;
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(id)) return {};
  if (!Object.hasOwn(PUBLICATION_SOURCE_REGISTRY, id) && !Object.hasOwn(FEED_REGISTRY, id)) return {};
  if (!publicationEnabled(id)) {
    const title = sourceTitle(id, []);
    return {
      title: `${title} source record`,
      description: `Publisher identity, measurement coverage and caveats for ${title}. Evidence is held from public release.`,
      alternates: { canonical: `https://public-data.org/sources/${encodeURIComponent(id)}/` },
    };
  }
  const query = process.env.STATIC_EXPORT === "true" ? {} : await searchParams;
  const measureId = selectedMeasureId(query.measure);
  if (measureId === null) return {};
  const { measures } = await sourceData(id, measureId);
  const title = sourceTitle(id, measures, measureId);
  const description = measureId
    ? `Publisher, source edition, observation and revision history for ${title}.`
    : `Publisher source collection, retrieval status, observations and retained revisions for ${title}.`;
  const canonical = `https://public-data.org/sources/${encodeURIComponent(id)}/${measureId ? `?measure=${encodeURIComponent(measureId)}` : ""}`;
  return { title: `${title} source record`, description, alternates: { canonical } };
}

export default async function SourceDetailPage({ params, searchParams }: SourcePageProps) {
  const { id } = await params;
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(id)) notFound();
  if (!Object.hasOwn(PUBLICATION_SOURCE_REGISTRY, id) && !Object.hasOwn(FEED_REGISTRY, id)) notFound();
  const query = process.env.STATIC_EXPORT === "true" ? {} : await searchParams;
  const measureId = selectedMeasureId(query.measure);
  if (measureId === null) notFound();
  if (!publicationEnabled(id)) {
    return <HeldSourceRecord id={id} title={sourceTitle(id, [], undefined)} />;
  }
  const [{ snapshot, measures, status, invalidMeasureSelection }, editions] = await Promise.all([sourceData(id, measureId), readEditionSummaries()]);
  if (snapshot && (measures.length === 0 || invalidMeasureSelection)) notFound();
  const sourceMeasure = measureId || measures.length === 1 ? measures[0] ?? null : null;
  const title = sourceTitle(id, measures, measureId);
  const measureIds = measures.map((measure) => measure.id);
  const sourceUrl = sourceMeasure?.sourceUrl;
  const provenance = !sourceMeasure && status && typeof status === "object" && "provenance" in status ? status.provenance : null;
  const evidenceClass = displayEvidenceClass(measures, provenance);
  const description = sourceMeasure
    ? `Source lineage for ${sourceMeasure.label}. The section check is shared with the containing collection; publisher and edition links below are specific to this measure.`
    : "This source collection may contain multiple publisher series. Each measure below keeps its own primary source and observation dates.";
  return <div className="min-h-screen bg-background text-foreground"><a href="#source-record" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to source record</a><SectionNav sections={SECTIONS}/><main id="source-record" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12"><header className="mb-8 border-b-4 border-foreground bg-surface-warm p-5 md:p-8"><p className="eyebrow">Publisher and source lineage</p><h1 className="mt-2 break-words text-5xl font-black tracking-[-0.06em] md:text-7xl">{title}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">{description} Later retrieval alone is not a revision.</p></header>{snapshot ? <><section className="grid gap-px border border-line-strong bg-line-strong sm:grid-cols-2 lg:grid-cols-5">{[["Collection section", id], ["Evidence class", evidenceClass], ["Section status", status?.status ?? "Not recorded"], ["Last section check", status?.fetchedAt ?? "Not recorded"], ["Measures", String(measures.length)]].map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-gray-600">{label}</p><p className="mt-2 break-words text-sm font-semibold">{value}</p></div>)}</section>{sourceMeasure && sourceUrl ? <p className="mt-5 text-sm">Primary publisher: <strong>{sourceMeasure.publisher ?? sourceMeasure.sourceId}</strong> · <a className="font-bold underline" href={sourceUrl} target="_blank" rel="noreferrer">Open primary publication</a> · edition {sourceMeasure.sourceEditionId}</p> : null}{provenance ? <details className="mt-5 border border-line bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Collection validation and retrieval method</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(provenance, null, 2)}</pre></details> : null}<section className="mt-10"><h2 className="text-2xl font-black">Measures in this source collection</h2><ul className="mt-4 list-none divide-y divide-line border-y border-line-strong bg-white p-0">{measures.map((measure) => <li key={measure.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-bold">{measure.label}</p><p className="mt-1 text-xs text-gray-600">{measure.observationPeriod.label} · edition {measure.sourceEditionId} · {measure.availability} · {measure.publisher ?? measure.sourceId}</p><a className="mt-2 inline-block text-xs font-semibold underline" href={measure.sourceUrl} target="_blank" rel="noreferrer">Primary publication</a></div><Link className="font-bold underline" href={`/measure/${encodeURIComponent(measure.id)}`}>Inspect full measure →</Link></li>)}</ul></section><div className="mt-10"><RevisionLedger summaries={editions ?? []} measureIds={measureIds}/></div><p className="mt-8 text-sm"><Link href="/editions/" className="font-bold underline">Browse the retained edition archive →</Link></p></> : <p role="status" className="border-l-4 border-accent bg-white p-6 text-sm">Current source metadata is unavailable. No source lineage has been inferred from an old citation.</p>}</main><SiteFooter/></div>;
}
