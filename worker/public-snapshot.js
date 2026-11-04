import { filterPublicationSnapshot } from "../contracts/publication-policy.js";
import {
  filterCurrentSnapshot,
  snapshotValidityDeadline,
} from "./publication-currentness.js";

const PUBLIC_SNAPSHOT_KEY = "v14:publication:public";

function sanitizePublishedValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizePublishedValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nestedValue]) => {
      if (key === "backend" || key === "generator") return [];
      if (
        key === "retrieval" &&
        typeof nestedValue === "string" &&
        /github|cloudflare|worker/i.test(nestedValue)
      ) {
        return [[key, "scheduled-publication-check"]];
      }
      return [[key, sanitizePublishedValue(nestedValue)]];
    })
  );
}

function publicSnapshot(value) {
  const snapshot = sanitizePublishedValue(value);
  if (snapshot?.meta && typeof snapshot.meta === "object") {
    delete snapshot.meta.publicationDiagnostics;
    delete snapshot.meta.measureCatalogDiagnostics;
    delete snapshot.meta.publicationMode;
    delete snapshot.meta.freeTierBudget;
    delete snapshot.meta.publicationState;
    delete snapshot.meta.missingRequiredSections;
    if (snapshot.meta.sources && typeof snapshot.meta.sources === "object") {
      for (const source of Object.values(snapshot.meta.sources)) {
        if (source && typeof source === "object") delete source.error;
      }
    }
  }
  return snapshot;
}

function buildPublicProjection(value, now = new Date()) {
  const current = filterCurrentSnapshot(value, now);
  if (!current?.meta?.sources || Object.keys(current.meta.sources).length === 0) {
    throw new Error("Public snapshot has no current source-owned evidence");
  }

  const projection = filterPublicationSnapshot(current);
  if (!projection?.meta?.sources || Object.keys(projection.meta.sources).length === 0) {
    throw new Error("Public snapshot has no evidence approved for publication");
  }

  projection.meta.publicProjection = {
    state: "published",
    publishedSections: Object.keys(projection.meta.sources).sort(),
  };
  return publicSnapshot(projection);
}

function buildPublicSnapshotArtifact(value, now = new Date()) {
  const snapshot = buildPublicProjection(value, now);
  const validUntilMs = snapshotValidityDeadline(snapshot, now);
  if (!Number.isFinite(validUntilMs)) {
    throw new Error("Public snapshot has no valid currentness deadline");
  }

  return {
    body: JSON.stringify(snapshot),
    metadata: {
      generatedAt:
        typeof snapshot?.meta?.generatedAt === "string"
          ? snapshot.meta.generatedAt
          : null,
      registryVersion:
        typeof snapshot?.meta?.registryVersion === "string"
          ? snapshot.meta.registryVersion
          : null,
      validUntil: new Date(validUntilMs).toISOString(),
    },
  };
}

export {
  PUBLIC_SNAPSHOT_KEY,
  buildPublicProjection,
  buildPublicSnapshotArtifact,
  publicSnapshot,
  sanitizePublishedValue,
};
