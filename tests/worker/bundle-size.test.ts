// @vitest-environment node
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

// Workers Free plan: 64 MiB uncompressed script size, no compressed limit
// (developers.cloudflare.com/workers/platform/limits, verified 6 Nov 2026).
const FREE_SCRIPT_LIMIT_BYTES = 64 * 1024 * 1024;

describe("bundle size", () => {
  it("data worker bundle under 80% of Free script limit", async () => {
    const result = await build({
      entryPoints: ["worker/public-data-entry.js"],
      bundle: true,
      format: "esm",
      platform: "neutral",
      conditions: ["workerd", "worker", "browser"],
      mainFields: ["module", "main"],
      external: ["node:*", "cloudflare:*"],
      write: false,
      logLevel: "silent",
    });
    const bytes = result.outputFiles.reduce((total, file) => total + file.contents.byteLength, 0);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(FREE_SCRIPT_LIMIT_BYTES * 0.8);
  });
});
