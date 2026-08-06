import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const contractPath = "contracts/betting-markets.js";
const wrapperPath = "worker/betting-markets.js";
const uiPath = "app/components/BettingOdds.tsx";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("betting contract boundary", () => {
  it("has no browser, Worker runtime or third-party dependency", () => {
    const contract = source(contractPath);
    expect(contract).not.toMatch(/^import\s/m);
    expect(contract).not.toMatch(/@\/app|\.\.\/worker|cloudflare|zod|ajv/i);
  });

  it("keeps Worker imports as a small compatibility wrapper", () => {
    const wrapper = source(wrapperPath);
    expect(wrapper).toMatch(/from "\.\.\/contracts\/betting-markets\.js"/);
    expect(wrapper).not.toMatch(/function\s+/);
    expect(Buffer.byteLength(wrapper)).toBeLessThan(500);
  });

  it("removes the duplicate field-by-field UI validator", () => {
    const ui = source(uiPath);
    expect(ui).toMatch(/isCurrentBettingMarketPayload/);
    expect(ui).not.toMatch(/function\s+(?:validPayload|validMarket|validRunner|isOddscheckerUrl)/);
  });

  it("records a bounded source and gzip footprint without adding a schema package", () => {
    const contract = source(contractPath);
    const rawBytes = Buffer.byteLength(contract);
    const gzipBytes = gzipSync(contract).byteLength;
    const manifest = JSON.parse(source("package.json"));
    const packageNames = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]);

    console.info(`betting contract size: ${rawBytes} bytes raw, ${gzipBytes} bytes gzip`);
    expect(rawBytes).toBeLessThan(12_000);
    expect(gzipBytes).toBeLessThan(4_000);
    expect(packageNames.has("zod")).toBe(false);
    expect(packageNames.has("ajv")).toBe(false);
  });
});
