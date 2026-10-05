import { describe, expect, it } from "vitest";
import { overlayPeersFor, resolveOneIndicator } from "@/app/lib/oneIndicatorCompare";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";

function record(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    label: id,
    evidenceClass: "official-statistics",
    comparisonKey: "jobs-unemployment",
    cadence: "monthly",
    unit: "%",
    basis: "Unemployed people as a share of the economically active population",
    geography: { code: "GB", label: "Great Britain" },
    sourceId: `source-${id}`,
    sourceUrl: `https://example.org/${id}`,
    sourceEditionId: `edition-${id}`,
    observationPeriod: { start: "2024-01-01", end: "2024-02-01", label: "Jan to Feb 2024" },
    publishedAt: "2024-03-01T00:00:00.000Z",
    fetchedAt: "2024-03-01T00:00:00.000Z",
    validUntil: "2030-01-01T00:00:00.000Z",
    availability: "current",
    value: 5.1,
    revisionId: `revision-${id}`,
    points: [
      { period: "January", observedAt: "2024-01-01", value: 5, valueStatus: "estimate", revisionId: `revision-${id}` },
      { period: "February", observedAt: "2024-02-01", value: 5.1, valueStatus: "estimate", revisionId: `revision-${id}` },
    ],
    caveats: [],
    ...overrides,
  };
}

const catalog = {
  schemaVersion: 2,
  editionId: "edition",
  generatedAt: "2024-03-01T00:00:00.000Z",
  validUntil: "2030-01-01T00:00:00.000Z",
  measures: {
    first: record("first"),
    second: record("second"),
    inflation: record("inflation", {
      comparisonKey: "consumer-price-inflation",
      basis: "Consumer Prices Index annual rate",
      geography: { code: "UK", label: "United Kingdom" },
      value: 3.1,
      points: [
        { period: "January", observedAt: "2024-01-01", value: 3.0, valueStatus: "estimate", revisionId: "revision-inflation" },
        { period: "February", observedAt: "2024-02-01", value: 3.1, valueStatus: "estimate", revisionId: "revision-inflation" },
      ],
    }),
    stale: record("stale", {
      availability: "historical",
      validUntil: "2020-01-01T00:00:00.000Z",
      value: 9,
    }),
  },
} as unknown as MeasureCatalog;

describe("oneIndicatorCompare", () => {
  it("fails closed without a catalog", () => {
    expect(resolveOneIndicator(null).status).toBe("no-catalog");
  });

  it("starts from one current indicator, not a multi-measure stack", () => {
    const result = resolveOneIndicator(catalog);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.primary.id).toMatch(/^(first|second|inflation)$/);
    expect(result.studioUrl).toMatch(/measure=/);
    expect(result.studioUrl).not.toMatch(/measure=[^&]*,/);
  });

  it("lists overlay peers that share a validated definition only", () => {
    const primary = catalog.measures.first as never;
    const peers = overlayPeersFor(primary, catalog);
    expect(peers.map((peer) => peer.id)).toEqual(["second"]);
    expect(peers.every((peer) => peer.id !== "inflation")).toBe(true);
  });

  it("fails closed for an unknown or non-current measure id", () => {
    expect(resolveOneIndicator(catalog, "missing").status).toBe("no-current-measure");
    expect(resolveOneIndicator(catalog, "stale").status).toBe("no-current-measure");
  });

  it("keeps country peers unavailable while UK-in-context is offline", () => {
    const result = resolveOneIndicator(catalog, "first");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.countryPeersAvailable).toBe(false);
    expect(result.countryPeersReason).toMatch(/unavailable/i);
    expect(result.primary.geographyLabel).toBe("Great Britain");
  });

  it("can resolve a distinct geography indicator when it is current", () => {
    const result = resolveOneIndicator(catalog, "inflation");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.primary.geographyLabel).toBe("United Kingdom");
    expect(result.countryPeersAvailable).toBe(false);
  });

  it("fails closed when the catalog has no current measures", () => {
    const empty = {
      ...catalog,
      measures: { stale: catalog.measures.stale },
    } as unknown as MeasureCatalog;
    expect(resolveOneIndicator(empty).status).toBe("no-current-measure");
  });
});
