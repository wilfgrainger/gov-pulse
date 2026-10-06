import { isSnapshot } from "./publication-entry.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";

const DEFAULT_PUBLICATION_SEED_URL =
  "https://public-data-org.pages.dev/data/metrics-snapshot.json";

async function fetchPublicationSeedSnapshot(env, fetchImpl = fetch) {
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
    return isSnapshot(payload) ? payload : null;
  } catch {
    return null;
  }
}

export {
  DEFAULT_PUBLICATION_SEED_URL,
  fetchPublicationSeedSnapshot,
};
