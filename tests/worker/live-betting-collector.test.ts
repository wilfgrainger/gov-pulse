// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { MARKET_DEFINITIONS } from "@/contracts/betting-markets";
import {
  assertCanonicalResponse,
  assertMarketPage,
  collectBettingOdds,
  parseOddscheckerRows,
} from "@/worker/live-betting-collector";

const now = new Date("2026-08-02T04:30:00.000Z");

function marketHtml(title: string, runners = 5) {
  const rows = Array.from({ length: runners }, (_, index) => {
    const name = `${title.split(" ")[0]} ${index + 1}`;
    return `<tr data-bname="${name}" data-best-dig="${2 + index / 2}"></tr>`;
  }).join("\n");
  return `<html><head><title>British Politics - ${title} Betting Odds | Politics | Oddschecker</title></head><body><h1>${title}</h1><table>${rows}</table></body></html>`;
}

function responseAt(url: string, html: string, status = 200) {
  const response = new Response(html, {
    status,
    headers: { "Content-Type": "text/html" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("Cloudflare Oddschecker collector", () => {
  it("uses one canonical identity for the current succession market", () => {
    expect(MARKET_DEFINITIONS.nextPrimeMinister).toEqual({
      id: "nextPrimeMinister",
      title: "Next Prime Minister after Andy Burnham",
      sourceUrl:
        "https://www.oddschecker.com/politics/british-politics/next-prime-minister-after-andy-burnham",
      minimumRunners: 5,
    });
  });

  it("collects all three exact markets as one four-hour snapshot", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const definition = Object.values(MARKET_DEFINITIONS).find(
        (candidate) => candidate.sourceUrl === url
      );
      if (!definition) return responseAt(url, "not found", 404);
      return responseAt(url, marketHtml(definition.title, definition.minimumRunners));
    }) as unknown as typeof fetch;

    const payload = await collectBettingOdds(fetchImpl, now);

    expect(payload).toMatchObject({
      available: true,
      provider: "Oddschecker",
      observedAt: now.toISOString(),
      expiresAt: "2026-08-02T08:30:00.000Z",
      evidencePolicy: {
        sourceClass: "commercial-market-snapshot",
        probabilityMethod: "raw reciprocal decimal odds; no normalization to 100%",
        predictiveClaim: false,
      },
    });
    expect(payload.markets.map((market) => [market.id, market.title, market.sourceUrl])).toEqual(
      Object.values(MARKET_DEFINITIONS).map((definition) => [
        definition.id,
        definition.title,
        definition.sourceUrl,
      ])
    );
    expect(payload.markets[0]).not.toHaveProperty("displayTitle");
    expect(payload.markets[0]).not.toHaveProperty("resolvedSourceUrl");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retains the best decimal price for each unique runner", () => {
    const rows = parseOddscheckerRows(`
      <tr data-bname="Candidate A" data-best-dig="3.5"></tr>
      <tr data-bname="Candidate A" data-best-dig="4.0"></tr>
      <tr data-bname="Candidate B" data-best-dig="5.0"></tr>
    `);
    expect(rows).toEqual([
      { name: "Candidate A", decimalOdds: 4 },
      { name: "Candidate B", decimalOdds: 5 },
    ]);
  });

  it("rejects limited, partial or unverifiable market pages", () => {
    const definition = MARKET_DEFINITIONS.nextPrimeMinister;
    expect(() =>
      assertMarketPage(
        `<h1>${definition.title}</h1><p>Log in to view prices</p>`,
        definition
      )
    ).toThrow(/limited or unavailable/i);
    expect(() => parseOddscheckerRows("<p>No complete comparison grid</p>")).toThrow(
      /two valid runners/i
    );
    expect(() => assertMarketPage("<h1>Unrelated football market</h1>", definition)).toThrow(
      /identity could not be verified/i
    );
  });

  it("does not accept a neighbouring market link as the page identity", () => {
    const definition = MARKET_DEFINITIONS.nextPrimeMinister;
    expect(() =>
      assertMarketPage(
        `<html>
          <head><title>Next Prime Minister after Keir Starmer Betting Odds</title></head>
          <body>
            <h1>Next Prime Minister after Keir Starmer</h1>
            <nav><a href="${definition.sourceUrl}">${definition.title}</a></nav>
          </body>
        </html>`,
        definition
      )
    ).toThrow(/identity could not be verified/i);
  });

  it("rejects redirects and lookalike publisher hosts", () => {
    const definition = MARKET_DEFINITIONS.nextPrimeMinister;
    expect(() =>
      assertCanonicalResponse(
        responseAt(
          "https://www.oddschecker.com/politics/british-politics/next-prime-minister-after-someone-else",
          ""
        ),
        definition
      )
    ).toThrow(/redirected/i);
    expect(() =>
      assertCanonicalResponse(
        responseAt(
          "https://www.oddschecker.com.example.org/politics/british-politics/next-prime-minister-after-andy-burnham",
          ""
        ),
        definition
      )
    ).toThrow(/approved HTTPS publisher host/i);
  });

  it("withdraws the complete snapshot when any one market is unavailable", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const definition = Object.values(MARKET_DEFINITIONS).find(
        (candidate) => candidate.sourceUrl === url
      );
      if (!definition) return responseAt(url, "not found", 404);
      const html =
        definition.id === "mostSeats"
          ? `<h1>${definition.title}</h1><p>Prices are currently unavailable</p>`
          : marketHtml(definition.title, definition.minimumRunners);
      return responseAt(url, html);
    }) as unknown as typeof fetch;

    await expect(collectBettingOdds(fetchImpl, now)).rejects.toThrow(
      /limited or unavailable/i
    );
  });
});
