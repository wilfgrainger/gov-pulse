import { describe, expect, it } from "vitest";
import { summariseFeedHealth } from "@/app/components/DataHealthBar";

describe("summariseFeedHealth", () => {
  it("reports healthy only when every automated source and observation are verified", () => {
    expect(
      summariseFeedHealth(
        ["gdp", "nhs"],
        {
          gdp: { status: "ok", cacheState: "fresh" },
          nhs: { status: "ok", cacheState: "fresh" },
        },
        {
          gdp: { status: "current", period: "2026 Q1", observedAt: "2026-03-01T00:00:00.000Z" },
          nhs: { status: "current", period: "2026 May", observedAt: "2026-05-01T00:00:00.000Z" },
        }
      )
    ).toEqual({ kind: "healthy", label: "All 2 core releases are current" });
  });

  it("reports partial health when retrieval is fresh but observation evidence is absent", () => {
    expect(
      summariseFeedHealth(
        ["gdp", "nhs", "migration", "tax"],
        {
          gdp: { status: "ok", cacheState: "fresh" },
          nhs: { status: "ok", cacheState: "fresh" },
          migration: { status: "error", cacheState: "fresh" },
        },
        {
          gdp: { status: "current", period: "2026 Q1", observedAt: "2026-03-01T00:00:00.000Z" },
        }
      )
    ).toEqual({ kind: "degraded", label: "1 of 4 core releases are current" });
  });

  it("does not treat cache freshness as proof that a publication is current", () => {
    expect(
      summariseFeedHealth(["gdp"], {
        gdp: { status: "ok", cacheState: "fresh" },
      })
    ).toEqual({ kind: "degraded", label: "0 of 1 core releases are current" });
  });
});
