// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  DEBT_GDP_SERIES_URL,
  DEBT_SERIES_PATH,
  DEBT_SERIES_URL,
  buildNationalDebt,
  fetchOfficialCsv,
  parseMonthlyOnsCsv,
  parseOnsReleaseDate,
} from "@/worker/national-debt";

const debtCsv = `Title,PS: Net Debt (excluding public sector banks): £bn: CPNSA
2025 MAY,2810.0
2025 JUN,2820.0
2025 JUL,2830.0
2025 AUG,2840.0
2025 SEP,2850.0
2025 OCT,2860.0
2025 NOV,2870.0
2025 DEC,2925.5
2026 JAN,2871.6
2026 FEB,2883.2
2026 MAR,2918.5
2026 APR,2940.8
2026 MAY,2984.3
`;

const debtGdpCsv = `Title,PS: Net Debt (excluding public sector banks) as a % of GDP: NSA
2025 MAY,93.0
2025 JUN,93.1
2025 JUL,93.2
2025 AUG,93.3
2025 SEP,93.4
2025 OCT,93.5
2025 NOV,93.6
2025 DEC,94.7
2026 JAN,92.7
2026 FEB,92.9
2026 MAR,93.8
2026 APR,94.1
2026 MAY,95.1
`;

const debtPage = `<main><p>Release date: 19 June 2026</p></main>`;

function sourceResponse(url: string, ratio = debtGdpCsv) {
  if (url === DEBT_SERIES_URL) return debtPage;
  return url.includes("hf6x") ? ratio : debtCsv;
}

describe("official ONS national debt connector", () => {
  it("parses only monthly observations and orders them chronologically", () => {
    const points = parseMonthlyOnsCsv(`Period,Value
2026,2925.5
2026 Q1,2918.5
2026 APR,2940.8
"2026 MAY","2,984.3"
`);

    expect(points).toHaveLength(2);
    expect(points.map((point) => point.period)).toEqual(["2026 APR", "2026 MAY"]);
    expect(points[1]).toMatchObject({ value: 2984.3, observedAt: Date.UTC(2026, 5, 0) });
  });

  it("parses full and abbreviated publication months from the official series page", () => {
    expect(parseOnsReleaseDate(debtPage)).toBe("2026-06-19");
    expect(parseOnsReleaseDate("<main>Release date: 19 Jun 2026</main>")).toBe("2026-06-19");
    expect(parseOnsReleaseDate("<main>Release date: 7 Sept 2026</main>")).toBe("2026-09-07");
    expect(() => parseOnsReleaseDate("<main>No date</main>")).toThrow(
      /did not expose a release date/i
    );
  });

  it("builds the debt stock, matching ratio and publication evidence", async () => {
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => sourceResponse(url),
    })) as unknown as typeof fetch;

    const result = await buildNationalDebt(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      baseDebt: 2_984_300_000_000,
      baseDate: Date.UTC(2026, 5, 0),
      debtToGdp: 95.1,
      observationPeriod: "2026 MAY",
      publicationDate: "2026-06-19",
      annualDelta: {
        debtBillion: 174.3,
        debtToGdpPoints: 2.1,
      },
      revisionStatus:
        "Public-sector-finance estimates can be revised as source data and classifications are updated.",
      source: {
        publisher: "Office for National Statistics",
        debtUrl: DEBT_SERIES_URL,
        debtToGdpUrl: DEBT_GDP_SERIES_URL,
      },
      series: {
        debt: "HF6W",
        debtToGdp: "HF6X",
      },
    });
    expect(result.history).toHaveLength(13);
    expect(result).not.toHaveProperty("debtPerSecond");
  });

  it("fails closed immediately for a permanent ONS HTTP error", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => "",
    })) as unknown as typeof fetch;

    await expect(fetchOfficialCsv(DEBT_SERIES_PATH, fetchImpl)).rejects.toThrow(
      "ONS returned 404"
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the official series periods do not align", async () => {
    const mismatchedRatio = debtGdpCsv.replace("2026 MAY,95.1", "");
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => sourceResponse(url, mismatchedRatio),
    })) as unknown as typeof fetch;

    await expect(buildNationalDebt(fetchImpl)).rejects.toThrow(
      "ONS national debt series periods do not align"
    );
  });

  it("retries a transient ONS failure exactly three times and then fails closed", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => "",
    })) as unknown as typeof fetch;

    await expect(fetchOfficialCsv(DEBT_SERIES_PATH, fetchImpl)).rejects.toThrow(
      "ONS returned 503"
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
