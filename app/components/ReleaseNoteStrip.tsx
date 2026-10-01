import type { ReleaseNote } from "@/app/lib/releaseNote";

/**
 * A small, dated byline-style strip that renders a release note's strictly
 * factual, data-derived sentences. Visually distinct from the chart and
 * explainer rail: a thin left rule, muted type, and an explicit "Release
 * note" label so a reader never mistakes it for editorial commentary or an
 * official source quotation.
 */
export default function ReleaseNoteStrip({
  idPrefix,
  note,
}: {
  idPrefix: string;
  note: ReleaseNote;
}) {
  if (note.sentences.length === 0) return null;

  return (
    <aside
      aria-labelledby={`${idPrefix}-release-note-title`}
      data-testid="release-note"
      className="border-l-2 border-dashed border-black/30 bg-[#f7f8f9] py-3 pl-4 text-sm leading-6 text-gray-700"
    >
      <p id={`${idPrefix}-release-note-title`} className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
        Release note
      </p>
      <p className="mt-1">{note.text}</p>
    </aside>
  );
}
