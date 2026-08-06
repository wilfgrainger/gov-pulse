// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  enforceCombined,
  enforceHealth,
  ensureRecord,
  isCurrentRecord,
  validDebtPayload,
} from "@/worker/editorial-entry";
import {
  DEBT_GDP_SERIES_URL,
  DEBT_SERIES_URL,
} from "@/worker/national-debt";

const debtCsv = `Title,Value
2025 MAY,2810
2025 JUN,2820
2025 JUL,2830
2025 AUG,2840
2025 SEP,2850
2025 OCT,2860
2025 NOV,2870
2025 DEC,2880
2026 JAN,2890
2026 FEB,2900
2026 MAR,2920
2026 APR,2940.8
2026 MAY,2984.3`;
const ratioCsv = `Title,Value
2025 MAY,93
2025 JUN,93.1
2025 JUL,93.2
2025 AUG,93.3
2025 SEP,93.4
2025 OCT,93.5
2025 NOV,93.6
2025 DEC,93.7
2026 JAN,93.8
2026 FEB,93.9
2026 MAR,94
2026 APR,94.1
2026 MAY,95.1`;
const debtPage = `<main><p>Release date: 19 June 2026</p></main>`;

function fetchFixture(input: RequestInfo | URL) {
  const url = String(input);
  if (url === DEBT_SERIES_URL) return Promise.resolve(new Response(debtPage));
  if (url.includes("hf6x")) return Promise.resolve(new Response(ratioCsv));
  if (url.includes("hf6w")) return Promise.resolve(new Response(debtCsv));
  return Promise.resolve(new Response("missing", { status: 404 }));
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

describe("editorial national debt entry", () => {
  it("rejects the previous payload without publication and source metadata", () => {
    expect(
      validDebtPayload(
        {
          baseDebt: 2_984_300_000_000,
          baseDate: Date.UTC(2026, 5, 0),
          debtToGdp: 95.1,
          series: { debt: "HF6W", debtToGdp: "HF6X" },
        },
        new Date("2026-07-14T12:00:00.000Z")
      )
    ).toBe(false);
  });

  it("rebuilds a fresh-looking legacy record under the editorial cache key", async () => {
    const { env, store } = kvEnv({
      "v11:section:nationalDebt-editorial": {
        section: "nationalDebt",
        fetchedAt: "2026-07-14T11:00:00.000Z",
        data: {
          baseDebt: 2_984_300_000_000,
          baseDate: Date.UTC(2026, 5, 0),
          debtToGdp: 95.1,
          series: { debt: "HF6W", debtToGdp: "HF6X" },
        },
      },
    });

    const record = await ensureRecord(env);

    expect(record.data).toMatchObject({
      publicationDate: "2026-06-19",
      source: {
        publisher: "Office for National Statistics",
        debtUrl: DEBT_SERIES_URL,
        debtToGdpUrl: DEBT_GDP_SERIES_URL,
      },
    });
    expect(store.get("v11:section:nationalDebt-editorial")).toEqual(record);
    expect(env.METRICS_CACHE.put).toHaveBeenCalledTimes(1);
  });

  it("serves the strict section payload with observation and provenance", async () => {
    const { env } = kvEnv();
    const response = await worker.fetch(
      new Request("https://worker.example/metrics?section=nationalDebt"),
      env,
      { waitUntil: vi.fn() }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      section: "nationalDebt",
      source: "worker",
      cacheState: "fresh",
      data: {
        publicationDate: "2026-06-19",
        source: { debtUrl: DEBT_SERIES_URL },
        __observation: {
          status: "current",
          period: "2026 MAY",
          observedAt: "2026-05-31T00:00:00.000Z",
        },
      },
    });
    expect(payload.data.__provenance.section).toBe("nationalDebt");
  });

  it("replaces an older combined-dataset record", async () => {
    const { env } = kvEnv();
    const response = await enforceCombined(
      new Response(
        JSON.stringify({
          nationalDebt: {
            baseDebt: 2_984_300_000_000,
            baseDate: Date.UTC(2026, 5, 0),
            debtToGdp: 95.1,
          },
          meta: { sources: { nationalDebt: { status: "ok" } } },
        }),
        { headers: { "Content-Type": "application/json" } }
      ),
      env
    );
    const payload = await response.json();

    expect(payload.nationalDebt.publicationDate).toBe("2026-06-19");
    expect(payload.meta.sources.nationalDebt).toMatchObject({
      status: "ok",
      cacheState: "fresh",
    });
  });

  it("refreshes before reporting strict health", async () => {
    const { env } = kvEnv();
    const response = await enforceHealth(
      new Request("https://worker.example/health?strict=1"),
      new Response(
        JSON.stringify({
          status: "ok",
          healthy: true,
          sources: { nationalDebt: { status: "missing", healthy: false } },
        }),
        { headers: { "Content-Type": "application/json" } }
      ),
      env
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources.nationalDebt).toMatchObject({
      status: "ok",
      healthy: true,
      cacheState: "fresh",
    });
    expect(payload.sections).toEqual(payload.sources);
  });

  it("expires an otherwise valid publication after 75 days", async () => {
    const { env } = kvEnv();
    const record = await ensureRecord(env);

    expect(
      isCurrentRecord(record, new Date("2026-09-05T12:00:00.000Z"))
    ).toBe(false);
  });
});
