// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import dataWorker, { cacheControlFor } from "@/worker/public-data-entry";

describe("Cloudflare resource-budget cache contract", () => {
  it("enables Workers Caching only for the data Worker and isolates deploy versions", () => {
    const data = readFileSync("worker/wrangler.toml", "utf8");
    const web = readFileSync("worker/web-wrangler.toml", "utf8");

    // An evidence-policy change must invalidate responses produced by an
    // earlier Worker version, even when those responses have unexpired TTLs.
    expect(data).toMatch(/\[cache\]\s*enabled = true\s*cross_version_cache = false/);
    expect(data).toMatch(/name = "pulse-data-worker"/);
    expect(web).not.toMatch(/^\[cache\]/m);
  });

  it("never extends a shared cached snapshot past its evidence validity", () => {
    const now = new Date("2026-10-22T08:00:00.000Z");
    expect(cacheControlFor("2026-10-22T08:00:20.000Z", now))
      .toBe("public, max-age=20, s-maxage=20, stale-while-revalidate=0");
    expect(cacheControlFor("2026-10-22T08:00:00.000Z", now)).toBe("no-store");
    expect(cacheControlFor(null, now)).toBe("no-store");
  });

  it("does not cache health or unavailable publication responses", async () => {
    const health = await dataWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      {},
    );
    expect(health.headers.get("Cache-Control")).toBe("no-store");

    const withheldComparison = await dataWorker.fetch(
      new Request("https://public-data.org/data/international-comparison.json"),
      {},
    );
    expect(withheldComparison.status).toBe(503);
    expect(withheldComparison.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps historical edition details outside the shared response cache", async () => {
    const detail = await dataWorker.fetch(
      new Request("https://public-data.org/data/edition.json?edition=not-found"),
      { METRICS_CACHE: { getWithMetadata: async () => ({ value: null, metadata: null }) } },
    );
    expect(detail.headers.get("Cache-Control")).toBe("no-store");
  });
});
