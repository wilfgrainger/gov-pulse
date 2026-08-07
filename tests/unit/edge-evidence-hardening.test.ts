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

  it("renders the homepage from request-time server evidence instead of the generated build snapshot", () => {
    const page = fs.readFileSync("app/page.tsx", "utf8");
    expect(page).toMatch(/readServerMetricsSnapshot/);
    expect(page).not.toMatch(/BUILD_METRICS_SNAPSHOT/);
  });

  it("deploys an OpenNext web worker while keeping Pages only as the seed fallback", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const deploy = fs.readFileSync(".github/workflows/deploy.yml", "utf8");
    const webWrangler = fs.existsSync("web/wrangler.toml")
      ? fs.readFileSync("web/wrangler.toml", "utf8")
      : "";

    expect(packageJson.scripts).toHaveProperty("build:web");
    expect(packageJson.scripts).toHaveProperty("deploy:web");
    expect(packageJson.dependencies).toHaveProperty("@opennextjs/cloudflare");
    expect(deploy).toMatch(/build:web/);
    expect(deploy).toMatch(/deploy:web/);
    expect(deploy).toMatch(/Pages seed/i);
    expect(webWrangler).toMatch(/name\s*=\s*"public-data-web"/);
    expect(webWrangler).toMatch(/public-data\.org\/\*/);
  });
});
