import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SECTION_DOWNLOAD_OUTPUT,
  generateSectionDownloads,
} from "../../scripts/generate-section-downloads.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

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

  it("removes old generated section files when the optional snapshot is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "section-download-missing-"));
    temporaryDirectories.push(directory);
    const outputDirectory = join(directory, "sections");
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, "gdpTracker.json"), "stale-held-json");
    await writeFile(join(outputDirectory, "gdpTracker.csv"), "stale-held-csv");

    const result = await generateSectionDownloads({
      snapshotPath: join(directory, "missing-snapshot.json"),
      outputDirectory,
      optionalMissing: true,
      now: new Date("2026-10-12T12:00:00.000Z"),
      fallbackSnapshot: {
        meta: {
          registryVersion: "test",
          sources: {
            nationalDebt: {
              status: "ok",
              cacheState: "fresh",
              fetchedAt: "2026-09-01T00:00:00.000Z",
            },
          },
        },
        nationalDebt: {},
      },
    });

    expect(result.skipped).toBe(true);
    expect(readdirSync(outputDirectory)).toEqual([]);
  });

  it("builds downloads from the same current generated snapshot when the optional JSON candidate is absent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "section-download-generated-"));
    temporaryDirectories.push(directory);
    const outputDirectory = join(directory, "sections");
    const now = new Date("2026-10-12T12:00:00.000Z");
    const fallbackSnapshot = {
      meta: {
        registryVersion: "test",
        generatedAt: now.toISOString(),
        sources: Object.fromEntries(["nationalDebt", "gdpTracker"].map((section) => [
          section,
          { status: "ok", cacheState: "fresh", fetchedAt: now.toISOString() },
        ])),
      },
      nationalDebt: { value: "allowed-debt-value" },
      gdpTracker: { value: "held-gdp-value" },
    };

    const result = await generateSectionDownloads({
      snapshotPath: join(directory, "missing-snapshot.json"),
      outputDirectory,
      optionalMissing: true,
      fallbackSnapshot,
      now,
    });

    expect(result.skipped).toBe(false);
    expect(result.sections).toEqual(["nationalDebt"]);
    expect(readdirSync(outputDirectory).sort()).toEqual([
      "nationalDebt.csv",
      "nationalDebt.json",
    ]);
    expect(readFileSync(join(outputDirectory, "nationalDebt.json"), "utf8")).toContain(
      "allowed-debt-value",
    );
    expect(readFileSync(join(outputDirectory, "nationalDebt.json"), "utf8")).not.toContain(
      "held-gdp-value",
    );
  });

  it("omits held sections from generated JSON and CSV assets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "section-download-policy-"));
    temporaryDirectories.push(directory);
    const snapshotPath = join(directory, "snapshot.json");
    const outputDirectory = join(directory, "sections");
    const now = new Date("2026-10-12T12:00:00.000Z");
    const snapshot = {
      meta: {
        registryVersion: "test",
        generatedAt: now.toISOString(),
        sources: Object.fromEntries(["nationalDebt", "gdpTracker"].map((section) => [
          section,
          { status: "ok", cacheState: "fresh", fetchedAt: now.toISOString() },
        ])),
      },
      nationalDebt: { value: "allowed-debt-value" },
      gdpTracker: { value: "held-gdp-value" },
    };
    await writeFile(snapshotPath, JSON.stringify(snapshot));
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, "gdpTracker.json"), "stale-held-json");
    await writeFile(join(outputDirectory, "gdpTracker.csv"), "stale-held-csv");

    const result = await generateSectionDownloads({ snapshotPath, outputDirectory, now });
    const files = readdirSync(outputDirectory).sort();
    const generated = files.map((file) => readFileSync(join(outputDirectory, file), "utf8")).join("\n");

    expect(result.sections).toEqual(["nationalDebt"]);
    expect(files).toEqual(["nationalDebt.csv", "nationalDebt.json"]);
    expect(generated).toContain("allowed-debt-value");
    expect(generated).not.toContain("held-gdp-value");
  });
});
