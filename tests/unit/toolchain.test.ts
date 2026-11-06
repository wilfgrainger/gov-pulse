import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("toolchain", () => {
  it("single lockfile and exact opennext pin", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

    expect(fs.existsSync(path.join(root, "worker/package-lock.json"))).toBe(false);
    expect(manifest.devDependencies?.["@opennextjs/cloudflare"]).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
