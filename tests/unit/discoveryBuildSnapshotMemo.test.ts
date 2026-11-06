import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "@/tests/fixtures/publication/current-snapshot.json";

const projection = vi.hoisted(() => ({ calls: 0 }));

vi.mock("@/app/generated/metricsSnapshot", async () => {
  const { default: data } = await import("@/tests/fixtures/publication/current-snapshot.json");
  return { BUILD_METRICS_SNAPSHOT: structuredClone(data) };
});
vi.mock("@/worker/public-snapshot", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/worker/public-snapshot")>();
  return { ...original, publicSnapshot: (value: unknown) => { projection.calls += 1; return original.publicSnapshot(value); } };
});
vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{ default: { publications: Record<string, { state: string }> } }>();
  return { default: { ...config, publications: { ...Object.fromEntries(Object.entries(config.publications).map(([id, entry]) => [id, { ...entry, state: "published" }])), ons: { state: "published" } } } };
});

import { SECTION_DISCOVERY, getBuildPublication } from "@/app/lib/discovery";

const A = new Date("2026-11-05T12:00:00.000Z");

describe("build snapshot projection", () => {
  beforeEach(() => { projection.calls = 0; });

  it("projects the imported build snapshot once and re-evaluates currentness per call", () => {
    const section = SECTION_DISCOVERY["election-polls"];
    expect(getBuildPublication(section, undefined, A)).not.toBeNull();
    const afterFirst = projection.calls;
    getBuildPublication(section, undefined, A);
    getBuildPublication(SECTION_DISCOVERY["national-debt"], undefined, A);
    expect(projection.calls).toBe(afterFirst);

    // Same cached projection, but past the polling expiry the section is excluded.
    const expiresAt = (fixture.electionPolling as { expiresAt: string }).expiresAt;
    const B = new Date(Date.parse(expiresAt) + 1000);
    expect(getBuildPublication(section, undefined, B)).toBeNull();
    expect(projection.calls).toBe(afterFirst);
  });

  it("does not cache explicit snapshots", () => {
    const section = SECTION_DISCOVERY["national-debt"];
    const before = projection.calls;
    getBuildPublication(section, structuredClone(fixture), A);
    getBuildPublication(section, structuredClone(fixture), A);
    expect(projection.calls).toBe(before + 2);
  });
});
