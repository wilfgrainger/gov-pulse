import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRoutePublished } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readArchivedEdition, type ArchivedEdition } from "@/app/lib/serverEditionArchive";
import { SITE_DISCOVERY } from "@/app/lib/discovery";
import { SECTIONS } from "@/app/lib/sections";

const STATIC_FALLBACK_ARCHIVE_ID = "_archive_unavailable";

async function getEdition(id: string) { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(id) ? readArchivedEdition(id) : null; }

// Build one honest unavailable route in both outputs. Pages has no archive
// payload; the Worker renders real IDs on demand.
export function generateStaticParams() {
  return [{ id: STATIC_FALLBACK_ARCHIVE_ID }];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Historical edition ${id}`,
    description: "An immutable archived evidence catalog. Values describe their publication date and are not current readings.",
  };
}

function changeTitle(kind: string) {
  if (kind === "new-observation") return "New observation";
  if (kind === "revision") return "Publisher revision";
  if (kind === "metadata-change") return "Source metadata change";
  return "Method or definition change";
}

function changeValue(change: ArchivedEdition["summary"]["changes"][number]) {
  if (change.kind === "method-change") return "Definition, method, unit or geography changed; values are not compared as like-for-like.";
  if (change.kind === "metadata-change") return "Source metadata changed; no numeric change is inferred.";
  const beforeUnit = change.previousUnit ?? change.nextUnit ?? "";
  const afterUnit = change.nextUnit ?? beforeUnit;
  const before = change.previous === null ? "not previously reported" : `${change.previous} ${beforeUnit}`.trim();
  const after = change.next === null ? "unavailable" : `${change.next} ${afterUnit}`.trim();
  return `${before} → ${after}`;
}

function EditionChanges({ edition }: { edition: ArchivedEdition }) {
  return <section className="mb-8 border-y-2 border-foreground bg-white p-5">
    <h2 className="text-2xl font-black">Changes recorded at publication</h2>
    {edition.summary.summaryCorrection ? <p className="mt-3 text-sm leading-6 text-gray-700">{edition.summary.summaryCorrection.note} <Link className="font-semibold underline" href={`/editions/${encodeURIComponent(edition.summary.summaryCorrection.baselineEditionId)}`}>Open the retained baseline →</Link></p> : null}
    {edition.summary.changes.length ? <ul className="mt-4 list-disc space-y-4 pl-5 text-sm">{edition.summary.changes.map((change, index) => <li key={`${change.measureId}-${change.period}-${index}`}>
      <strong>{change.measureId}</strong> · {changeTitle(change.kind)}{change.period ? ` · ${change.period} (${change.observedAt ?? "observation date unavailable"})` : ""}: {changeValue(change)}
      {change.changedFields?.length ? <p className="mt-1">Changed fields: {change.changedFields.join(", ")}.</p> : null}
      <p className="mt-1 text-xs text-gray-600">Source edition {change.previousSourceEditionId ?? "not previously recorded"} → {change.nextSourceEditionId}; source publication {change.previousSourcePublishedAt?.slice(0, 10) ?? "not recorded"} → {change.nextSourcePublishedAt?.slice(0, 10) ?? "not recorded"}; revision {change.previousRevisionId ?? "not previously recorded"} → {change.nextRevisionId}.</p>
      <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
        {change.previousSourceUrl ? <a className="underline" href={change.previousSourceUrl} target="_blank" rel="noopener noreferrer">Previous primary publication</a> : null}
        {change.nextSourceUrl ? <a className="underline" href={change.nextSourceUrl} target="_blank" rel="noopener noreferrer">Current primary publication</a> : null}
      </p>
    </li>)}</ul> : <p className="mt-3 text-sm">No difference from the preceding archived publication was recorded.</p>}
  </section>;
}

export default async function EditionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!publicationRoutePublished(`/editions/${id}/`)) return <PublicationOffline />;
  const staticFallback = id === STATIC_FALLBACK_ARCHIVE_ID;
  if (!staticFallback && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(id)) notFound();
  if (!staticFallback) await connection();
  const edition = staticFallback ? null : await getEdition(id);
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#historical-edition" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to historical edition</a>
    <SectionNav sections={SECTIONS}/>
    <main id="historical-edition" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="mb-8 border-b-4 border-foreground bg-surface-warm p-5 md:p-8">
        <p className="eyebrow">{staticFallback ? "Static fallback" : `Historical edition · as of ${edition?.asOf.slice(0, 10) ?? "unavailable"}`}</p>
        <h1 className="mt-2 break-all text-4xl font-black tracking-[-0.06em] md:text-6xl">{staticFallback ? "Edition details unavailable" : `Edition ${id}`}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">{staticFallback ? "This bounded static seed contains no archived edition details. No historical data has been invented." : "This is an immutable archived catalog. Values here describe that edition and must not be read as current observations."}</p>
        {staticFallback
          ? <a href={`${SITE_DISCOVERY.origin}/editions/`} className="mt-4 inline-block text-sm font-bold underline">Open the live edition archive</a>
          : <Link href="/editions/" className="mt-4 inline-block text-sm font-bold underline">Back to all editions</Link>}
      </header>
      {edition ? <>
        <EditionChanges edition={edition}/>
        <div className="space-y-10">{Object.values(edition.measureCatalog.measures).map((record) => {
          const historical = { ...record, availability: "historical" as const };
          const dates = record.points.map((point) => point.observedAt);
          const window = { start: dates[0] ?? record.observationPeriod.start, end: dates.at(-1) ?? record.observationPeriod.end };
          return <section key={record.id} className="border-y border-line-strong bg-white p-4 md:p-6">
            <p className="eyebrow">As-of observation: {record.observationPeriod.label}</p>
            <p className="mb-3 text-sm text-gray-700">Archived value: {record.value === null ? "Unavailable" : `${record.value} ${record.unit}`} · {record.availability} at capture · source edition {record.sourceEditionId}</p>
            <EvidenceFigure measure={historical} title={`${record.label}: archived observations`} description={`${record.basis}. Historical archived record from ${edition.asOf.slice(0, 10)}.`} window={window} variant="line"/>
            <p className="mt-3 text-xs text-gray-600">Source: <a className="font-bold underline" href={record.sourceUrl} target="_blank" rel="noopener noreferrer">{record.publisher ?? record.sourceId} · {record.sourceEditionId}</a> · source publication {record.publishedAt.slice(0, 10)}</p>
          </section>;
        })}</div>
      </> : <p role="status" className="border-l-4 border-accent bg-white p-6 text-sm">{staticFallback ? "The static fallback does not retain historical editions. Use the live archive link above." : "This edition is not in the retained archive or the archive service is temporarily unavailable."}</p>}
    </main>
    <SiteFooter/>
  </div>;
}
