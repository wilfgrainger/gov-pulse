import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readArchivedEdition } from "@/app/lib/serverEditionArchive";
import { SECTIONS } from "@/app/lib/sections";

async function getEdition(id: string) { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(id) ? readArchivedEdition(id) : null; }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const edition = await getEdition(id);
  return edition ? { title: `Historical edition ${id}`, description: `Evidence archived as of ${edition.asOf.slice(0, 10)}. This edition is historical and is not a current reading.` } : {};
}

export default async function EditionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(id)) notFound();
  const edition = await getEdition(id);
  return <div className="min-h-screen bg-background text-foreground"><a href="#historical-edition" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to historical edition</a><SectionNav sections={SECTIONS}/><main id="historical-edition" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12"><header className="mb-8 border-b-4 border-foreground bg-surface-warm p-5 md:p-8"><p className="eyebrow">Historical edition · as of {edition?.asOf.slice(0, 10) ?? "unavailable"}</p><h1 className="mt-2 break-all text-4xl font-black tracking-[-0.06em] md:text-6xl">Edition {id}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">This is an immutable archived catalog. Values here describe that edition and must not be read as current observations.</p><Link href="/editions/" className="mt-4 inline-block text-sm font-bold underline">Back to all editions</Link></header>{edition ? <><section className="mb-8 border-y-2 border-foreground bg-white p-5"><h2 className="text-2xl font-black">Changes recorded at publication</h2>{edition.summary.changes.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">{edition.summary.changes.map((change, index) => <li key={`${change.measureId}-${change.period}-${index}`}><strong>{change.measureId}</strong> · {change.kind} · {change.period ?? "definition"}: {change.previous ?? "not previously available"} → {change.next ?? "unavailable"} · {change.previousSourceEditionId ?? "none"} → {change.nextSourceEditionId}</li>)}</ul> : <p className="mt-3 text-sm">No difference from the preceding archived publication was recorded.</p>}</section><div className="space-y-10">{Object.values(edition.measureCatalog.measures).map((record) => { const historical = { ...record, availability: "historical" as const }; const dates = record.points.map((point) => point.observedAt); const window = { start: dates[0] ?? record.observationPeriod.start, end: dates.at(-1) ?? record.observationPeriod.end }; return <section key={record.id} className="border-y border-line-strong bg-white p-4 md:p-6"><p className="eyebrow">As-of observation: {record.observationPeriod.label}</p><p className="mb-3 text-sm text-gray-700">Archived value: {record.value === null ? "Unavailable" : `${record.value} ${record.unit}`} · {record.availability} at capture · source edition {record.sourceEditionId}</p><EvidenceFigure measure={historical} title={`${record.label}: archived observations`} description={`${record.basis}. Historical archived record from ${edition.asOf.slice(0, 10)}.`} window={window} variant="line"/><p className="mt-3 text-xs text-gray-600">Source: <a className="font-bold underline" href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceId} · {record.sourceEditionId}</a></p></section>; })}</div></> : <p role="status" className="border-l-4 border-accent bg-white p-6 text-sm">This edition is not in the retained archive or the archive service is temporarily unavailable.</p>}</main><SiteFooter/></div>;
}
