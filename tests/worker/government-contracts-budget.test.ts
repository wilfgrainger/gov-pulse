// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_PAGES_PER_REFRESH } from "@/feeds/government-contracts/parse.js";

describe("Find a Tender refresh budget", () => {
  it("keeps the page ceiling under the 50-subrequest budget with room for other calls", () => {
    expect(MAX_PAGES_PER_REFRESH).toBeLessThanOrEqual(40);
  });
});
