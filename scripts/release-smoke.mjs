import { pathToFileURL } from "node:url";

// Code readiness and evidence readiness have different failure domains.
// Bound the release probe; full source diagnostics remain test:live / verify-production.
export async function releaseSmoke({
  url,
  revision,
  fetchImpl = fetch,
  attempts = 3,
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
      if (!status.ready)
        log.warn(
          "Evidence is degraded or unavailable; inspect source health separately.",
        );
      return;
    } catch (failure) {
      error = failure;
      if (attempt + 1 < attempts) await delay(3000);
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
