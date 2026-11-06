// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  REASON_CODES,
  buildHealthMetadata,
  healthBodyFromMetadata,
} from "@/worker/health-metadata";
import { UNAVAILABLE_REASONS } from "@/worker/publication-availability";

const NOW = new Date("2026-11-06T10:00:00.000Z");

function edition(overrides: Record<string, unknown> = {}) {
  return {
    editionId: "ed-1",
    generatedAt: "2026-11-06T03:20:00.000Z",
    validUntil: "2026-11-07T03:20:00.000Z",
    missingRequired: [] as string[],
    held: [] as string[],
    unavailableSections: [] as { id: string; reason: string }[],
    ...overrides,
  };
}

function body(ed: ReturnType<typeof edition>) {
  const { metadata, overflow } = buildHealthMetadata(ed, NOW);
  return { metadata, overflow, body: healthBodyFromMetadata(metadata, overflow) };
}

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const feedIds = (n: number, prefix = "feed") =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(2, "0")}`);

describe("health metadata", () => {
  it("reasons round-trip for every UNAVAILABLE_REASONS value", () => {
    expect(Object.keys(REASON_CODES).sort()).toEqual([...UNAVAILABLE_REASONS].sort());
    for (const reason of UNAVAILABLE_REASONS) {
      const result = body(edition({ unavailableSections: [{ id: "gdpTracker", reason }] }));
      expect(result.body).toMatchObject({ unavailableSections: [{ id: "gdpTracker", reason }] });
    }
  });

  it("unknown reason fails closed", () => {
    expect(() =>
      buildHealthMetadata(edition({ unavailableSections: [{ id: "gdpTracker", reason: "mystery" }] }), NOW),
    ).toThrow(/reason/);
  });

  it("ids that would corrupt the packed form fail closed", () => {
    expect(() => buildHealthMetadata(edition({ held: ["a,b"] }), NOW)).toThrow(/id/);
    expect(() =>
      buildHealthMetadata(edition({ unavailableSections: [{ id: "a:b", reason: "no-current-observation" }] }), NOW),
    ).toThrow(/id/);
  });

  it("17 feeds with every feed unavailable fits without overflow", () => {
    const ids = feedIds(17);
    const result = body(
      edition({
        unavailableSections: ids.map((id) => ({ id, reason: "no-current-observation" })),
        missingRequired: ids.slice(0, 5),
        held: ids.slice(5, 7),
      }),
    );
    expect(result.overflow).toBeNull();
    expect(bytes(result.metadata)).toBeLessThanOrEqual(1000);
    expect((result.body as { unavailableSections: unknown[] }).unavailableSections).toHaveLength(17);
  });

  it("50 feeds all unavailable stays within 1024 bytes or degrades closed", () => {
    const ids = feedIds(50, "internationalComparisonFeed");
    const ed = edition({
      unavailableSections: ids.map((id) => ({ id, reason: "collector-failed" })),
      missingRequired: ids.slice(0, 10),
    });
    const { metadata, overflow } = buildHealthMetadata(ed, NOW);
    expect(bytes(metadata)).toBeLessThanOrEqual(1024);
    expect(metadata).toMatchObject({ v: 1, e: "ed-1", t: 1 });
    expect(overflow).toMatchObject({ editionId: "ed-1" });
    expect(healthBodyFromMetadata(metadata, overflow)).toMatchObject({
      status: "degraded",
      ready: false,
      missingRequiredSections: ids.slice(0, 10),
    });
    // Missing overflow, or an overflow for another edition, fails closed.
    const closed = { status: "degraded", ready: false, degraded: true };
    expect(healthBodyFromMetadata(metadata, null)).toEqual(closed);
    expect(healthBodyFromMetadata(metadata, { ...overflow, editionId: "ed-0" })).toEqual(closed);
  });
});

describe("health > metadata-backed body equals legacy body", () => {
  const same = (ed: ReturnType<typeof edition>, legacy: unknown) =>
    expect(JSON.stringify(body(ed).body)).toBe(JSON.stringify(legacy));

  it("live-shaped degraded state", () => {
    same(
      edition({
        missingRequired: ["housePriceIndex", "nhsStats"],
        unavailableSections: [
          { id: "crimeStatistics", reason: "no-current-observation" },
          { id: "housePriceIndex", reason: "no-current-observation" },
        ],
      }),
      {
        status: "degraded",
        ready: false,
        degraded: true,
        missingRequiredSections: ["housePriceIndex", "nhsStats"],
        unavailableSections: [
          { id: "crimeStatistics", reason: "no-current-observation" },
          { id: "housePriceIndex", reason: "no-current-observation" },
        ],
      },
    );
  });

  it("ready state with a held feed", () => {
    same(edition({ held: ["nhsStats"] }), { status: "ready", ready: true, held: ["nhsStats"] });
  });

  it("plain ready state", () => {
    same(edition(), { status: "ready", ready: true });
  });
});
