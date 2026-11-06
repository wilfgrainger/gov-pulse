/* eslint-disable @typescript-eslint/no-explicit-any -- fixture JSON and legacy JS modules are untyped */
// @vitest-environment node

import { describe, expect, it } from "vitest";
import fixture from "@/tests/fixtures/publication/current-snapshot.json";
import { PUBLICATION_CONFIG, filterPublicationSnapshot } from "@/contracts/publication-policy";
import { FEED_CATALOG } from "@/contracts/source-catalog";
import { evaluate, projectPublic, retrievalMaxAgeMsForSection } from "@/contracts/evidence-policy";
import {
  currentSectionRecord,
  filterCurrentSnapshot,
  sectionValidityDeadline,
} from "@/worker/publication-currentness";
import { retrievalMaxAgeMsForSection as registryRetrievalMaxAge } from "@/worker/feed-registry";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const allPublished = {
  version: 2,
  publications: Object.fromEntries(
    Object.keys(FEED_CATALOG).map((id) => [id, { state: "published", reasonCode: "t", reason: "t" }]),
  ),
};

function sentimentSnapshot(base: any) {
  const fetchedAt = "2026-11-05T03:00:00.000Z";
  const series = (value: number | null, status = "current") => ({ value, annualDelta: 0.1, status });
  const validity = (iso: string) => ({ validUntil: iso });
  return {
    meta: {
      ...base.meta,
      sources: {
        sentimentPulse: {
          status: "stale",
          cacheState: "stale",
          fetchedAt,
          provenance: { section: "sentimentPulse" },
        },
      },
      verifiedSections: ["sentimentPulse"],
    },
    sentimentPulse: {
      series: {
        inflation: series(3.1),
        bankRate: series(4),
        unemployment: series(4.5),
      },
      __measureValidity: {
        inflation: validity("2026-11-10T00:00:00.000Z"),
        bankRate: validity("2026-11-20T00:00:00.000Z"),
        unemployment: validity("2026-12-01T00:00:00.000Z"),
      },
    },
  };
}

function hoursObservationSnapshot(base: any) {
  const copy = structuredClone(base);
  const section = "gdpTracker";
  delete copy[section].expiresAt;
  copy[section].__observation = {
    status: "current",
    observedAt: "2026-11-05T01:00:00.000Z",
    maxAgeHours: 36,
  };
  return copy;
}

const variants: Array<[string, any]> = [
  ["fixture current-snapshot.json", fixture],
  ["synthetic sentimentPulse independent measures", sentimentSnapshot(fixture)],
  ["synthetic maxAgeHours observation without explicit expiry", hoursObservationSnapshot(fixture)],
];

describe("evidence policy parity with legacy modules", () => {
  it("retrieval limits match the feed registry for every catalog id and odd ids", () => {
    for (const id of [...Object.keys(FEED_CATALOG), "constructor", "__proto__", "nope", ""]) {
      expect(retrievalMaxAgeMsForSection(id)).toEqual(registryRetrievalMaxAge(id));
    }
  });

  for (const [label, snap] of variants) {
    describe(label, () => {
      const sections = Object.keys(snap.meta.sources);
      for (const section of sections) {
        const source = snap.meta.sources[section];
        const data = snap[section];
        const record = { section, data, source };
        const fetchedAt = Date.parse(source.fetchedAt);
        const validUntil = sectionValidityDeadline(section, data, source, new Date(fetchedAt + HOUR));
        const nows = new Set<number>([fetchedAt + HOUR, fetchedAt - 10 * 60 * 1000, fetchedAt + 40 * DAY]);
        if (validUntil !== null) {
          nows.add(validUntil - 1);
          nows.add(validUntil);
          nows.add(validUntil + DAY);
        }
        for (const ms of nows) {
          const now = new Date(ms);
          it(`${section} at ${now.toISOString()}`, () => {
            const feed = {
              id: section,
              requirement: "required" as const,
              validity: { retrievalMaxAgeMs: registryRetrievalMaxAge(section) as number },
            };
            const verdict = evaluate(feed, record, "published", now);
            expect(verdict.state === "current").toBe(currentSectionRecord(record, now));
            const legacyDeadline = sectionValidityDeadline(section, data, source, now);
            expect(verdict.validUntil).toBe(legacyDeadline === null ? null : new Date(legacyDeadline).toISOString());
            if (verdict.state !== "current") expect(verdict.reason).not.toBeNull();
          });
        }
      }

      const snapshotNows = new Set<number>();
      for (const section of sections) {
        const f = Date.parse(snap.meta.sources[section].fetchedAt);
        const d = sectionValidityDeadline(section, snap[section], snap.meta.sources[section], new Date(f + HOUR));
        for (const ms of [f + HOUR, f + 40 * DAY, ...(d === null ? [] : [d - 1, d, d + DAY])]) snapshotNows.add(ms);
      }
      for (const ms of snapshotNows) {
        const now = new Date(ms);
        for (const [configLabel, config] of [["repo config", PUBLICATION_CONFIG], ["all published", allPublished]] as const) {
          it(`projectPublic (${configLabel}) at ${now.toISOString()}`, () => {
            const legacyFiltered = filterCurrentSnapshot(snap, now);
            const legacy = filterPublicationSnapshot(legacyFiltered, config as any);
            const projected = projectPublic(snap, now, config as any);
            if (legacy === null) expect(projected.snapshot).toBeNull();
            else expect(projected.snapshot).toEqual(legacy);
            expect(projected.snapshot === null).toBe(projected.validUntil === null);
          });
        }
      }
    });
  }
});
