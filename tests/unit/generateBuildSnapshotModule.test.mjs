import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { publicCandidate } from "../../scripts/fetch-cloudflare-publication-candidate.mjs";
import {
  generateBuildSnapshotModule,
  validateBuildSnapshot,
} from "../../scripts/generate-build-snapshot-module.mjs";
import {
  csvCell,
  sectionDistribution,
} from "../../scripts/generate-section-downloads.mjs";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../../worker/feed-registry.js";

const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "public-data-build-snapshot-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("build snapshot module generator", () => {
  it("rejects payloads without a registry and source manifest", () => {
    expect(() => validateBuildSnapshot({})).toThrow(
      "Build snapshot does not contain a valid registry and source manifest"
    );
  });

  it("writes the final publication snapshot as a typed source module", async () => {
    const directory = await temporaryDirectory();
    const snapshotPath = join(directory, "metrics-snapshot.json");
    const outputPath = join(directory, "metricsSnapshot.ts");
    const now = new Date().toISOString();
    const snapshot = {
      meta: {
        registryVersion: "test-registry",
        generatedAt: now,
        sources: {
          gdpTracker: {
            status: "ok",
            cacheState: "fresh",
            fetchedAt: now,
          },
        },
      },
      gdpTracker: {
        available: true,
        headline: { period: "Current test period", monthlyGrowth: 0.1 },
      },
    };
    await writeFile(snapshotPath, `${JSON.stringify(snapshot)}\n`, "utf8");

    const result = await generateBuildSnapshotModule({
      snapshot: snapshotPath,
      output: outputPath,
      optionalMissing: false,
    });
    const generated = await readFile(outputPath, "utf8");

    expect(result.skipped).toBe(false);
    expect(result.sectionCount).toBe(1);
    expect(generated).toContain("export const BUILD_METRICS_SNAPSHOT: unknown");
    expect(generated).toContain('"period": "Current test period"');
    expect(generated).toContain('"monthlyGrowth": 0.1');
  });

  it("sanitizes release metadata and protects spreadsheet cells", () => {
    const now = "2026-08-01T12:00:00.000Z";
    const sources = Object.fromEntries(
      REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
        section,
        {
          status: "ok",
          cacheState: "fresh",
          fetchedAt: now,
          backend: "private-worker",
        },
      ])
    );
    const sections = Object.fromEntries(
      REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
        section,
        { value: section },
      ])
    );
    sections.electionPolling = { value: "=HYPERLINK(\"bad\")" };

    const candidate = publicCandidate(
      {
        meta: {
          registryVersion: FEED_REGISTRY_VERSION,
          generatedAt: now,
          publicationMode: "queue-free-tier",
          freeTierBudget: { reads: 1 },
          sources,
        },
        ...sections,
      },
      new Date(now)
    );

    expect(candidate.meta.publicationMode).toBeUndefined();
    expect(candidate.meta.freeTierBudget).toBeUndefined();
    expect(candidate.meta.sources.electionPolling.backend).toBeUndefined();
    expect(csvCell(candidate.electionPolling.value)).toBe(
      "\"'=HYPERLINK(\"\"bad\"\")\""
    );
    expect(csvCell(-1)).toBe("-1");
    expect(sectionDistribution(candidate, "electionPolling").licence.name).toMatch(
      /No reuse licence asserted/
    );
  });

  it("retains the committed placeholder when a local build has no snapshot", async () => {
    const directory = await temporaryDirectory();
    const outputPath = join(directory, "metricsSnapshot.ts");
    await writeFile(outputPath, "export const BUILD_METRICS_SNAPSHOT = null;\n", "utf8");

    const result = await generateBuildSnapshotModule({
      snapshot: join(directory, "missing.json"),
      output: outputPath,
      optionalMissing: true,
    });

    expect(result.skipped).toBe(true);
    expect(await readFile(outputPath, "utf8")).toBe(
      "export const BUILD_METRICS_SNAPSHOT = null;\n"
    );
  });
});
