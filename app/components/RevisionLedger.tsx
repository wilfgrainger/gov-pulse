import Link from "next/link";
import type { EditionSummary } from "@/app/lib/serverEditionArchive";

export default function RevisionLedger({ summaries, measureIds }: { summaries: EditionSummary[]; measureIds?: string[] }) {
  const editions = measureIds ? summaries.filter((summary) => summary.changes.some((change) => measureIds.includes(change.measureId))) : summaries;
  return <section aria-labelledby="revision-ledger-heading" className="border-y-2 border-foreground bg-white p-5 md:p-8">
    <p className="eyebrow">Dated corrections</p><h2 id="revision-ledger-heading" className="mt-2 text-3xl font-black">Revision ledger</h2>
    {editions.length ? <ol className="mt-5 list-none divide-y divide-line p-0">{editions.map((edition) => <li key={edition.id} className="py-4"><p className="font-mono text-xs text-gray-600">Published {edition.publishedAt.slice(0, 10)} · edition {edition.id}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{edition.changes.filter((change) => !measureIds || measureIds.includes(change.measureId)).map((change, index) => <li key={`${change.measureId}-${change.period}-${index}`}><strong>{change.measureId}</strong> · {change.kind} · {change.period ?? "definition"}: {change.previous ?? "not previously available"} → {change.next ?? "unavailable"} <span className="text-gray-600">({change.previousSourceEditionId ?? "no earlier edition"} → {change.nextSourceEditionId})</span></li>)}</ul><Link className="mt-3 inline-block text-sm font-bold underline" href={`/editions/${encodeURIComponent(edition.id)}`}>Open historical edition →</Link></li>)}</ol> : <p role="status" className="mt-4 text-sm leading-6 text-gray-700">No retained edition changes are available for this record. A new retrieval alone is not a correction.</p>}
  </section>;
}
