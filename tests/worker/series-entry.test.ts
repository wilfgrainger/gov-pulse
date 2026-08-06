// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  buildCurrentEconomicIndicators,
  enforceCombinedDataset,
  enforceHealth,
  ensureRecord,
  healthEntry,
  isCurrentRecord,
  observationFor,
} from "@/worker/series-entry";
import {
  BOE_BANK_RATE_URL,
  SERIES_DEFINITIONS,
} from "@/worker/economic-indicators";

const CPI_CSV = `"2026 APR","2.8"\n"2026 MAY","3.4"`;
const UNEMPLOYMENT_CSV = `"2026 FEB","5.0"\n"2026 MAR","4.9"`;
const CPI_PAGE = `<p>Release date: 17 June 2026</p><p>Next release: 22 July 2026</p>`;
const UNEMPLOYMENT_PAGE = `<p>Release date: 18 June 2026</p><p>Next release: 16 July 2026</p>`;
const BANK_RATE_PAGE = `<table><tbody><tr><td>18 Dec 25</td><td>3.75</td></tr></tbody></table>`;

function fetchFixture(input: RequestInfo | URL) {
  const url = String(input);
  if (url.includes("generator") && url.includes("d7g7")) {
    return Promise.resolve(new Response(CPI_CSV));
  }
  if (url === SERIES_DEFINITIONS.inflation.sourceUrl) {
    return Promise.resolve(new Response(CPI_PAGE));
  }
  if (url.includes("generator") && url.includes("mgsx")) {
    return Promise.resolve(new Response(UNEMPLOYMENT_CSV));
  }
  if (url === SERIES_DEFINITIONS.unemployment.sourceUrl) {
    return Promise.resolve(new Response(UNEMPLOYMENT_PAGE));
  }
  if (url === BOE_BANK_RATE_URL) {
    return Promise.resolve(new Response(BANK_RATE_PAGE));
  }
  return Promise.resolve(new Response("missing", { status: 404 }));
}

function legacyRecord() {
  return {
    section: "sentimentPulse",
    fetchedAt: "2026-07-14T11:00:00.000Z",
    data: {
      economicData: [{ date: "Jan 26", inflation: 3, bankRate: 3.75 }],
      metricConfig: { inflation: { current: "3.0%" } },
    },
  };
}

function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          store.set(key, JSON.parse(value));
        }),
      },
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
  vi.stubGlobal("fetch", vi.fn(fetchFixture));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("series-aware Worker entry", () => {
  it("rebuilds a fresh-looking legacy mixed-panel cache record", async () => {
    const { env, store } = kvEnv({
      "v10:section:sentimentPulse": legacyRecord(),
    });

    const record = await ensureRecord(env);

    expect(record.data).toMatchObject({
      available: true,
      order: ["inflation", "bankRate", "unemployment"],
    });
    expect(record.data).not.toHaveProperty("economicData");
    expect(store.get("v10:section:sentimentPulse")).toEqual(record);
    expect(env.METRICS_CACHE.put).toHaveBeenCalledTimes(1);
  });

  it("serves the strict section payload with a real three-series period summary", async () => {
    const { env } = kvEnv();
    const response = await worker.fetch(
      new Request("https://worker.example/metrics?section=sentimentPulse"),
      env,
      { waitUntil: vi.fn() }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      section: "sentimentPulse",
      source: "worker",
      cacheState: "fresh",
      data: {
        available: true,
        series: {
          inflation: { seriesId: "D7G7" },
          bankRate: { seriesId: "IUDBEDR" },
          unemployment: { seriesId: "MGSX" },
        },
        __observation: {
          status: "current",
          period:
            "Inflation May 2026 · Bank Rate 18 December 2025 · Unemployment January 2026 to March 2026",
        },
      },
    });
    expect(payload.data.__provenance.section).toBe("sentimentPulse");
  });

  it("replaces legacy combined data and source metadata", async () => {
    const { env } = kvEnv();
    const response = await enforceCombinedDataset(
      new Response(
        JSON.stringify({
          sentimentPulse: { economicData: [{ date: "Jan 26" }] },
          meta: {
            sources: {
              sentimentPulse: { status: "ok", cacheState: "fresh" },
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      ),
      env
    );
    const payload = await response.json();

    expect(payload.sentimentPulse.available).toBe(true);
    expect(payload.sentimentPulse).not.toHaveProperty("economicData");
    expect(payload.meta.sources.sentimentPulse).toMatchObject({
      status: "ok",
      cacheState: "fresh",
      source: expect.any(String),
    });
  });

  it("migrates a legacy cache record before reporting strict health", async () => {
    const { env } = kvEnv({
      "v10:section:sentimentPulse": legacyRecord(),
    });

    const response = await enforceHealth(
      new Request("https://worker.example/health?strict=1"),
      new Response(
        JSON.stringify({
          status: "ok",
          healthy: true,
          sources: {
            sentimentPulse: { status: "missing", healthy: false },
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      ),
      env
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources.sentimentPulse).toMatchObject({
      status: "ok",
      healthy: true,
      cacheState: "fresh",
    });
    expect(payload.sections).toEqual(payload.sources);
    expect(env.METRICS_CACHE.put).toHaveBeenCalledTimes(1);
  });

  it("enforces publication currentness inside the shared refresh builder", async () => {
    await expect(
      buildCurrentEconomicIndicators(fetchFixture, () =>
        new Date("2026-09-05T12:00:00.000Z")
      )
    ).rejects.toThrow(/outside their currentness contract/i);
  });

  it("builds a truthful generic observation period from every series", async () => {
    const data = await buildCurrentEconomicIndicators(fetchFixture, () =>
      new Date("2026-07-14T12:00:00.000Z")
    );

    expect(observationFor(data)).toMatchObject({
      status: "current",
      period:
        "Inflation May 2026 · Bank Rate 18 December 2025 · Unemployment January 2026 to March 2026",
      observedAt: "2026-05-31T00:00:00.000Z",
      checkedAt: "2026-07-14T12:00:00.000Z",
      maxAgeDays: 75,
    });
  });

  it("expires structurally valid records after the retrieval window", async () => {
    const { env } = kvEnv();
    const record = await ensureRecord(env);
    const old = { ...record, fetchedAt: "2026-07-12T00:00:00.000Z" };

    expect(isCurrentRecord(old, new Date("2026-07-14T12:00:00.000Z"))).toBe(false);
    expect(healthEntry(old, Date.parse("2026-07-14T12:00:00.000Z"))).toMatchObject({
      status: "expired",
      healthy: false,
    });
  });
});
