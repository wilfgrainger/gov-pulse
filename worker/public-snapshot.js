import { snapshotValidityDeadline } from "./publication-currentness.js";

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
    delete snapshot.meta.publicationMode;
    delete snapshot.meta.freeTierBudget;
  }
  return snapshot;
}

function buildPublicSnapshotArtifact(value, now = new Date()) {
  const snapshot = publicSnapshot(value);
  const validUntilMs = snapshotValidityDeadline(value, now);
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
  buildPublicSnapshotArtifact,
  publicSnapshot,
  sanitizePublishedValue,
};
