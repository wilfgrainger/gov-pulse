import { availableMeasures, compareEligibility, type MeasureCatalog, type MeasureRecord } from "@/app/lib/measureCatalog";
import { validateDateWindow, type DateWindow } from "@/app/lib/chartModel";

export type Workspace = { version: 1; measureIds: string[]; window: DateWindow; mode: "panels" | "overlay" };

function defaultWindow(records: MeasureRecord[]): DateWindow {
  const dates = records.flatMap((record) => record.points.map((point) => point.observedAt)).sort();
  const periodDates = records.flatMap((record) => [record.observationPeriod.start, record.observationPeriod.end]).sort();
  return { start: dates[0] ?? periodDates[0] ?? "1970-01-01", end: dates.at(-1) ?? periodDates.at(-1) ?? "1970-01-01" };
}

export function parseWorkspace(search: string, catalog: MeasureCatalog): Workspace {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const idsRaw = params.get("measure") ?? "";
  const measureIds = idsRaw ? idsRaw.split(",") : [];
  if (measureIds.length > 4 || new Set(measureIds).size !== measureIds.length || measureIds.some((id) => !id || !catalog.measures[id])) {
    throw new Error("Choose up to four distinct measures from the catalog.");
  }
  const all = availableMeasures(catalog);
  const records = measureIds.map((id) => all.find((record) => record.id === id)).filter((record): record is MeasureRecord => Boolean(record));
  if (records.length !== measureIds.length) throw new Error("One or more selected measures are unavailable or invalid.");
  const start = params.get("start");
  const end = params.get("end");
  if ((start && !end) || (!start && end)) throw new Error("Select both ends of the comparison date window.");
  const window = start && end ? validateDateWindow({ start, end }) : defaultWindow(records);
  const requestedMode = params.get("mode");
  if (requestedMode && requestedMode !== "overlay" && requestedMode !== "panels") throw new Error("Comparison mode must be panels or overlay.");
  const comparable = records.every((record, index) => index === 0 || compareEligibility(records[0], record) === "overlay");
  const mode = requestedMode === "overlay" && comparable ? "overlay" : "panels";
  return { version: 1, measureIds, window, mode };
}

export function workspaceUrl(workspace: Workspace): string {
  const params = new URLSearchParams();
  if (workspace.measureIds.length) params.set("measure", workspace.measureIds.join(","));
  params.set("start", workspace.window.start);
  params.set("end", workspace.window.end);
  params.set("mode", workspace.mode);
  return `/compare/?${params.toString()}`;
}
