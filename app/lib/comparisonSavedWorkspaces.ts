import { availableMeasures, type MeasureCatalog } from "@/app/lib/measureCatalog";
import { MAX_COMPARISON_MEASURES, parseWorkspace, workspaceUrl, type Workspace } from "@/app/lib/comparisonWorkspace";
import { validateDateWindow } from "@/app/lib/chartModel";

export type NamedComparisonWorkspace = {
  id: string;
  name: string;
  workspace: Workspace;
  unavailableMeasureIds: string[];
};

export type NamedComparisonWorkspaceFile = {
  version: 1;
  workspaces: NamedComparisonWorkspace[];
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function savedWorkspace(value: unknown, catalog: Pick<MeasureCatalog, "measures">): NamedComparisonWorkspace {
  const candidate = object(value);
  const state = object(candidate?.workspace);
  const dates = object(state?.window);
  if (
    typeof candidate?.id !== "string" || !/^[\w-]{8,80}$/.test(candidate.id) ||
    typeof candidate.name !== "string" || !candidate.name.trim() || candidate.name.length > 80 ||
    state?.version !== 1 || !Array.isArray(state.measureIds) || state.measureIds.length > MAX_COMPARISON_MEASURES ||
    state.measureIds.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(state.measureIds as string[]).size !== state.measureIds.length ||
    typeof dates?.start !== "string" || typeof dates.end !== "string" ||
    (state.mode !== "panels" && state.mode !== "overlay")
  ) {
    throw new Error("A saved comparison has an invalid id, name or versioned selection.");
  }

  const window = validateDateWindow({ start: dates.start, end: dates.end });
  const measureIds = state.measureIds as string[];
  const availableIds = new Set(availableMeasures(catalog).map(({ id }) => id));
  const unavailableMeasureIds = measureIds.filter((id) => !availableIds.has(id));
  const workspace: Workspace = unavailableMeasureIds.length
    ? { version: 1, measureIds, window, mode: state.mode }
    : parseWorkspace(workspaceUrl({ version: 1, measureIds, window, mode: state.mode }).split("?")[1] ?? "", catalog);

  return {
    id: candidate.id,
    name: candidate.name.trim(),
    workspace,
    unavailableMeasureIds,
  };
}

export function parseNamedComparisonWorkspaces(input: unknown, catalog: Pick<MeasureCatalog, "measures">): NamedComparisonWorkspaceFile {
  const candidate = object(input);
  if (candidate?.version !== 1 || !Array.isArray(candidate.workspaces)) {
    throw new Error("Workspace file must contain a version 1 workspace list.");
  }
  const workspaces = candidate.workspaces.map((entry) => savedWorkspace(entry, catalog));
  if (new Set(workspaces.map(({ id }) => id)).size !== workspaces.length) {
    throw new Error("Workspace file contains duplicate ids.");
  }
  return { version: 1, workspaces };
}
