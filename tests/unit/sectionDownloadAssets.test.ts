import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTION_DOWNLOAD_OUTPUT,
  generateSectionDownloads,
} from "../../scripts/generate-section-downloads.mjs";

describe("section download delivery assets", () => {
  it("does not ship static public files that shadow request-time downloads", () => {
    const directory = resolve("public/data/sections");
    const files = existsSync(directory)
      ? readdirSync(directory).filter((file) => /\.(json|csv)$/.test(file))
      : [];

    expect(files).toEqual([]);
  });

  it("writes generated downloads outside the shadowing public path", async () => {
    expect(DEFAULT_SECTION_DOWNLOAD_OUTPUT).toBe("out/data/sections");
    await expect(
      generateSectionDownloads({
        snapshotPath: "missing-snapshot.json",
        outputDirectory: "public/data/sections",
        optionalMissing: true,
      })
    ).rejects.toThrow("shadows request-time downloads");
  });
});
