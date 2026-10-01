// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import publicWorker from "@/worker/public-data-entry";
import {
  COMPARISON_REFRESH_MAX_AGE_MS,
  INTERNATIONAL_COMPARISON_KEY,
  readInternationalComparison,
  refreshInternationalComparison,
  due,
} from "@/worker/international-comparison-publication";
import {
  COMPARISON_COUNTRIES,
  COMPARISON_MEASURES,
  buildComparisonMeasure,
} from "@/worker/international-comparison";

function fixture(now = "2026-08-18T22:00:00.000Z", withLifecycle = true) {
  const source = {
    publisher: "Fixture",
    url: "https://example.test/source",
    series: "fixture",
  };
  const observations = COMPARISON_COUNTRIES.map(({ id }, index) => ({
    country: id,
    value: 1_000 + index,
    observationYear: 2024,
    valueType: "historical" as const,
    source,
  }));
  return {
    meta: {
      schemaVersion: 1,
      generatedAt: now,
      checkedAt: now,
      comparisonSetId: "uk-context-13-v2",
      countries: COMPARISON_COUNTRIES.map(({ id }) => id),
    },
    measures: Object.fromEntries(COMPARISON_MEASURES.map(({ id, definition }) => {
      const measure = buildComparisonMeasure({ id, definition, observationYear: 2024, observations });
      if (withLifecycle) {
        measure.lifecycle = {
          sourceEditionId: `${id}-2024-fixture`,
          validUntil: new Date(Date.parse(now) + 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastSuccessAt: now,
          retryAfter: null,
          status: "historical",
        };
      }
      return [id, measure];
    })),
  };
}

function failedHealthCandidate(now: string) {
  const candidate = fixture(now);
  const descriptor = COMPARISON_MEASURES.find(({ id }) => id === "healthcareSpending")!;
  const observations = COMPARISON_COUNTRIES.map(({ id }) => ({
    country: id,
    value: null,
    observationYear: 2024,
    valueType: "historical" as const,
    source: null,
    exclusionReason: "source-unavailable",
  }));
  candidate.measures.healthcareSpending = buildComparisonMeasure({
    id: "healthcareSpending",
    definition: descriptor.definition,
    observationYear: 2024,
    observations,
  });
  candidate.meta.sourceFailures = ["world-bank-health-2024"];
  return candidate;
}

function envWith(value: unknown) {
  const store = new Map<string, unknown>();
  if (value !== undefined) store.set(INTERNATIONAL_COMPARISON_KEY, value);
  return {
    store,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, raw: string) => store.set(key, JSON.parse(raw))),
        getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
      },
    },
  };
}

describe("international comparison publication route", () => {
  it("serves only a validated comparison artifact from its exact public route", async () => {
    const publication = fixture();
    const { env } = envWith(publication);
    const response = await publicWorker.fetch(
      new Request("https://public-data.org/data/international-comparison.json"),
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual(publication);
  });

  it("returns unavailable instead of inventing a comparison when no artifact exists", async () => {
    const { env } = envWith(undefined);
    const response = await publicWorker.fetch(
      new Request("https://public-data.org/data/international-comparison.json"),
      env
    );
    expect(response.status).toBe(503);
  });

  it("does not refetch annual sources while the last comparison check is inside the due window", async () => {
    const publication = fixture("2026-08-18T20:00:00.000Z");
    const { env } = envWith(publication);
    const collect = vi.fn();
    const result = await refreshInternationalComparison(env, {
      now: new Date("2026-08-18T22:00:00.000Z"),
      collect,
    });

    expect(COMPARISON_REFRESH_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(result.updated).toBe(false);
    expect(result.reason).toBe("not-due");
    expect(collect).not.toHaveBeenCalled();
    expect(await readInternationalComparison(env)).toEqual(publication);
  });

  it("retains the 13-country healthcare result for a transient source failure and schedules an independent retry", async () => {
    const now = new Date("2026-08-20T22:00:00.000Z");
    const existing = fixture("2026-08-19T22:00:00.000Z");
    const { env } = envWith(existing);
    const result = await refreshInternationalComparison(env, {
      now,
      force: true,
      collect: async () => failedHealthCandidate(now.toISOString()),
    });

    expect(result.publication.measures.healthcareSpending.comparableCountryCount).toBe(13);
    expect(result.publication.meta.sourceStatus.healthcareSpending).toBe("available");
    expect(result.availableMeasureCount).toBe(7);
    expect(result.publication.measures.healthcareSpending.lifecycle).toMatchObject({
      sourceEditionId: "healthcareSpending-2024-fixture",
      lastSuccessAt: "2026-08-19T22:00:00.000Z",
      retryAfter: "2026-08-20T22:00:00.000Z",
    });
  });

  it("does not retain old values when the source successfully reports missing observations", async () => {
    const now = new Date("2026-08-20T22:00:00.000Z");
    const existing = fixture("2026-08-19T22:00:00.000Z");
    const candidate = failedHealthCandidate(now.toISOString());
    candidate.meta.sourceFailures = [];
    const { env } = envWith(existing);
    const result = await refreshInternationalComparison(env, {
      now,
      force: true,
      collect: async () => candidate,
    });
    expect(result.publication.measures.healthcareSpending.comparableCountryCount).toBe(0);
  });

  it("drops an expired observation after a transient failure instead of using generatedAt as freshness", async () => {
    const now = new Date("2026-08-20T22:00:00.000Z");
    const expired = fixture("2026-08-19T22:00:00.000Z");
    expired.measures.healthcareSpending.lifecycle.validUntil = "2026-08-20T21:59:59.000Z";
    const { env } = envWith(expired);
    const result = await refreshInternationalComparison(env, {
      now,
      force: true,
      collect: async () => failedHealthCandidate(now.toISOString()),
    });
    expect(result.publication.measures.healthcareSpending.comparableCountryCount).toBe(0);
  });

  it("does not retain legacy values that have no source-specific validity metadata", async () => {
    const now = new Date("2026-08-20T22:00:00.000Z");
    const legacy = fixture(now.toISOString(), false);
    const { env } = envWith(legacy);
    const result = await refreshInternationalComparison(env, {
      now,
      force: true,
      collect: async () => failedHealthCandidate(now.toISOString()),
    });
    expect(result.publication.measures.healthcareSpending.comparableCountryCount).toBe(0);
  });

  it("retries an expired measure independently of the global check timestamp", () => {
    const publication = fixture("2026-08-20T21:00:00.000Z");
    publication.meta.checkedAt = "2026-08-20T21:00:00.000Z";
    publication.measures.healthcareSpending.lifecycle.retryAfter = "2026-08-20T21:30:00.000Z";
    expect(due(publication, new Date("2026-08-20T21:29:59.000Z"))).toBe(false);
    expect(due(publication, new Date("2026-08-20T21:30:00.000Z"))).toBe(true);
  });

  it("collects only the measure sources whose independent retry has expired", async () => {
    const now = new Date("2026-08-20T22:00:00.000Z");
    const publication = fixture("2026-08-20T21:00:00.000Z");
    publication.meta.checkedAt = "2026-08-20T21:00:00.000Z";
    publication.measures.healthcareSpending.lifecycle.retryAfter = "2026-08-20T21:30:00.000Z";
    const { env } = envWith(publication);
    const collect = vi.fn(async (_fetch: typeof fetch, _now: Date, options: { sourceIds: string[] }) => {
      expect(options.sourceIds).toEqual(["world-bank-health-2024"]);
      return fixture(now.toISOString());
    });
    await refreshInternationalComparison(env, { now, collect });
    expect(collect).toHaveBeenCalledTimes(1);
  });
});
