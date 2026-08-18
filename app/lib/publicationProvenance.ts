import { isCompatibleMetricsSnapshot } from "./metricsSnapshot";

export type PublicPublicationState = "ready" | "degraded" | "unknown";

export interface PublicationProvenance {
  publicationState: PublicPublicationState;
  registryVersion: string | null;
  missingRequiredCount: number;
  appRevision: string | null;
}

function shortRevision(value: string | null | undefined): string | null {
  const revision = typeof value === "string" ? value.trim() : "";
  if (!revision || revision === "local") return null;
  return revision.slice(0, 7);
}

export function publicationProvenanceFromSnapshot(
  snapshot: unknown,
  appRevision: string | null | undefined
): PublicationProvenance {
  const revision = shortRevision(appRevision);
  if (!isCompatibleMetricsSnapshot(snapshot)) {
    return {
      publicationState: "unknown",
      registryVersion: null,
      missingRequiredCount: 0,
      appRevision: revision,
    };
  }

  const rawState = snapshot.meta.publicationState;
  const publicationState: PublicPublicationState =
    rawState === "ready" || rawState === "degraded" ? rawState : "unknown";
  const missingRequiredSections = Array.isArray(
    snapshot.meta.missingRequiredSections
  )
    ? snapshot.meta.missingRequiredSections.filter(
        (section): section is string =>
          typeof section === "string" && section.trim().length > 0
      )
    : [];

  return {
    publicationState,
    registryVersion: snapshot.meta.registryVersion,
    missingRequiredCount:
      publicationState === "degraded" ? missingRequiredSections.length : 0,
    appRevision: revision,
  };
}
