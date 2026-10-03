import Link from "next/link";
import { measureForDisplay, validateMeasureRecord } from "@/app/lib/measureCatalog";
import { MEASURES } from "@/app/lib/measureDefinitions";

function archivedMeasure(catalog: unknown, id: string) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return null;
  const measures = (catalog as { measures?: unknown }).measures;
  if (!measures || typeof measures !== "object" || Array.isArray(measures) || !Object.hasOwn(measures, id)) return null;
  try { return validateMeasureRecord((measures as Record<string, unknown>)[id]); } catch { return null; }
}

export default function StoryEvidence({ measureIds, catalog }: { measureIds: string[]; catalog: unknown }) {
  const measures = measureIds.map((id) => {
    const current = measureForDisplay(catalog, id);
    return {
      id,
      definition: MEASURES.find((measure) => measure.id === id) ?? null,
      record: current ?? archivedMeasure(catalog, id),
      valueAvailable: current !== null,
    };
  });
  return <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6" aria-labelledby="story-evidence-heading">
    <h2 id="story-evidence-heading" className="text-2xl font-black">Referenced measures in the accepted edition</h2>
    <ul className="mt-4 grid list-none gap-px border border-line-strong bg-line-strong p-0 sm:grid-cols-2 lg:grid-cols-3">
      {measures.map(({ id, definition, record, valueAvailable }) => <li key={id} className="bg-white p-5">
        <p className="font-bold">{record?.label ?? definition?.label ?? id}</p>
        <p className="mt-2 text-2xl font-black">{valueAvailable && record?.value !== null ? `${record?.value} ${record?.unit}` : "Unavailable"}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{valueAvailable && record?.availability === "current" ? "Current accepted observation" : valueAvailable && record?.availability === "historical" ? "Historical edition · not a current headline" : record ? "Source evidence expired; value unavailable" : "No verified observation in this edition"}</p>
        <p className="mt-2 text-sm text-gray-700">{record?.basis ?? definition?.basis ?? "The published measure definition is unavailable."}</p>
        <p className="mt-2 text-xs text-gray-600">{record ? `${record.observationPeriod.label} · ${record.geography.label} · ${record.unit}` : definition ? `${definition.geography} · ${definition.unit} · ${definition.cadence}` : "No verified observation period."}</p>
        {record ? <p className="mt-1 text-xs text-gray-600">Published {record.publishedAt.slice(0, 10)} · source edition {record.sourceEditionId}</p> : <p className="mt-1 text-xs text-gray-600">The value, period and publication date are unavailable for this edition.</p>}
        {record?.sourceUrl ? <p className="mt-1 text-xs"><a className="break-all underline" href={record.sourceUrl}>Primary publication</a></p> : null}
        <p className="mt-2 text-xs leading-5 text-gray-700">{record?.caveats.length ? record.caveats.join(" ") : "No material caveat is available in this edition."}</p>
        <Link className="mt-3 inline-block text-sm font-semibold underline" href={`/measure/${encodeURIComponent(id)}/`}>Inspect source and history →</Link>
      </li>)}
    </ul>
  </section>;
}
