import { availableMeasures, compareEligibility, type MeasureCatalog, type MeasureRecord } from "@/app/lib/measureCatalog";
import { validateDateWindow, type DateWindow } from "@/app/lib/chartModel";

export type Workspace = { version: 1; measureIds: string[]; window: DateWindow; mode: "panels" | "overlay" };

function defaultWindow(records: MeasureRecord[], available: MeasureRecord[]): DateWindow {
  const scope = records.length ? records : available;
  const dates = scope.flatMap((record) => record.points.map((point) => point.observedAt)).sort();
  const periodDates = scope.flatMap((record) => [record.observationPeriod.start, record.observationPeriod.end]).sort();
  return {
    start: dates[0] ?? periodDates[0] ?? "2020-01-01",
    end: dates.at(-1) ?? periodDates.at(-1) ?? new Date().toISOString().slice(0, 10),
  };
}

function startingMeasureIds(measures: MeasureRecord[]) {
  for (let left = 0; left < measures.length; left += 1) {
    for (let right = left + 1; right < measures.length; right += 1) {
      if (compareEligibility(measures[left], measures[right]) === "overlay") {
        return [measures[left].id, measures[right].id];
      }
    }
  }
  return measures.slice(0, 2).map((measure) => measure.id);
}

export function parseWorkspace(search: string, catalog: MeasureCatalog): Workspace {
  if (search.length > 2048) throw new Error("Comparison workspace URL is too large.");
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of ["measure", "start", "end", "mode"]) {
    if (params.getAll(key).length > 1) throw new Error(`Comparison workspace parameter '${key}' is repeated.`);
  }
  const all = availableMeasures(catalog);
  const idsRaw = params.get("measure") ?? "";
  const measureIds = idsRaw
    ? idsRaw.split(",")
    : !params.has("measure") && params.size === 0
      ? startingMeasureIds(all)
      : [];
  if (measureIds.length > 4 || new Set(measureIds).size !== measureIds.length || measureIds.some((id) => !id || !catalog.measures[id])) {
    throw new Error("Choose up to four distinct measures from the catalog.");
  }
  const records = measureIds.map((id) => all.find((record) => record.id === id)).filter((record): record is MeasureRecord => Boolean(record));
  if (records.length !== measureIds.length) throw new Error("One or more selected measures are unavailable or invalid.");
  const start = params.get("start");
  const end = params.get("end");
  if ((start && !end) || (!start && end)) throw new Error("Select both ends of the comparison date window.");
  const window = start && end ? validateDateWindow({ start, end }) : defaultWindow(records, all);
  const requestedMode = params.get("mode");
  if (requestedMode && requestedMode !== "overlay" && requestedMode !== "panels") throw new Error("Comparison mode must be panels or overlay.");
  const comparable = records.every((record, index) => index === 0 || compareEligibility(records[0], record) === "overlay");
  const startsOverlay = records.length > 1 && comparable && (
    requestedMode === "overlay" || (!requestedMode && params.size === 0)
  );
  const mode = startsOverlay ? "overlay" : "panels";
  return { version: 1, measureIds, window, mode };
}

export function workspaceUrl(workspace: Workspace): string {
  const params = new URLSearchParams();
  params.set("measure", workspace.measureIds.join(","));
  params.set("start", workspace.window.start);
  params.set("end", workspace.window.end);
  params.set("mode", workspace.mode);
  return `/compare/?${params.toString()}`;
}
