// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  hasRequiredHistoryShape,
  validatePublicProjection,
  validateSnapshot,
} from "@/scripts/lib/publication-validation.mjs";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

describe("publication validation", () => {
  it("requires current observation evidence before counting a section", () => {
    const snapshot = {
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        sources: {
          gdpTracker: { status: "ok", cacheState: "fresh" },
          taxRevenue: { status: "error", cacheState: "missing" },
        },
      },
      gdpTracker: {
        __observation: {
          status: "current",
          period: "April 2026",
          observedAt: "2026-04-30T00:00:00.000Z",
        },
      },
    };

    expect(validateSnapshot(snapshot, 1)).toEqual(["gdpTracker"]);
    expect(() => validateSnapshot(snapshot, 2)).toThrow(/2 required/i);
  });

  it("rejects snapshots from an obsolete registry", () => {
    expect(() =>
      validateSnapshot({ meta: { registryVersion: "v10", sources: {} } }, 1)
    ).toThrow("repository feed registry");
  });

  it("preserves history-shape requirements independently of recovery", () => {
    const currentHistory = [
      { period: "YE December 2024", netMigration: 331_000 },
      { period: "YE December 2025", netMigration: 171_000 },
    ];
    expect(
      hasRequiredHistoryShape("migrationStats", { comparison: currentHistory })
    ).toBe(false);
    expect(
      hasRequiredHistoryShape("migrationStats", {
        history: currentHistory,
        annualDelta: {
          immigration: -199_000,
          emigration: -38_000,
          netMigration: -160_000,
        },
      })
    ).toBe(true);
  });

  it("validates only public projection state on reader artifacts", () => {
    const snapshot = {
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        sources: {
          nationalDebt: { status: "ok", cacheState: "fresh" },
        },
        publicProjection: {
          state: "published",
          publishedSections: ["nationalDebt"],
        },
      },
      nationalDebt: {
        __observation: {
          status: "current",
          period: "August 2026",
          observedAt: "2026-08-31",
        },
      },
    };

    expect(validatePublicProjection(snapshot)).toEqual({
      publishedSections: ["nationalDebt"],
    });
    expect(snapshot.meta).not.toHaveProperty("publicationState");
    expect(snapshot.meta).not.toHaveProperty("missingRequiredSections");
  });

  it("rejects public artifacts that leak private readiness or source errors", () => {
    const snapshot = {
      meta: {
        sources: {
          nationalDebt: {
            status: "ok",
            cacheState: "fresh",
            error: "private upstream response",
          },
        },
        publicProjection: {
          state: "published",
          publishedSections: ["nationalDebt"],
        },
        publicationState: "degraded",
      },
    };

    expect(() => validatePublicProjection(snapshot)).toThrow(
      "private publication state"
    );
  });

  it("rejects a public projection that disagrees with its source manifest", () => {
    expect(() =>
      validatePublicProjection({
        meta: {
          sources: { nationalDebt: { status: "ok" } },
          publicProjection: {
            state: "published",
            publishedSections: ["gdpTracker"],
          },
        },
      })
    ).toThrow("does not match its source manifest");
  });
});
