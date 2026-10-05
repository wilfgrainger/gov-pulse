/**
 * Compare door: start from exactly one published indicator.
 * Overlay peers must share a validated definition; country peers stay unavailable
 * while the international comparison publication is off. No invented figures.
 */

import {
  availableMeasures,
  compareEligibility,
  type MeasureCatalog,
  type MeasureRecord,
} from "@/app/lib/measureCatalog";
import { workspaceUrl, type Workspace } from "@/app/lib/comparisonWorkspace";

export type OneIndicatorSummary = {
  id: string;
  label: string;
  unit: string;
  geographyLabel: string;
  geographyCode: string;
  periodLabel: string;
  value: number | null;
  sourceUrl: string;
  availability: MeasureRecord["availability"];
};

export type OneIndicatorResult =
  | { status: "no-catalog" }
  | { status: "no-current-measure"; query?: string }
  | {
      status: "ready";
      primary: OneIndicatorSummary;
      overlayPeers: OneIndicatorSummary[];
      countryPeersAvailable: false;
      countryPeersReason: string;
      studioUrl: string;
    };

function summarise(record: MeasureRecord): OneIndicatorSummary {
  return {
    id: record.id,
    label: record.label,
    unit: record.unit,
    geographyLabel: record.geography.label,
    geographyCode: record.geography.code,
    periodLabel: record.observationPeriod.label,
    value: record.value,
    sourceUrl: record.sourceUrl,
    availability: record.availability,
  };
}

function rankCurrent(left: MeasureRecord, right: MeasureRecord): number {
  const leftPoints = left.points.filter(({ value }) => value !== null).length;
  const rightPoints = right.points.filter(({ value }) => value !== null).length;
  return (
    rightPoints - leftPoints ||
    right.observationPeriod.end.localeCompare(left.observationPeriod.end) ||
    left.id.localeCompare(right.id, "en-GB")
  );
}

export function summariseOneIndicator(record: MeasureRecord): OneIndicatorSummary {
  return summarise(record);
}

export function overlayPeersFor(primary: MeasureRecord, catalog: MeasureCatalog, now = new Date()): MeasureRecord[] {
  return availableMeasures(catalog, now)
    .filter((measure) => measure.id !== primary.id && compareEligibility(primary, measure) === "overlay")
    .sort(rankCurrent);
}

/**
 * Resolve one indicator for the Compare door.
 * Country peers are fail-closed while internationalComparison stays disabled.
 */
export function resolveOneIndicator(
  catalog: MeasureCatalog | null | undefined,
  measureId?: string | null,
  now = new Date(),
): OneIndicatorResult {
  if (!catalog) return { status: "no-catalog" };

  const current = availableMeasures(catalog, now).filter((measure) => measure.availability === "current");
  if (current.length === 0) {
    return { status: "no-current-measure", query: measureId?.trim() || undefined };
  }

  const requested = measureId?.trim();
  const primary = requested
    ? current.find((measure) => measure.id === requested) ?? null
    : [...current].sort(rankCurrent)[0] ?? null;

  if (!primary) {
    return { status: "no-current-measure", query: requested || undefined };
  }

  const peers = overlayPeersFor(primary, catalog, now).map(summarise);
  const workspace: Workspace = {
    version: 1,
    measureIds: [primary.id],
    window: {
      start: primary.observationPeriod.start,
      end: primary.observationPeriod.end,
    },
    mode: "panels",
  };

  return {
    status: "ready",
    primary: summarise(primary),
    overlayPeers: peers,
    countryPeersAvailable: false,
    countryPeersReason:
      "Country peers stay unavailable while the UK-in-context publication is offline. This Compare door will not invent a peer table.",
    studioUrl: workspaceUrl(workspace),
  };
}
