// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FINANCES_BULLETIN_URL } from "@/feeds/tax/finances.js";
import { parseDebtBulletinCheck } from "@/feeds/national-debt/parse.js";

const bulletinHtml = readFileSync(
  new URL("../../fixtures/ons-public-sector-finances-september-2026.html", import.meta.url),
  "utf8"
);
const editionUrl = FINANCES_BULLETIN_URL.replace("/latest", "/september2026");

const page = (...paragraphs: string[]) =>
  `<h1>Public sector finances, UK: September 2026</h1><p>Release date: 21 October 2026</p>` +
  paragraphs.map((p) => `<p>${p}</p>`).join("");
const stock =
  "Public sector net debt was provisionally estimated at £3,005.0 billion at the end of September 2026, £91.7 billion more than a year earlier";

describe("ONS public-finances bulletin, September 2026 wording", () => {
  it("reads the debt ratio from the revised bulletin wording", () => {
    expect(parseDebtBulletinCheck(bulletinHtml, editionUrl)).toMatchObject({
      period: "September 2026",
      debtBillion: 3005,
      debtToGdp: 94.0,
      releaseDate: "2026-10-21",
      nextReleaseDate: "2026-11-20",
    });
  });

  it("reads the ratio from the stock sentence alone", () => {
    expect(
      parseDebtBulletinCheck(page(`${stock} and equivalent to 94.0% of GDP, 0.7 percentage points lower.`)).debtToGdp
    ).toBe(94.0);
  });

  it("reads the ratio from the net-debt-to-GDP sentence alone", () => {
    expect(
      parseDebtBulletinCheck(
        page(`${stock}.`, "The public sector net debt-to-GDP ratio at the end of September 2026 was provisionally estimated at 94.0%.")
      ).debtToGdp
    ).toBe(94.0);
  });

  it("fails closed when the stock and ratio sentences disagree", () => {
    expect(() =>
      parseDebtBulletinCheck(
        page(`${stock} and equivalent to 94.0% of GDP.`, "The public sector net debt-to-GDP ratio at the end of September 2026 was provisionally estimated at 93.0%.")
      )
    ).toThrow(/disagree/);
  });

  it("does not take a different measure's ratio", () => {
    expect(() =>
      parseDebtBulletinCheck(
        page(`${stock}.`, "Net financial liabilities were 82.7% of GDP at the end of September 2026.", "Borrowing in the financial year to September 2026 was 3.1% of GDP.")
      )
    ).toThrow(/percentage of GDP/);
  });

  it("fails closed when the ratio is for a different period", () => {
    expect(() =>
      parseDebtBulletinCheck(
        page(`${stock}.`, "The public sector net debt-to-GDP ratio at the end of August 2026 was provisionally estimated at 93.6%.")
      )
    ).toThrow(/period/);
  });
});
