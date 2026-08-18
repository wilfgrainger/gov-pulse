// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import publicWorker from "@/worker/public-data-entry";
import {
  COMPARISON_REFRESH_MAX_AGE_MS,
  INTERNATIONAL_COMPARISON_KEY,
  readInternationalComparison,
  refreshInternationalComparison,
} from "@/worker/international-comparison-publication";
import { jobsForDay } from "@/worker/queued-publication-entry";
import {
  COMPARISON_COUNTRIES,
  COMPARISON_MEASURES,
  buildComparisonMeasure,
} from "@/worker/international-comparison";

function fixture(now = "2026-08-18T22:00:00.000Z") {
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
      comparisonSetId: "uk-context-13-v1",
      countries: COMPARISON_COUNTRIES.map(({ id }) => id),
    },
    measures: Object.fromEntries(
      COMPARISON_MEASURES.map(({ id, definition }) => [
        id,
        buildComparisonMeasure({ id, definition, observationYear: 2024, observations }),
      ])
    ),
  };
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
  it("schedules one optional comparison refresh in the daily run", () => {
    expect(jobsForDay("daily")).toContainEqual({ type: "refresh-international-comparison" });
  });

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
});
