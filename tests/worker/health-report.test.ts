// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildHealthReport,
  renderHealthPage,
  strictHealthStatus,
} from "@/worker/health-report";

const descriptors = {
  nationalDebt: {
    source: "ONS Net Debt",
    freshTtlSeconds: 40 * 24 * 60 * 60,
  },
  bettingOdds: {
    source: "Odds snapshot",
    freshTtlSeconds: 2 * 60 * 60,
    ingestOnly: true,
  },
};

const nowMs = Date.parse("2026-07-14T00:00:00Z");

describe("Worker source health reporting", () => {
  it("reports healthy when every source is inside its freshness window", () => {
    const report = buildHealthReport({
      manifest: {
        generatedAt: "2026-07-13T23:30:00Z",
        sources: {
          nationalDebt: {
            status: "ok",
            source: "ONS Net Debt",
            fetchedAt: "2026-07-13T23:30:00Z",
          },
          bettingOdds: {
            status: "ok",
            source: "Odds snapshot",
            fetchedAt: "2026-07-13T23:00:00Z",
          },
        },
      },
      descriptors,
      defaultFreshTtlSeconds: 4 * 60 * 60,
      defaultStaleTtlSeconds: 24 * 60 * 60,
      nowMs,
    });

    expect(report.status).toBe("ok");
    expect(report.healthy).toBe(true);
    expect(report.counts).toMatchObject({ total: 2, ok: 2, stale: 0, missing: 0 });
    expect(report.sections.nationalDebt.cacheState).toBe("fresh");
    expect(strictHealthStatus(report, true)).toBe(200);
  });

  it("surfaces stale, missing and upstream error states", () => {
    const report = buildHealthReport({
      manifest: {
        generatedAt: "2026-07-13T00:00:00Z",
        sources: {
          nationalDebt: {
            status: "error",
            source: "ONS Net Debt",
            fetchedAt: "2026-05-01T00:00:00Z",
            error: "ONS request failed",
          },
        },
      },
      descriptors,
      defaultFreshTtlSeconds: 4 * 60 * 60,
      defaultStaleTtlSeconds: 24 * 60 * 60,
      nowMs,
    });

    expect(report.status).toBe("degraded");
    expect(report.healthy).toBe(false);
    expect(report.sections.nationalDebt.status).toBe("error");
    expect(report.sections.nationalDebt.error).toBe("ONS request failed");
    expect(report.sections.bettingOdds.status).toBe("missing");
    expect(report.counts.error).toBe(1);
    expect(report.counts.missing).toBe(1);
    expect(strictHealthStatus(report, false)).toBe(200);
    expect(strictHealthStatus(report, true)).toBe(503);
  });

  it("renders a human-readable status page without trusting source text as HTML", () => {
    const report = buildHealthReport({
      manifest: {
        generatedAt: "2026-07-13T23:30:00Z",
        sources: {
          nationalDebt: {
            status: "error",
            source: "<script>alert(1)</script>",
            fetchedAt: "2026-07-13T23:30:00Z",
            error: "upstream unavailable",
          },
          bettingOdds: {
            status: "ok",
            source: "Odds snapshot",
            fetchedAt: "2026-07-13T23:00:00Z",
          },
        },
      },
      descriptors,
      nowMs,
    });

    const html = renderHealthPage(report);
    expect(html).toContain("Source health");
    expect(html).toContain("DEGRADED");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("/health?strict=1");
  });
});
