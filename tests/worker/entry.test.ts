// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import worker, {
  ensureOfficialMigrationRecord,
  ensureOfficialNationalDebtRecord,
  isOfficialMigrationRecord,
  isOfficialNationalDebtRecord,
} from "@/worker/entry";

function healthEnv(manifest: unknown) {
  return {
    DATA_REFRESH_TTL_SECONDS: "14400",
    DATA_STALE_TTL_SECONDS: "86400",
    METRICS_CACHE: {
      get: vi.fn().mockResolvedValue(manifest),
    },
  };
}

const debtCsv = `Title,PS: Net Debt (excluding public sector banks): £bn: CPNSA
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
2026 MAY,2984.3
`;
const debtGdpCsv = `Title,PS: Net Debt (excluding public sector banks) as a % of GDP: NSA
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
2026 MAY,95.1
`;
const debtSeriesHtml = `<main><p>Release date: 19 June 2026</p></main>`;
const migrationDatasetHtml = `<a href="/file?uri=%2Fpeoplepopulationandcommunity%2Fpopulationandmigration%2Finternationalmigration%2Fdatasets%2Flongterminternationalimmigrationemigrationandnetmigrationflowsprovisional%2Fyearendingdecember2025%2Fmay2026publicationspreadsheet.xlsx">Latest</a>`;
const migrationBulletinHtml = `<h1>Long-term international migration, provisional: year ending December 2025</h1><p>Release date: 21 May 2026</p><p>At 171,000, long-term international net migration for year ending (YE) December 2025 has nearly halved from YE December 2024 (updated to 331,000).</p><p>The provisional estimate for total long-term immigration YE December 2025 is 813,000.</p><p>The provisional estimate for total long-term emigration in the most recent period is 642,000.</p><h3>Long-term immigration, emigration and net migration</h3><div data-url="/visualisations/test/fig02/index.html"></div>`;
const migrationHistoryCsv = `date,Net migration,Immigration,Emigration,Net_estimate,Immigration_estimate,Emigration_estimate
YE Dec 24,,,,331000,950000,619000
YE Dec 25,,,,171000,813000,642000`;
const debtHistory = Array.from({ length: 13 }, (_, index) => ({
  period: index === 12 ? "2026 MAY" : `2025 M${index}`,
  observedAt: index === 12 ? Date.UTC(2026, 5, 0) : Date.UTC(2025, index + 1, 0),
  debtBillion: index === 12 ? 2984.3 : 2810,
  debtToGdp: index === 12 ? 95.1 : 93,
}));
const migrationHistory = [
  { period: "YE December 2024", observedAt: Date.UTC(2025, 0, 0), immigration: 950_000, emigration: 619_000, netMigration: 331_000 },
  { period: "YE December 2025", observedAt: Date.UTC(2026, 0, 0), immigration: 813_000, emigration: 642_000, netMigration: 171_000 },
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Worker observability endpoints", () => {
  const ctx = { waitUntil: vi.fn() };

  it("returns detailed degraded source health and supports strict monitoring", async () => {
    const env = healthEnv({
      generatedAt: "2026-07-13T00:00:00Z",
      sources: {
        nationalDebt: {
          status: "error",
          source: "ONS Net Debt",
          fetchedAt: "2025-03-01T00:00:00Z",
          error: "upstream unavailable",
        },
      },
    });

    const response = await worker.fetch(
      new Request("https://example.com/health?strict=1"),
      env,
      ctx
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(payload.status).toBe("ok");
    expect(payload.sourceStatus).toBe("degraded");
    expect(payload.healthy).toBe(false);
    expect(payload.registryVersion).toBeTruthy();
    expect(payload.feedCount).toBeGreaterThan(0);
    expect(payload.sections).toEqual(expect.arrayContaining(["nationalDebt"]));
    expect(payload.sources.nationalDebt).toMatchObject({
      status: "error",
      error: "upstream unavailable",
    });
  });

  it("renders a human-readable source status page", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/status"),
      healthEnv(null),
      ctx
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Source health");
    expect(html).toContain("Strict monitoring endpoint");
  });

  it("degrades cleanly when the KV manifest cannot be parsed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const env = {
      DATA_REFRESH_TTL_SECONDS: "14400",
      DATA_STALE_TTL_SECONDS: "86400",
      METRICS_CACHE: {
        get: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
      },
    };

    const response = await worker.fetch(
      new Request("https://example.com/health?strict=1"),
      env,
      ctx
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("ok");
    expect(payload.sourceStatus).toBe("degraded");
    expect(payload.counts.missing).toBe(payload.counts.total);
    expect(consoleError).toHaveBeenCalled();
  });

  it("delegates health CORS preflight to the base Worker", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/health", { method: "OPTIONS" }),
      healthEnv(null),
      ctx
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.text()).toBe("");
  });
});

describe("national debt cache migration", () => {
  it("distinguishes the official HF6W/HF6X payload from a legacy snapshot", () => {
    expect(
      isOfficialNationalDebtRecord({
        data: {
          baseDebt: 2_814_000_000_000,
          baseDate: Date.UTC(2025, 2, 31),
        },
      })
    ).toBe(false);
    expect(
      isOfficialNationalDebtRecord({
        data: {
          baseDebt: 2_984_300_000_000,
          baseDate: Date.UTC(2026, 5, 0),
          debtToGdp: 95.1,
          series: { debt: "HF6W", debtToGdp: "HF6X" },
          history: debtHistory,
          annualDelta: { debtBillion: 174.3, debtToGdpPoints: 2.1 },
        },
      })
    ).toBe(true);
  });

  it("replaces a legacy KV record with the verified official connector payload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00Z"));
    const store = new Map<string, unknown>([
      [
        "v10:section:nationalDebt",
        {
          section: "nationalDebt",
          data: {
            baseDebt: 2_814_000_000_000,
            baseDate: Date.UTC(2025, 2, 31),
            debtPerSecond: 4_820,
          },
          fetchedAt: "2026-07-14T00:00:00Z",
        },
      ],
    ]);
    const put = vi.fn(async (key: string, value: string) => {
      store.set(key, JSON.parse(value));
    });
    const env = {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        text: async () =>
          url.includes("format=csv")
            ? url.includes("hf6x")
              ? debtGdpCsv
              : debtCsv
            : debtSeriesHtml,
      }))
    );

    const record = await ensureOfficialNationalDebtRecord(env);

    expect(record.data).toMatchObject({
      baseDebt: 2_984_300_000_000,
      baseDate: Date.UTC(2026, 5, 0),
      debtToGdp: 95.1,
      observationPeriod: "2026 MAY",
      publicationDate: "2026-06-19",
      series: { debt: "HF6W", debtToGdp: "HF6X" },
      __observation: { status: "current", period: "2026-05-31" },
    });
    expect(record.data).not.toHaveProperty("debtPerSecond");
    expect(put).toHaveBeenCalledWith(
      "v10:section:nationalDebt",
      expect.any(String)
    );
  });

  it("serves the migrated debt record with provenance on the public route", async () => {
    const record = {
      section: "nationalDebt",
      data: {
        baseDebt: 2_984_300_000_000,
        baseDate: Date.UTC(2026, 5, 0),
        debtToGdp: 95.1,
        observationPeriod: "2026 MAY",
        series: { debt: "HF6W", debtToGdp: "HF6X" },
        history: debtHistory,
        annualDelta: { debtBillion: 174.3, debtToGdpPoints: 2.1 },
        __observation: {
          status: "current",
          period: "2026-05-31",
          observedAt: "2026-05-31T00:00:00.000Z",
        },
      },
      fetchedAt: "2026-07-14T01:00:00.000Z",
      backend: "verified-data-service",
    };
    const env = {
      METRICS_CACHE: {
        get: vi.fn().mockResolvedValue(record),
        put: vi.fn(),
      },
    };

    const response = await worker.fetch(
      new Request("https://example.com/metrics?section=nationalDebt"),
      env,
      { waitUntil: vi.fn() }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      baseDebt: 2_984_300_000_000,
      debtToGdp: 95.1,
      series: { debt: "HF6W", debtToGdp: "HF6X" },
    });
    expect(payload.provenance.upstreams.map((source: { seriesId: string }) => source.seriesId)).toEqual([
      "HF6W",
      "HF6X",
    ]);
    expect(payload.data.__provenance.registryVersion).toBeTruthy();
  });
});

describe("migration cache migration", () => {
  it("rejects the legacy 2024 dashboard shape and accepts one reconciled ONS bulletin", () => {
    expect(
      isOfficialMigrationRecord({
        data: {
          migrationHistory: [{ year: "2024", net: 728 }],
          visaTypes: [],
          topNationalities: [],
        },
      })
    ).toBe(false);
    expect(
      isOfficialMigrationRecord({
        data: {
          headline: {
            observedAt: Date.UTC(2025, 12, 0),
            releaseDate: "2026-05-21",
            netMigration: 171_000,
            immigration: 813_000,
            emigration: 642_000,
          },
          source: { edition: "yearendingdecember2025" },
          history: migrationHistory,
          annualDelta: {
            immigration: -137_000,
            emigration: 23_000,
            netMigration: -160_000,
          },
        },
      })
    ).toBe(true);
  });

  it("replaces a legacy migration record with the latest discovered ONS bulletin", async () => {
    const store = new Map<string, unknown>([
      [
        "v10:section:migrationStats",
        {
          section: "migrationStats",
          data: {
            migrationHistory: [{ year: "2024", net: 728 }],
            visaTypes: [{ type: "Work", count: 337 }],
            topNationalities: [{ country: "India", count: 253 }],
          },
          fetchedAt: "2026-07-14T00:00:00Z",
        },
      ],
    ]);
    const put = vi.fn(async (key: string, value: string) => {
      store.set(key, JSON.parse(value));
    });
    const env = {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        text: async () =>
          url.includes("/datasets/")
            ? migrationDatasetHtml
            : url.endsWith("data.csv")
              ? migrationHistoryCsv
              : migrationBulletinHtml,
      }))
    );

    const record = await ensureOfficialMigrationRecord(env);

    expect(record.data).toMatchObject({
      headline: {
        period: "YE December 2025",
        netMigration: 171_000,
        immigration: 813_000,
        emigration: 642_000,
      },
      source: { edition: "yearendingdecember2025" },
      __observation: {
        status: "current",
        period: "YE December 2025",
        observedAt: "2025-12-31T00:00:00.000Z",
      },
    });
    expect(record.data).not.toHaveProperty("visaTypes");
    expect(record.data).not.toHaveProperty("topNationalities");
    expect(put).toHaveBeenCalledWith(
      "v10:section:migrationStats",
      expect.any(String)
    );
  });

  it("serves the current migration record with official ONS provenance", async () => {
    const record = {
      section: "migrationStats",
      data: {
        headline: {
          period: "YE December 2025",
          observedAt: Date.UTC(2025, 12, 0),
          releaseDate: "2026-05-21",
          netMigration: 171_000,
          immigration: 813_000,
          emigration: 642_000,
          previousPeriod: "YE December 2024",
          previousNetMigration: 331_000,
          changePercent: -48,
          provisional: true,
        },
        comparison: [
          { period: "YE December 2024", netMigration: 331_000 },
          { period: "YE December 2025", netMigration: 171_000 },
        ],
        methodology: {
          definition: "People moving to or from the UK for 12 months or more",
          status: "Official statistics in development",
          revisionNote: "Provisional and revisable.",
        },
        source: {
          edition: "yearendingdecember2025",
          bulletinUrl: "https://www.ons.gov.uk/migration/yearendingdecember2025",
          datasetUrl: "https://www.ons.gov.uk/migration/dataset",
        },
        history: migrationHistory,
        annualDelta: {
          immigration: -137_000,
          emigration: 23_000,
          netMigration: -160_000,
        },
        __observation: {
          status: "current",
          period: "YE December 2025",
          observedAt: "2025-12-31T00:00:00.000Z",
        },
      },
      fetchedAt: new Date().toISOString(),
      backend: "verified-data-service",
    };
    const env = {
      METRICS_CACHE: {
        get: vi.fn().mockResolvedValue(record),
        put: vi.fn(),
      },
    };

    const response = await worker.fetch(
      new Request("https://example.com/metrics?section=migrationStats"),
      env,
      { waitUntil: vi.fn() }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.headline.netMigration).toBe(171_000);
    expect(payload.data).not.toHaveProperty("visaTypes");
    expect(payload.provenance.upstreams).toHaveLength(2);
    expect(
      payload.provenance.upstreams.every(
        (source: { publisher: string }) =>
          source.publisher === "Office for National Statistics"
      )
    ).toBe(true);
  });
});
