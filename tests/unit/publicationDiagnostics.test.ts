// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PUBLICATION_DIAGNOSTIC_CODES,
  buildPublicationDiagnostics,
  validatePublicationDiagnostics,
} from "@/contracts/publication-diagnostics.js";
import { generatePublicationDiagnostics } from "@/scripts/generate-publication-diagnostics.mjs";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("publication diagnostics", () => {
  it("classifies every public failure category without exposing raw errors", async () => {
    const fixture = JSON.parse(
      await readFile("tests/fixtures/publication-diagnostics.json", "utf8")
    );
    const diagnostics = buildPublicationDiagnostics(
      fixture,
      ["upstream", "parser", "stale", "history", "delivery"],
      (section) => section !== "history"
    );

    expect(Object.fromEntries(
      Object.entries(diagnostics).map(([section, diagnostic]) => [
        section,
        diagnostic.code,
      ])
    )).toEqual({
      upstream: PUBLICATION_DIAGNOSTIC_CODES.upstreamFetchFailure,
      parser: PUBLICATION_DIAGNOSTIC_CODES.parserContractRejection,
      stale: PUBLICATION_DIAGNOSTIC_CODES.staleObservation,
      history: PUBLICATION_DIAGNOSTIC_CODES.missingHistory,
      delivery: PUBLICATION_DIAGNOSTIC_CODES.snapshotDeliveryFailure,
    });
    expect(JSON.stringify(diagnostics)).not.toContain("internal connector details");
    expect(validatePublicationDiagnostics(diagnostics)).toBe(diagnostics);
  });

  it("writes deterministic diagnostics into the published snapshot contract", async () => {
    const directory = await mkdtemp(join(tmpdir(), "publication-diagnostics-"));
    temporaryDirectories.push(directory);
    const snapshotPath = join(directory, "metrics-snapshot.json");
    await writeFile(
      snapshotPath,
      `${JSON.stringify({
        meta: {
          registryVersion: FEED_REGISTRY_VERSION,
          sources: {
            gdpTracker: {
              status: "error",
              cacheState: "missing",
              error: "Official source returned 503",
            },
          },
        },
      })}\n`,
      "utf8"
    );

    const first = await generatePublicationDiagnostics({ snapshot: snapshotPath });
    const firstOutput = await readFile(snapshotPath, "utf8");
    const second = await generatePublicationDiagnostics({ snapshot: snapshotPath });
    const secondOutput = await readFile(snapshotPath, "utf8");

    expect(first.diagnostics.gdpTracker.code).toBe(
      PUBLICATION_DIAGNOSTIC_CODES.upstreamFetchFailure
    );
    expect(second.diagnostics).toEqual(first.diagnostics);
    expect(secondOutput).toBe(firstOutput);
    expect(JSON.parse(secondOutput).meta.publicationDiagnostics).toEqual(
      first.diagnostics
    );
  });

  it("rejects diagnostics with an unknown public reason code", () => {
    expect(() =>
      validatePublicationDiagnostics({
        gdpTracker: {
          section: "gdpTracker",
          code: "internal_exception",
          summary: "Do not publish internal categories",
        },
      })
    ).toThrow("Invalid publication diagnostic for gdpTracker");
  });
});
