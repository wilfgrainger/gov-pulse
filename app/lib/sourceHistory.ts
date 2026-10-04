import type { MeasureRecord } from "@/app/lib/measureCatalog";

type SourceIdentity = Pick<MeasureRecord, "id" | "sourceId">;

export function sourceHistoryHref(measure: SourceIdentity) {
  return `/sources/${encodeURIComponent(measure.sourceId)}?measure=${encodeURIComponent(measure.id)}`;
}

export function selectSourceRecordMeasures(
  measures: readonly MeasureRecord[],
  sourceId: string,
  requestedMeasureId?: string,
): MeasureRecord[] | null {
  const sourceMeasures = measures.filter((measure) => measure.sourceId === sourceId);
  if (requestedMeasureId === undefined) return sourceMeasures;
  const selected = sourceMeasures.find((measure) => measure.id === requestedMeasureId);
  return selected ? [selected] : null;
}
