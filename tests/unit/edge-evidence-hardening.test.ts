// Regression contract for the request-time evidence migration.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { FEED_REGISTRY } from "../../worker/feed-registry.js";

describe("edge evidence hardening", () => {
  it("stores active retrieval-currentness policy in the feed registry", () => {
    for (const [section, definition] of Object.entries(FEED_REGISTRY)) {
      expect(
        definition,
        `${section} must own a positive retrievalMaxAgeMs policy`,
      ).toHaveProperty("retrievalMaxAgeMs");
      expect(
        (definition as { retrievalMaxAgeMs?: number }).retrievalMaxAgeMs,
      ).toSatisfy((value: unknown) =>
        typeof value === "number" && Number.isFinite(value) && value > 0
      );
    }
  });

  it("does not expose a second inactive runtime source registry from app config", () => {
    const config = fs.readFileSync("app/lib/config.ts", "utf8");
    expect(config).not.toMatch(/export const ONS_CSV_BASE/);
    expect(config).not.toMatch(/export const BOE_API_BASE/);
    expect(config).not.toMatch(/export const ONS_SERIES/);
    expect(config).not.toMatch(/export const BOE_SERIES/);
  });

  it("removes the retired legacy worker implementation", () => {
    expect(fs.existsSync("worker/index.js")).toBe(false);
  });

  it("renders the app from request-bound server evidence instead of the generated build snapshot", () => {
    const page = fs.readFileSync("app/page.tsx", "utf8");
    const layout = fs.readFileSync("app/layout.tsx", "utf8");
    const hook = fs.readFileSync("app/lib/useMetrics.ts", "utf8");
    const serverReader = fs.readFileSync("app/lib/serverMetricsSnapshot.ts", "utf8");
    expect(page).toMatch(/readServerMetricsSnapshot/);
    expect(page).not.toMatch(/BUILD_METRICS_SNAPSHOT/);
    expect(layout).toMatch(/MetricsSnapshotProvider/);
    expect(hook).toMatch(/useInitialMetricsSnapshot/);
    expect(hook).not.toMatch(/BUILD_METRICS_SNAPSHOT/);
    expect(serverReader).toMatch(/await connection\(\)/);
    expect(serverReader).toMatch(/cache: "no-store"|requestSnapshot/);
  });

  it("deploys an OpenNext web worker while keeping Pages only as the seed fallback", () => {
    const deploy = fs.readFileSync(".github/workflows/deploy.yml", "utf8");
    const webWrangler = fs.readFileSync("worker/web-wrangler.toml", "utf8");

    expect(deploy).toMatch(/@opennextjs\/cloudflare@1\.20\.2 build/);
    expect(deploy).toMatch(/@opennextjs\/cloudflare@1\.20\.2 deploy/);
    expect(deploy).toMatch(/Pages seed/i);
    expect(webWrangler).toMatch(/name\s*=\s*"public-data-web"/);
    expect(webWrangler).toMatch(/nodejs_compat/);
    expect(webWrangler).toMatch(/global_fetch_strictly_public/);
    expect(webWrangler).toMatch(/public-data\.org\/\*/);
  });
});
