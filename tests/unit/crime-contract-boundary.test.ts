import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const contractPath = "contracts/crime-statistics.js";
const collectorPath = "worker/live-crime-collector.js";
const justicePath = "data/crime/moj-court-publication.js";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("modular official-publication boundary", () => {
  it("keeps the contract independent of browser and Worker runtimes", () => {
    const contract = source(contractPath);
    expect(contract).not.toMatch(/^import\s/m);
    expect(contract).not.toMatch(/@\/app|\.\.\/worker|cloudflare|zod|ajv/i);
  });

  it("collects ONS values at runtime instead of embedding a stale edition", () => {
    const collector = source(collectorPath);
    const wrapper = source("worker/crime-statistics.js");
    expect(fs.existsSync("data/crime/ons-crime-publication.js")).toBe(false);
    expect(collector).toContain("ONS_PUBLICATION_LANDING_URL");
    expect(collector).not.toContain("9_600_000");
    expect(collector).not.toContain("48_774");
    expect(wrapper).not.toContain("year ending December 2025");
  });

  it("keeps the current MoJ module separate from the ONS collector", () => {
    const justice = source(justicePath);
    const collector = source(collectorPath);
    expect(justice).toContain("January to March 2026");
    expect(justice).toContain("52 days");
    expect(collector).toContain("MOJ_COURT_PUBLICATION");
    expect(collector).toContain("modulesValidatedIndependently: true");
  });

  it("records a bounded dependency-free footprint", () => {
    const sources = [contractPath, collectorPath, justicePath].map(source);
    const rawBytes = sources.reduce(
      (total, contents) => total + Buffer.byteLength(contents),
      0
    );
    const gzipBytes = gzipSync(sources.join("\n")).byteLength;
    const manifest = JSON.parse(source("package.json"));
    const packages = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]);

    console.info(
      `live crime publication boundary: ${rawBytes} bytes raw, ${gzipBytes} bytes gzip`
    );
    expect(rawBytes).toBeLessThan(40_000);
    expect(gzipBytes).toBeLessThan(10_000);
    expect(packages.has("zod")).toBe(false);
    expect(packages.has("ajv")).toBe(false);
  });
});
