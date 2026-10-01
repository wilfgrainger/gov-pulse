import { describe, expect, it } from "vitest";
import { describeFreshness } from "@/app/components/PublicationFreshnessIndicator";
import type { PublicationHealthReport } from "@/app/lib/usePublicationHealth";

const now = new Date("2026-07-14T05:10:00Z");

function reportFixture(overrides: Partial<PublicationHealthReport>): PublicationHealthReport {
  return {
    status: "ok",
    healthy: true,
    service: "public-data-service",
    generatedAt: "2026-07-14T05:00:00Z",
    lastRefresh: "2026-07-14T03:47:00Z",
    counts: { total: 17, ok: 17, stale: 0, expired: 0, missing: 0, error: 0 },
    sections: {},
    ...overrides,
  };
}

describe("describeFreshness", () => {
  it("shows the last-publication time and the real next-cron check when healthy", () => {
    const copy = describeFreshness(reportFixture({}), now);
    expect(copy).not.toBeNull();
    expect(copy?.degraded).toBe(false);
    expect(copy?.message).toBe("Data as of 03:47 UTC, next check at 06:47 UTC");
  });

  it("declares degradation honestly instead of implying full currency when unhealthy", () => {
    const copy = describeFreshness(
      reportFixture({
        status: "degraded",
        healthy: false,
        lastRefresh: "2026-07-14T03:47:00Z",
        counts: { total: 17, ok: 15, stale: 1, expired: 0, missing: 0, error: 1 },
      }),
      now
    );
    expect(copy).not.toBeNull();
    expect(copy?.degraded).toBe(true);
    expect(copy?.message).toBe(
      "Data last confirmed fresh at 03:47 UTC — some sections may be delayed"
    );
    // Must not claim everything is current.
    expect(copy?.message).not.toMatch(/next check/i);
  });

  it("returns null rather than guessing when there is no recorded last refresh", () => {
    expect(describeFreshness(reportFixture({ lastRefresh: null }), now)).toBeNull();
  });

  it("returns null when there is no report at all (e.g. health endpoint unreachable)", () => {
    expect(describeFreshness(null, now)).toBeNull();
  });
});
