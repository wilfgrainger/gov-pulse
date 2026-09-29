// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SECTION_BUILDERS,
  validDebtPayload,
} from "@/worker/section-builders";
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

describe("national debt section builder", () => {
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

  it("builds a strict section record with observation and provenance", async () => {
    const record = await SECTION_BUILDERS.nationalDebt(
      new Date("2026-07-14T12:00:00.000Z")
    );

    expect(record).toMatchObject({
      section: "nationalDebt",
      backend: "verified-data-service-editorial-contract",
      data: {
        publicationDate: "2026-06-19",
        source: {
          publisher: "Office for National Statistics",
          debtUrl: DEBT_SERIES_URL,
          debtToGdpUrl: DEBT_GDP_SERIES_URL,
        },
        __observation: {
          status: "current",
          period: "2026 MAY",
          observedAt: "2026-05-31T00:00:00.000Z",
        },
      },
    });
    expect(record.data.__provenance.section).toBe("nationalDebt");
    expect(record.source).toMatchObject({ status: "ok", cacheState: "fresh" });
  });

  it("throws fail-closed when the debt evidence is outside its editorial contract", async () => {
    await expect(
      SECTION_BUILDERS.nationalDebt(new Date("2026-11-05T12:00:00.000Z"))
    ).rejects.toThrow(/editorial contract/i);
  });
});
