import { isSnapshot } from "./publication-entry.js";
import { isPublicArtifact } from "../contracts/public-artifact.js";
import { FEED_REGISTRY_VERSION } from "./feed-registry.js";
import { filterCurrentSnapshot } from "./publication-currentness.js";
import { publicSnapshot } from "./public-snapshot.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";

const DEFAULT_PUBLICATION_SEED_URL =
  "https://public-data-org.pages.dev/data/metrics-snapshot.json";

function isPublicProjection(value) {
  return (
    isSnapshot(value) &&
    isPublicArtifact(value, { registryVersion: FEED_REGISTRY_VERSION })
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
