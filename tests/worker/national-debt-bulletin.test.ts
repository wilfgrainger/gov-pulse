// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { FINANCES_BULLETIN_URL } from "@/worker/economy-evidence";
import {
  DEBT_GDP_SERIES_URL,
  DEBT_SERIES_URL,
  buildNationalDebt,
  parseDebtBulletinCheck,
  parseMonthlyOnsCsv,
} from "@/worker/national-debt";

const hf6w = readFileSync(new URL("../fixtures/ons-hf6w.csv", import.meta.url), "utf8");
const hf6x = readFileSync(new URL("../fixtures/ons-hf6x.csv", import.meta.url), "utf8");
const bulletinHtml = readFileSync(
  new URL("../fixtures/ons-public-sector-finances-august-2026.html", import.meta.url),
  "utf8"
);
const editionUrl = FINANCES_BULLETIN_URL.replace("/latest", "/august2026");
const seriesPage = `<main><p>Release date: 22 September 2026</p><p>Next release: 21 October 2026</p></main>`;

function htmlResponse(body: string) {
  return {
    ok: true,
    status: 200,
    url: "",
    text: async () => body,
  };
}

describe("machine feeds: ONS generator debt checked against the public-finances bulletin", () => {
  it("reads August 2026 HF6W and HF6X from the stored generator tips", () => {
    expect(parseMonthlyOnsCsv(hf6w).at(-1)).toMatchObject({ period: "2026 AUG", value: 2985.5 });
    expect(parseMonthlyOnsCsv(hf6x).at(-1)).toMatchObject({ period: "2026 AUG", value: 93.8 });
  });

  it("reads the same August figures from the bulletin check fixture", () => {
    expect(parseDebtBulletinCheck(bulletinHtml, editionUrl)).toMatchObject({
      period: "August 2026",
      debtBillion: 2985.5,
      debtToGdp: 93.8,
      releaseDate: "2026-09-22",
      nextReleaseDate: "2026-10-21",
    });
  });

  it("builds national debt only when the generator and bulletin agree", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === FINANCES_BULLETIN_URL) {
        return htmlResponse(`<a href="${editionUrl}">Latest release</a>`);
      }
      if (url === editionUrl) return htmlResponse(bulletinHtml);
      if (url === DEBT_SERIES_URL) return htmlResponse(seriesPage);
      if (url.includes("hf6x")) return htmlResponse(hf6x);
      if (url.includes("hf6w") || url.includes(DEBT_SERIES_URL) || url.includes("generator")) {
        return htmlResponse(hf6w);
      }
      return { ok: false, status: 404, text: async () => "missing" };
    }) as unknown as typeof fetch;

    const result = await buildNationalDebt(fetchImpl);

    expect(result).toMatchObject({
      baseDebt: 2_985_500_000_000,
      debtToGdp: 93.8,
      observationPeriod: "2026 AUG",
      publicationDate: "2026-09-22",
      nextReleaseDate: "2026-10-21",
      source: {
        publisher: "Office for National Statistics",
        debtUrl: DEBT_SERIES_URL,
        debtToGdpUrl: DEBT_GDP_SERIES_URL,
        bulletinUrl: editionUrl,
        landingUrl: FINANCES_BULLETIN_URL,
      },
    });
    expect(result.history.at(-1)).toMatchObject({
      period: "2026 AUG",
      debtBillion: 2985.5,
      debtToGdp: 93.8,
    });
  });
});
