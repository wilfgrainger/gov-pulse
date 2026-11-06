// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FEEDS } from "@/feeds/index.js";
import {
  INDICATIVE_NOTICE,
  SUBREQUEST_LIMIT,
  formatLine,
  formatReport,
  measureCollectors,
} from "@/scripts/measure-collector-cost.mjs";

describe("measure-collector-cost output shape", () => {
  it("reports one result per feed, measured or explicitly no-fixture, never an invented number", async () => {
    const results = await measureCollectors({ runs: 1 });
    expect(results.map((result: { feedId: string }) => result.feedId)).toEqual(FEEDS.map((feed) => feed.definition.id));
    for (const result of results) {
      if (result.status === "measured") {
        expect(result.cpuMs).toBeGreaterThanOrEqual(0);
        expect(result.bytes).toBeGreaterThan(0);
        expect(result.fetches).toBeGreaterThan(0);
        expect(formatLine(result)).toMatch(new RegExp(`^${result.feedId} \\d+(\\.\\d+)? \\d+ fetches=\\d+/${SUBREQUEST_LIMIT}$`));
      } else {
        expect(result.status).toBe("no-fixture");
        expect(result.cpuMs).toBeNull();
        expect(result.bytes).toBeNull();
        expect(formatLine(result)).toMatch(new RegExp(`^${result.feedId} no-fixture fetches=(unknown|\\d+/${SUBREQUEST_LIMIT}) \\(.+\\)$`));
      }
    }
    expect(results.some((result: { status: string }) => result.status === "measured")).toBe(true);
    expect(results.find((result: { feedId: string }) => result.feedId === "earlyYears")?.status).toBe("no-fixture");
  });

  it("labels the report indicative only", async () => {
    const report = formatReport(await measureCollectors({ feedIds: ["realWages"], runs: 1 }));
    expect(report.split("\n")[0]).toContain("INDICATIVE ONLY");
    expect(INDICATIVE_NOTICE).toContain("not Workers CPU");
    expect(report).toMatch(/^realWages \d/m);
  });
});
