// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { collect } from "@/feeds/real-wages/parse.js";
import { FEEDS } from "@/feeds/index.js";

const fixture = (name: string) => readFileSync(join(process.cwd(), "feeds/real-wages/fixtures", name), "utf8");
const BULLETIN = "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain";

function fetchStub() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/generator")) return new Response(fixture("history.csv"), { status: 200, headers: { "content-type": "text/csv" } });
    return new Response(fixture("bulletin.html"), { status: 200, headers: { "content-type": "text/html" } });
  });
}

describe("real-wages parse", () => {
  it("is registered in FEEDS with its collect function", () => {
    const entry = FEEDS.find((feed) => feed.definition.id === "realWages");
    expect(entry?.collect).toBe(collect);
  });

  it("collect parses captured bulletin fixture", async () => {
    const now = new Date("2026-09-16T08:00:00Z");
    const result = await collect({ fetch: fetchStub() as unknown as typeof fetch, now, feed: FEEDS[0].definition, previous: null });
    expect(result.data.headline).toMatchObject({
      period: "May to Jul 2026",
      releaseDate: "2026-09-15",
      regularPayRealGrowthPercent: 0.6,
      totalPayRealGrowthPercent: 0.9,
    });
    expect(result.observation).toEqual({
      period: "May to Jul 2026",
      observedAt: "2026-07-31T00:00:00.000Z",
      publishedAt: "2026-09-15",
    });
    expect(result.source.url).toBe(`${BULLETIN}/september2026`);
    expect(result.source.edition).toBe("september2026");
    expect(result.source.fetchedAt).toBe(now.toISOString());
  });

  it("collect throws when the history does not reconcile", async () => {
    const stub = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/generator")
        ? new Response(fixture("history.csv").replace('"May to July 2026","0.9","0.6"', '"May to July 2026","0.9","0.7"'), { status: 200 })
        : new Response(fixture("bulletin.html"), { status: 200 }),
    );
    await expect(collect({ fetch: stub as unknown as typeof fetch, now: new Date(), feed: FEEDS[0].definition, previous: null })).rejects.toThrow(/reconcile/);
  });
});
