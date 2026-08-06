import { describe, expect, it } from "vitest";
import {
  canonicalizePublication,
  publicationDecision,
  publicationFingerprint,
} from "@/scripts/lib/publication-fingerprint.mjs";

const snapshot = {
  meta: {
    generatedAt: "2026-07-18T10:00:00.000Z",
    registryVersion: "v1",
    sources: {
      gdpTracker: {
        fetchedAt: "2026-07-18T10:00:00.000Z",
        status: "ok",
      },
    },
  },
  gdpTracker: {
    headline: { value: 1.2, observedAt: "2026-06-30" },
    __observation: {
      status: "current",
      checkedAt: "2026-07-18T10:00:00.000Z",
      observedAt: "2026-06-30",
    },
  },
};

describe("publication fingerprint", () => {
  it("ignores operational check times but retains evidence dates and values", () => {
    const later = structuredClone(snapshot);
    later.meta.generatedAt = "2026-07-18T12:00:00.000Z";
    later.meta.sources.gdpTracker.fetchedAt = "2026-07-18T12:00:00.000Z";
    later.gdpTracker.__observation.checkedAt = "2026-07-18T12:00:00.000Z";

    expect(publicationFingerprint(snapshot, "abc")).toBe(
      publicationFingerprint(later, "abc")
    );

    later.gdpTracker.headline.value = 1.3;
    expect(publicationFingerprint(snapshot, "abc")).not.toBe(
      publicationFingerprint(later, "abc")
    );
  });

  it("retains expiry and observation state in the canonical publication", () => {
    const value = canonicalizePublication({
      generatedAt: "discard",
      checkedAt: "discard",
      observedAt: "keep",
      expiresAt: "keep",
    });

    expect(value).toEqual({ expiresAt: "keep", observedAt: "keep" });
  });

  it("only skips a scheduled publication when revision, validity and evidence agree", () => {
    expect(
      publicationDecision({
        eventName: "schedule",
        deployedRevisionMatches: true,
        previousSnapshotValid: true,
        candidateFingerprint: "same",
        previousFingerprint: "same",
      })
    ).toEqual({
      deploy: false,
      reason: "current revision and verified evidence are unchanged and remain valid",
    });
  });

  it("forces deployment for pushes, expired evidence, changed evidence or revision drift", () => {
    expect(publicationDecision({ eventName: "push" }).deploy).toBe(true);
    expect(
      publicationDecision({
        eventName: "schedule",
        deployedRevisionMatches: true,
        previousSnapshotValid: false,
        candidateFingerprint: "same",
        previousFingerprint: "same",
      }).deploy
    ).toBe(true);
    expect(
      publicationDecision({
        eventName: "schedule",
        deployedRevisionMatches: true,
        previousSnapshotValid: true,
        candidateFingerprint: "new",
        previousFingerprint: "old",
      }).deploy
    ).toBe(true);
    expect(
      publicationDecision({
        eventName: "schedule",
        deployedRevisionMatches: false,
        previousSnapshotValid: true,
        candidateFingerprint: "same",
        previousFingerprint: "same",
      }).deploy
    ).toBe(true);
  });
});
