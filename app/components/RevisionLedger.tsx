import Link from "next/link";
import type { EditionSummary } from "@/app/lib/serverEditionArchive";

function label(kind: string) {
  if (kind === "new-observation") return "New observation";
  if (kind === "revision") return "Publisher revision";
  if (kind === "metadata-change") return "Source metadata change";
  return "Method or definition change";
}

function valueChange(change: EditionSummary["changes"][number]) {
  if (change.kind === "method-change") return "Definition, method, unit or geography changed; no like-for-like value comparison is shown.";
  if (change.kind === "metadata-change") return "Source metadata changed; no numeric change is inferred.";
  const beforeUnit = change.previousUnit ?? change.nextUnit ?? "";
  const afterUnit = change.nextUnit ?? beforeUnit;
  const before = change.previous === null ? "not previously reported" : `${change.previous} ${beforeUnit}`.trim();
  const after = change.next === null ? "unavailable" : `${change.next} ${afterUnit}`.trim();
  return `${before} → ${after}`;
}

function SourceLinks({ change }: { change: EditionSummary["changes"][number] }) {
  return <span className="flex flex-wrap gap-x-3 gap-y-1">
    {change.previousSourceUrl ? <a className="underline" href={change.previousSourceUrl} target="_blank" rel="noopener noreferrer">Previous primary publication</a> : null}
    {change.nextSourceUrl ? <a className="underline" href={change.nextSourceUrl} target="_blank" rel="noopener noreferrer">Current primary publication</a> : null}
  </span>;
}

export default function RevisionLedger({ summaries, measureIds }: { summaries: EditionSummary[]; measureIds?: string[] }) {
  const editions = measureIds ? summaries.filter((summary) => summary.changes.some((change) => measureIds.includes(change.measureId))) : summaries;
  return <section aria-labelledby="revision-ledger-heading" className="border-y-2 border-foreground bg-white p-5 md:p-8">
    <p className="eyebrow">Dated publication changes</p>
    <h2 id="revision-ledger-heading" className="mt-2 text-3xl font-black">Revision ledger</h2>
    {editions.length ? <ol className="mt-5 list-none divide-y divide-line p-0">{editions.map((edition) => <li key={edition.id} className="py-4">
      <p className="font-mono text-xs text-gray-600">Catalog published {edition.publishedAt.slice(0, 10)} · edition {edition.id}</p>
      {edition.summaryCorrection ? <p className="mt-2 text-sm text-gray-700">{edition.summaryCorrection.note} <Link className="font-semibold underline" href={`/editions/${encodeURIComponent(edition.summaryCorrection.baselineEditionId)}`}>Open the retained baseline →</Link></p> : null}
      <ul className="mt-3 list-disc space-y-4 pl-5 text-sm">{edition.changes.filter((change) => !measureIds || measureIds.includes(change.measureId)).map((change, index) => <li key={`${change.measureId}-${change.period}-${index}`}>
        <strong>{change.measureId}</strong> · {label(change.kind)}{change.period ? ` · ${change.period} (${change.observedAt ?? "observation date unavailable"})` : ""}.
        <p className="mt-1">{valueChange(change)}</p>
        {change.changedFields?.length ? <p className="mt-1 text-gray-700">Changed metadata: {change.changedFields.join(", ")}.</p> : null}
        <p className="mt-1 text-xs text-gray-600">Source edition {change.previousSourceEditionId ?? "not previously recorded"} → {change.nextSourceEditionId}; source publication {change.previousSourcePublishedAt?.slice(0, 10) ?? "not recorded"} → {change.nextSourcePublishedAt?.slice(0, 10) ?? "not recorded"}; revision {change.previousRevisionId ?? "not previously recorded"} → {change.nextRevisionId}.</p>
        <SourceLinks change={change}/>
      </li>)}</ul>
      <Link className="mt-3 inline-block text-sm font-bold underline" href={`/editions/${encodeURIComponent(edition.id)}`}>Open historical edition →</Link>
    </li>)}</ol> : <p role="status" className="mt-4 text-sm leading-6 text-gray-700">No retained edition changes are available for this record. A new retrieval alone is not a correction.</p>}
  </section>;
}
