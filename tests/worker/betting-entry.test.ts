// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  currentBettingRecord,
  enforceStrictBettingMarkets,
  normalizeBettingIngest,
  readBettingRecord,
  sectionDescriptors,
  writeBettingRecord,
} from "@/worker/evidence-entry";
import { MARKET_DEFINITIONS } from "@/worker/betting-markets";

function runners(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix} ${index + 1}`,
    decimalOdds: 2 + index,
  }));
}

function rawSnapshot(observedAt = "2026-07-14T10:00:00.000Z") {
  return {
    provider: "Oddschecker",
    observedAt,
    markets: [
      {
        id: "nextPrimeMinister",
        sourceUrl: MARKET_DEFINITIONS.nextPrimeMinister.sourceUrl,
        runners: runners(5, "Candidate"),
      },
      {
        id: "mostSeats",
        sourceUrl: MARKET_DEFINITIONS.mostSeats.sourceUrl,
        runners: runners(3, "Party"),
      },
      {
        id: "electionYear",
        sourceUrl: MARKET_DEFINITIONS.electionYear.sourceUrl,
        runners: runners(2, "Year"),
      },
    ],
  };
}

function requireRecord<T>(record: T | null): T {
  if (record === null) throw new Error("Expected a normalized betting record");
  return record;
}

function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    store,
    env: {
      REFRESH_SECRET: "secret",
      METRICS_CACHE: {
        get: vi.fn(async (key: string, type?: string) => {
          const value = store.get(key) ?? null;
          if (type === "json" && typeof value === "string") return JSON.parse(value);
          return value;
        }),
        put: vi.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
      },
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("strict betting production boundary", () => {
  it("marks betting odds ingest-only and uses the named market source", () => {
    expect(sectionDescriptors.bettingOdds.ingestOnly).toBe(true);
    expect(sectionDescriptors.bettingOdds.source).toBe(
      "Oddschecker public politics markets"
    );
  });

  it("normalizes ingest using the source observation time", async () => {
    const request = new Request("https://worker.example/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Refresh-Secret": "secret",
      },
      body: JSON.stringify({ section: "bettingOdds", data: rawSnapshot() }),
    });

    const record = await normalizeBettingIngest(
      request,
      new Date("2026-07-14T12:00:00.000Z")
    );

    expect(record).toMatchObject({
      section: "bettingOdds",
      fetchedAt: "2026-07-14T10:00:00.000Z",
      source: "Oddschecker public politics markets",
      backend: "scheduled-market-ingest",
      data: {
        available: true,
        expiresAt: "2026-07-14T14:00:00.000Z",
      },
    });
  });

  it("stores and reads only the isolated strict record", async () => {
    const { env, store } = kvEnv({
      "v10:section:bettingOdds": JSON.stringify({
        data: { nextPmOdds: [{ name: "Legacy", probability: 50 }] },
      }),
    });
    const request = new Request("https://worker.example/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "bettingOdds", data: rawSnapshot() }),
    });
    const record = requireRecord(await normalizeBettingIngest(request));
    await writeBettingRecord(env, record);

    const stored = await readBettingRecord(env);
    expect(stored).toMatchObject({ section: "bettingOdds" });
    expect(store.has("v10:section:bettingOdds")).toBe(true);
    await expect(currentBettingRecord(env)).resolves.toMatchObject({
      fetchedAt: "2026-07-14T10:00:00.000Z",
    });
  });

  it("accepts an authenticated snapshot and serves the strict section shape", async () => {
    const { env } = kvEnv();
    const ingest = await worker.fetch(
      new Request("https://worker.example/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Refresh-Secret": "secret",
        },
        body: JSON.stringify({ section: "bettingOdds", data: rawSnapshot() }),
      }),
      env,
      { waitUntil: vi.fn() }
    );
    expect(ingest.status).toBe(200);

    const response = await worker.fetch(
      new Request("https://worker.example/metrics?section=bettingOdds"),
      env,
      { waitUntil: vi.fn() }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      section: "bettingOdds",
      source: "worker",
      cacheState: "fresh",
      data: {
        available: true,
        provider: "Oddschecker",
        evidencePolicy: {
          probabilityMethod: "raw reciprocal decimal odds; no normalization to 100%",
        },
      },
    });
    expect(body.data).not.toHaveProperty("nextPmOdds");
  });

  it("fails closed when only a legacy or expired record exists", async () => {
    const legacy = kvEnv({
      "v10:section:bettingOdds": JSON.stringify({
        data: { nextPmOdds: [{ name: "Legacy", probability: 50 }] },
      }),
    });
    const missing = await worker.fetch(
      new Request("https://worker.example/metrics?section=bettingOdds"),
      legacy.env,
      { waitUntil: vi.fn() }
    );
    expect(missing.status).toBe(503);

    const expired = kvEnv();
    vi.setSystemTime(new Date("2026-07-14T13:00:00.000Z"));
    const request = new Request("https://worker.example/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "bettingOdds",
        data: rawSnapshot("2026-07-14T09:00:00.000Z"),
      }),
    });
    const record = requireRecord(await normalizeBettingIngest(request));
    await writeBettingRecord(expired.env, record);
    vi.setSystemTime(new Date("2026-07-14T13:00:01.000Z"));
    await expect(currentBettingRecord(expired.env)).resolves.toBeNull();
  });

  it("replaces legacy betting data in the combined dataset", async () => {
    const { env } = kvEnv();
    const request = new Request("https://worker.example/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "bettingOdds", data: rawSnapshot() }),
    });
    const record = requireRecord(await normalizeBettingIngest(request));
    await writeBettingRecord(env, record);

    const response = await enforceStrictBettingMarkets(
      new Request("https://worker.example/all"),
      new Response(
        JSON.stringify({
          bettingOdds: { nextPmOdds: [{ name: "Legacy", probability: 50 }] },
          meta: { sources: { bettingOdds: { status: "ok" } } },
        }),
        { headers: { "Content-Type": "application/json" } }
      ),
      env
    );
    const body = await response.json();

    expect(body.bettingOdds.available).toBe(true);
    expect(body.bettingOdds).not.toHaveProperty("nextPmOdds");
    expect(body.meta.sources.bettingOdds).toMatchObject({
      status: "ok",
      cacheState: "fresh",
    });
  });

  it("marks health degraded and strict health unavailable when no snapshot exists", async () => {
    const { env } = kvEnv();
    const response = await enforceStrictBettingMarkets(
      new Request("https://worker.example/health?strict=1"),
      new Response(JSON.stringify({ status: "ok", sourceStatus: "ok", sources: {} }), {
        headers: { "Content-Type": "application/json" },
      }),
      env
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.sourceStatus).toBe("degraded");
    expect(body.sources.bettingOdds).toMatchObject({
      status: "expired",
      healthy: false,
      cacheState: "expired",
    });
  });

  it("repairs a betting-only strict health failure from the isolated record", async () => {
    const { env } = kvEnv();
    const request = new Request("https://worker.example/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "bettingOdds", data: rawSnapshot() }),
    });
    const record = requireRecord(await normalizeBettingIngest(request));
    await writeBettingRecord(env, record);

    const response = await enforceStrictBettingMarkets(
      new Request("https://worker.example/health?strict=1"),
      new Response(
        JSON.stringify({
          status: "ok",
          sourceStatus: "degraded",
          healthy: false,
          counts: { total: 1, ok: 0, stale: 0, expired: 0, missing: 1, error: 0 },
          sources: {
            bettingOdds: {
              section: "bettingOdds",
              status: "missing",
              healthy: false,
              cacheState: "missing",
            },
          },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      ),
      env
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(body.sourceStatus).toBe("ok");
    expect(body.counts).toEqual({
      total: 1,
      ok: 1,
      stale: 0,
      expired: 0,
      missing: 0,
      error: 0,
    });
    expect(body.sources.bettingOdds).toMatchObject({
      status: "ok",
      healthy: true,
      cacheState: "fresh",
      fetchedAt: "2026-07-14T10:00:00.000Z",
    });
  });
});
