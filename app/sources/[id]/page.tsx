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

async function sourceData(id: string) {
  const snapshot = await readServerMetricsSnapshot();
  if (!snapshot) return { snapshot: null, measures: [], status: null };
  const measures = availableMeasures(snapshot.meta.measureCatalog).filter((measure) => measure.sourceId === id);
  const status = snapshot.meta.sources[id] ?? null;
  return { snapshot, measures, status };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(id)) return {};
  const { measures } = await sourceData(id);
  return { title: `${measures[0]?.label ?? id} source record`, description: `Source edition, retrieval, observation, validity and revision history for ${id}.` };
}

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(id)) notFound();
  const [{ snapshot, measures, status }, editions] = await Promise.all([sourceData(id), readEditionSummaries()]);
  if (snapshot && measures.length === 0) notFound();
  const measureIds = measures.map((measure) => measure.id);
  const sourceUrl = measures[0]?.sourceUrl;
  const provenance = status && typeof status === "object" && "provenance" in status ? status.provenance : null;
  return <div className="min-h-screen bg-background text-foreground"><a href="#source-record" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to source record</a><SectionNav sections={SECTIONS}/><main id="source-record" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12"><header className="mb-8 border-b-4 border-foreground bg-surface-warm p-5 md:p-8"><p className="eyebrow">Publisher and source lineage</p><h1 className="mt-2 break-words text-5xl font-black tracking-[-0.06em] md:text-7xl">{measures[0]?.label ?? id}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">This source record keeps the latest accepted edition, retrieval health, publication dates, validity and corrections together. Later retrieval alone is not a revision.</p></header>{snapshot ? <><section className="grid gap-px border border-line-strong bg-line-strong sm:grid-cols-2 lg:grid-cols-4">{[["Source id", id], ["Current status", status?.status ?? "Not recorded"], ["Last successful check", status?.fetchedAt ?? "Not recorded"], ["Measures", String(measures.length)]].map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-gray-600">{label}</p><p className="mt-2 break-words text-sm font-semibold">{value}</p></div>)}</section>{sourceUrl ? <p className="mt-5 text-sm">Publisher: <a className="font-bold underline" href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl}</a></p> : null}{provenance ? <details className="mt-5 border border-line bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Source validation and retrieval method</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(provenance, null, 2)}</pre></details> : null}<section className="mt-10"><h2 className="text-2xl font-black">Measures supplied by this source</h2><ul className="mt-4 list-none divide-y divide-line border-y border-line-strong bg-white p-0">{measures.map((measure) => <li key={measure.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-bold">{measure.label}</p><p className="mt-1 text-xs text-gray-600">{measure.observationPeriod.label} · edition {measure.sourceEditionId} · {measure.availability}</p></div><Link className="font-bold underline" href={`/measure/${encodeURIComponent(measure.id)}`}>Inspect full measure →</Link></li>)}</ul></section><div className="mt-10"><RevisionLedger summaries={editions ?? []} measureIds={measureIds}/></div><p className="mt-8 text-sm"><Link href="/editions/" className="font-bold underline">Browse the retained edition archive →</Link></p></> : <p role="status" className="border-l-4 border-accent bg-white p-6 text-sm">Current source metadata is unavailable. No source lineage has been inferred from an old citation.</p>}</main><SiteFooter/></div>;
}
