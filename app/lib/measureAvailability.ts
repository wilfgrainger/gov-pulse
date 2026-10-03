import type { MeasureDefinition } from "@/app/lib/measureDefinitions";
import type { MeasureRecord } from "@/app/lib/measureCatalog";
import { provenanceFor } from "@/worker/feed-registry.js";

type MeasureSource = {
  status?: string;
  provenance?: { upstreams?: { publisher?: string }[] };
};

export function measurePublisher(
  definition: MeasureDefinition,
  source?: MeasureSource | null,
) {
  if (definition.publisher) return definition.publisher;
  const fromEdition = source?.provenance?.upstreams
    ?.map((upstream) => upstream.publisher)
    .find((publisher): publisher is string => Boolean(publisher));
  const registeredSource = provenanceFor(definition.section) as {
    upstreams?: { publisher?: string }[];
  } | null;
  const fromRegistry = registeredSource?.upstreams
    ?.map((upstream) => upstream.publisher)
    .find((publisher): publisher is string => Boolean(publisher));
  return fromEdition ?? fromRegistry ?? "Publisher not identified";
}

export function measureAvailabilityReason(
  definition: MeasureDefinition,
  options: {
    record?: MeasureRecord | null;
    source?: MeasureSource | null;
    snapshotAvailable: boolean;
  },
) {
  const { record, source, snapshotAvailable } = options;
  if (record?.availability === "historical") {
    return `This verified publication is outside its current validity window${record.validUntil ? ` (valid through ${record.validUntil.slice(0, 10)})` : ""}.`;
  }
  if (record) return null;
  if (!snapshotAvailable) return "No current national evidence edition is available.";
  if (source?.status === "error" || !source) {
    return `${measurePublisher(definition, source)} evidence is unavailable in this edition; no value is shown.`;
  }
  return "No record passed the source, period and history checks for this edition.";
}
