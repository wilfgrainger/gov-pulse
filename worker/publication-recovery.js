import { isSnapshot } from "./publication-entry.js";
import { filterCurrentSnapshot } from "./publication-currentness.js";
import { publicSnapshot } from "./public-snapshot.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";

const DEFAULT_PUBLICATION_SEED_URL =
  "https://public-data-org.pages.dev/data/metrics-snapshot.json";

function isPublicProjection(value) {
  if (!isSnapshot(value)) return false;
  const projection = value.meta?.publicProjection;
  if (
    !projection ||
    typeof projection !== "object" ||
    Array.isArray(projection) ||
    projection.state !== "published" ||
    !Array.isArray(projection.publishedSections)
  ) return false;
  const sourceIds = Object.keys(value.meta.sources).sort();
  const projectedIds = [...projection.publishedSections].sort();
  return (
    sourceIds.length > 0 &&
    projectedIds.every((id) => typeof id === "string") &&
    JSON.stringify(sourceIds) === JSON.stringify(projectedIds)
  );
}

function acceptedRecoveryArtifact(value, now = new Date()) {
  if (!isPublicProjection(value)) return null;
  if (JSON.stringify(publicSnapshot(value)) !== JSON.stringify(value)) return null;
  const current = filterCurrentSnapshot(value, now);
  if (!current?.meta?.sources) return null;
  return JSON.stringify(Object.keys(current.meta.sources).sort()) ===
    JSON.stringify(Object.keys(value.meta.sources).sort())
    ? value
    : null;
}

async function fetchPublicationSeedSnapshot(env, fetchImpl = fetch, now = new Date()) {
  const url = String(
    env?.STATIC_SNAPSHOT_SEED_URL || DEFAULT_PUBLICATION_SEED_URL
  ).trim();
  if (!url) return null;

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;

    assertSameHttpsHost(response, url, "Pages seed");
    const payload = await readResponseJson(response, {
      label: "Pages seed JSON",
    });
    return acceptedRecoveryArtifact(payload, now);
  } catch {
    return null;
  }
}

export {
  DEFAULT_PUBLICATION_SEED_URL,
  acceptedRecoveryArtifact,
  fetchPublicationSeedSnapshot,
};
