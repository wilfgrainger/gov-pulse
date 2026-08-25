// @vitest-environment node

import { describe, expect, it } from "vitest";
import { main, validateSnapshotAge } from "@/scripts/snapshot-canary.mjs";

describe("published snapshot canary", () => {
  it("allows minor clock skew but rejects implausible future timestamps", () => {
    const now = Date.parse("2026-07-15T12:00:00Z");

    expect(() =>
      validateSnapshotAge("2026-07-15T12:04:59Z", now)
    ).not.toThrow();
    expect(() =>
      validateSnapshotAge("2026-07-15T12:05:01Z", now)
    ).toThrow("outside the six-hour canary window");
  });

  it("rejects a stale snapshot in the runtime canary path", async () => {
    const response = new Response(
      JSON.stringify({ meta: { generatedAt: "2026-07-14T12:00:00Z" } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

    await expect(
      main("https://public-data.org/data/metrics-snapshot.json", {
        fetchImpl: async () => response,
        now: new Date("2026-07-15T12:00:00Z"),
      }),
    ).rejects.toThrow("outside the six-hour canary window");
  });
});
