// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  RECEIPTS_SERIES,
  collectTaxRevenue,
  parseTaxRevenueBulletin,
} from "@/worker/live-tax-revenue-collector";
import { FINANCES_BULLETIN_URL } from "@/worker/economy-evidence";

const editionUrl = FINANCES_BULLETIN_URL.replace("/latest", "/june2026");
const currentBulletin = `
  <h1>Public sector finances, UK: June 2026</h1>
  <p>Release date: 21 July 2026</p>
  <h3>Table 2: Central government receipts monthly summary</h3>
  <p>June 2026 compared with June 2025, £ billion, UK</p>
  <table>
    <tr><th>Receipt category</th><th>June 2026</th><th>June 2025</th><th>Difference</th><th>Difference (%)</th></tr>
    <tr><td>Total current central government receipts</td><td>91.6</td><td>85.4</td><td>6.2</td><td>7.2</td></tr>
  </table>
  <p>Source: Public sector finances from the Office for National Statistics</p>
`;

function monthlyCsv() {
  const rows = [];
  for (let offset = 12; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(2026, 5 - offset, 1));
    const period = `${date.getUTCFullYear()} ${date
      .toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
      .toUpperCase()}`;
    const value = offset === 12 ? 85_400 : offset === 0 ? 91_600 : 86_000;
    rows.push(`${period},${value}`);
  }
  return `Title,Value\n${rows.join("\n")}`;
}

describe("Cloudflare ONS receipts collector", () => {
  it("parses the current monthly receipts table and its signed annual change", () => {
    expect(parseTaxRevenueBulletin(currentBulletin, editionUrl)).toMatchObject({
      headline: {
        period: "June 2026",
        observedAt: Date.UTC(2026, 6, 0),
        releaseDate: "2026-07-21",
        receiptsBillion: 91.6,
        yearChangeBillion: 6.2,
      },
      source: { bulletinUrl: editionUrl },
    });
  });

  it("retains compatibility with the earlier prose publication format", () => {
    const result = parseTaxRevenueBulletin(`
      <h1>Public sector finances, UK: May 2026</h1>
      <p>Release date: 19 June 2026</p>
      <p>Central government receipts were estimated to be £93.7 billion in May 2026, £2.4 billion less than in May 2025.</p>
    `);
    expect(result.headline).toMatchObject({
      receiptsBillion: 93.7,
      yearChangeBillion: -2.4,
    });
  });

  it("collects the current table and reconciles it with official ANBV history", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === FINANCES_BULLETIN_URL) {
        return new Response(`<a href="${editionUrl}">Latest release</a>`, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (url === editionUrl) {
        return new Response(currentBulletin, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (url.includes(`/${RECEIPTS_SERIES.id.toLowerCase()}/`)) {
        return new Response(monthlyCsv(), {
          status: 200,
          headers: { "Content-Type": "text/csv" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const record = await collectTaxRevenue(
      fetchImpl,
      new Date("2026-08-02T04:30:00.000Z")
    );

    expect(record).toMatchObject({
      section: "taxRevenue",
      source: {
        status: "ok",
        cacheState: "fresh",
        backend: "cloudflare-official-publication",
      },
      data: {
        headline: {
          period: "June 2026",
          receiptsBillion: 91.6,
          yearChangeBillion: 6.2,
        },
        series: { receipts: "ANBV" },
        __observation: {
          status: "current",
          period: "June 2026",
          observedAt: "2026-06-30T00:00:00.000Z",
          maxAgeDays: 70,
        },
      },
    });
    expect(record.data.history).toHaveLength(13);
    expect(record.data.history.at(-1)).toMatchObject({
      period: "June 2026",
      receiptsBillion: 91.6,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("fails closed when the table arithmetic does not reconcile", () => {
    expect(() =>
      parseTaxRevenueBulletin(
        currentBulletin.replace("<td>6.2</td>", "<td>5.1</td>"),
        editionUrl
      )
    ).toThrow(/does not reconcile/i);
  });
});
