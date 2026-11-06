// @vitest-environment node

import { describe, expect, it } from "vitest";
import { discoverRealWagesHistoryUrl } from "@/feeds/real-wages/parse.js";
import { discoverHousePriceIndexChartUrl } from "@/worker/house-price-index";

const BULLETIN = "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/bulletins/averageweeklyearningsingreatbritain/october2026";
const wages = (href: string) =>
  `<h2>Figure 3</h2><p>Real regular earnings growth</p><a href="${href}">Download</a>`;
const hpi = (href: string) =>
  `<span>Download this chart</span><a href="${href}">Figure 1 download</a>`;

describe("scraped ONS chart links stay on the bulletin origin", () => {
  it("resolves a relative CSV link against the bulletin", () => {
    const href = "/generator?uri=/a/b&format=csv";
    expect(discoverRealWagesHistoryUrl(wages(href), BULLETIN)).toBe("https://www.ons.gov.uk/generator?uri=/a/b&format=csv");
  });

  it.each([
    ["off-host", "https://evil.example/generator?uri=x&format=csv"],
    ["cleartext", "http://www.ons.gov.uk/generator?uri=x&format=csv"],
  ])("rejects an %s real-wages link", (_label, href) => {
    expect(() => discoverRealWagesHistoryUrl(wages(href), BULLETIN)).toThrow(/left the bulletin/);
  });

  it.each([
    ["off-host", "https://evil.example/generator?uri=x&format=csv"],
    ["cleartext", "http://www.ons.gov.uk/generator?uri=x&format=csv"],
  ])("rejects an %s house-price-index link", (_label, href) => {
    expect(() => discoverHousePriceIndexChartUrl(hpi(href), BULLETIN)).toThrow(/left the bulletin/);
  });
});
