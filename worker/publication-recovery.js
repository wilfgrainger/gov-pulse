import { isSnapshot } from "./publication-entry.js";
import { isPublicArtifact } from "../contracts/public-artifact.js";
import { FEED_REGISTRY_VERSION } from "../feeds/registry.js";
import { filterCurrentSnapshot, filterPublicationSnapshot } from "../contracts/evidence-policy.js";
import { publicSnapshot } from "./public-snapshot.js";
import { frozenHostSet } from "./approved-source-hosts.js";
import {
  cancelResponseBody,
  fetchWithApprovedRedirects,
  readResponseJson,
} from "./response-limits.js";

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
    // The seed URL is operator configuration, so its own host is the only
    // approved origin; it must still be HTTPS and redirects may not leave it.
    let seedHost;
    try {
      seedHost = new URL(url).hostname;
    } catch {
      return null;
    }
    const response = await fetchWithApprovedRedirects(
      url,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      },
      frozenHostSet([seedHost]),
      fetchImpl,
      "Pages seed"
    );
    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }

    const payload = await readResponseJson(response, {
      label: "Pages seed JSON",
    });
    const accepted = acceptedRecoveryArtifact(payload, now);
    if (accepted) return accepted;
    const current = filterCurrentSnapshot(payload, now);
    if (!current) return null;
    const filtered = filterPublicationSnapshot(current);
    if (!filtered) return null;
    const meta = payload?.meta;
    if (
      meta?.backend === "cloudflare-worker-kv" ||
      meta?.generator === "cloudflare-free-publication-worker"
    ) {
      return null;
    }
    return filtered;
  } catch {
    return null;
  }
}

export {
  DEFAULT_PUBLICATION_SEED_URL,
  acceptedRecoveryArtifact,
  fetchPublicationSeedSnapshot,
};
