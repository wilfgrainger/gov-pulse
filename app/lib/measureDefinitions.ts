import inventory from "@/contracts/measure-definitions.json";

export type MeasureDefinition = {
  id: string;
  label: string;
  topic: string;
  section: string;
  route: string;
  geography: string;
  geographyCode: string;
  unit: string;
  basis: string;
  cadence: string;
  evidenceClass: "official-statistics" | "official-policy" | "administrative-data";
  publisher?: string;
  valuePath: string;
  valueMeasurePath?: string;
  valueMeasureId?: string;
  contextPath?: string;
  valueFromLatestHistory?: boolean;
  periodPath: string;
  publicationPath: string;
  historyPath?: string | null;
  historyValue?: string | null;
  note: string;
};

export type Measure = MeasureDefinition & {
  value: number | null;
  period: string | null;
  publishedAt: string | null;
  sourceUrl: string | null;
  history: { date: number; period: string; value: number }[];
  updateDue: boolean;
};

export const MEASURES: MeasureDefinition[] = inventory.measures.map((measure) => ({
  id: measure.id,
  label: measure.label,
  topic: measure.topic,
  section: measure.section,
  route: measure.route,
  geography: measure.geography.label,
  geographyCode: measure.geography.code,
  unit: measure.unit,
  basis: measure.basis,
  cadence: measure.cadence,
  evidenceClass: (measure.evidenceClass ?? "official-statistics") as MeasureDefinition["evidenceClass"],
  publisher: measure.publisher,
  valuePath: measure.valuePath ?? "",
  valueMeasurePath: measure.valueMeasurePath,
  valueMeasureId: measure.valueMeasureId,
  contextPath: measure.contextPath,
  valueFromLatestHistory: measure.valueFromLatestHistory ?? false,
  periodPath: measure.periodPath,
  publicationPath: measure.publishedPath,
  historyPath: measure.historyPath,
  historyValue: measure.historyValue,
  note: measure.note,
}));
