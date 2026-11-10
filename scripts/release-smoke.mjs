import { pathToFileURL } from "node:url";
import { MAX_PUBLIC_CACHE_LIFETIME_SECONDS, cacheLifetimeSeconds } from "./lib/cache-lifetime.mjs";

const RELEASE_PROPAGATION_ATTEMPTS = 25;
const RELEASE_PROPAGATION_RETRY_MS = 5000;

function assertCacheLifetime(path, response) {
  const lifetime = cacheLifetimeSeconds(response.headers.get("cache-control"));
  if (lifetime > MAX_PUBLIC_CACHE_LIFETIME_SECONDS)
    throw new Error(
      `${path || "/"} is cacheable for ${lifetime} s, above the ${MAX_PUBLIC_CACHE_LIFETIME_SECONDS} s limit`,
    );
}

// Code readiness and evidence readiness have different failure domains.
// Bound the release probe; full source diagnostics remain test:live / verify-production.
export async function releaseSmoke({
  url,
  revision,
  fetchImpl = fetch,
  attempts = RELEASE_PROPAGATION_ATTEMPTS,
  delay = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = console,
}) {
  if (!/^[a-f0-9]{40}$/i.test(revision ?? ""))
    throw new Error("A full commit SHA is required");
  const base = new URL(url);
  if (base.protocol !== "https:")
    throw new Error("An HTTPS release URL is required");
  let error;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const pages = await Promise.all(
        ["", "section/gdp/"].map(async (path) => {
          const response = await fetchImpl(new URL(path, base), {
            signal: AbortSignal.timeout(8000),
            cache: "no-store",
          });
          if (!response.ok)
            throw new Error(`${path || "/"} returned ${response.status}`);
          assertCacheLifetime(path, response);
          const html = await response.text();
          if (
            !new RegExp(
              `<meta\\s[^>]*(?:name=["']public-data-revision["'][^>]*content=["']${revision}["']|content=["']${revision}["'][^>]*name=["']public-data-revision["'])[^>]*>`,
              "i",
            ).test(html)
          )
            throw new Error(
              `${path || "/"} has not reached the expected revision`,
            );
          return path;
        }),
      );
      log.info(`Release revision verified on ${pages.length} reader routes.`);
      // A held notice, the snapshot and the feed must leave every cache within the cap.
      for (const path of ["section/nhs/", "data/metrics-snapshot.json", "feed.xml"]) {
        const response = await fetchImpl(new URL(path, base), {
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });
        assertCacheLifetime(path, response);
        await response.body?.cancel();
      }
      // Degradation is visible but does not hold a code release hostage to ONS/NHS.
      const health = await fetchImpl(new URL("data/health.json", base), {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!health.ok)
        throw new Error(`Evidence health route returned ${health.status}`);
      const status = await health.json();
      if (
        !status ||
        typeof status !== "object" ||
        typeof status.ready !== "boolean"
      )
        throw new Error("Evidence health route returned an invalid contract");
      // `held` lists required feeds that policy deliberately withholds. It is
      // informational: a held feed is neither a failure nor evidence.
      if (
        status.held !== undefined &&
        (!Array.isArray(status.held) ||
          !status.held.every((id) => typeof id === "string" && id.length > 0))
      )
        throw new Error("Evidence health route returned an invalid held list");
      if (Array.isArray(status.held) && status.held.length > 0)
        log.info(`Evidence feeds held by publication policy: ${status.held.join(", ")}.`);
      if (Array.isArray(status.failing) && status.failing.length > 0)
        log.warn(`Collectors failing while older evidence is shown: ${status.failing.join(", ")}.`);
      if (!status.ready)
        log.warn(
          "Evidence is degraded or unavailable; inspect source health separately.",
        );
      return;
    } catch (failure) {
      error = failure;
      if (attempt + 1 < attempts) await delay(RELEASE_PROPAGATION_RETRY_MS);
    }
  }
  throw error;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await releaseSmoke({ url: process.argv[2], revision: process.argv[3] });
}
