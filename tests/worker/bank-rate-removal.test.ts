// @vitest-environment node
// Bank of England Bank Rate is removed (its content is not licensed for
// re-use). The stored production snapshot still carries a bankRate series and
// measure until the next collection: it must stay valid and never be shown.
import { describe, expect, it } from "vitest";
import {
  SENTIMENT_MEASURE_IDS,
  filterCurrentSnapshot,
  filterPublicationSnapshot,
  isPublicationFilteredSnapshot,
  projectPublic,
} from "@/contracts/evidence-policy";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

const FETCHED_AT = "2026-11-11T03:20:00.000Z";
const NOW = new Date("2026-11-11T12:00:00.000Z");
const IDS = ["inflation", "bankRate", "unemployment"];

function storedSnapshot() {
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: FETCHED_AT,
      sources: {
        sentimentPulse: {
          status: "ok",
          cacheState: "fresh",
          fetchedAt: FETCHED_AT,
          source: "CPI annual rate D7G7 / MM23 + Official Bank Rate IUDBEDR / IADB + Unemployment rate MGSX / LMS",
          provenance: {
            section: "sentimentPulse",
            upstreams: [
              { publisher: "Office for National Statistics", label: "CPI annual rate D7G7 / MM23", seriesId: "D7G7" },
              { publisher: "Bank of England", label: "Official Bank Rate IUDBEDR / IADB", url: "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp", seriesId: "IUDBEDR" },
              { publisher: "Office for National Statistics", label: "Unemployment rate MGSX / LMS", seriesId: "MGSX" },
            ],
          },
        },
      },
      verifiedSections: ["sentimentPulse"],
      measureCatalog: {
        schemaVersion: 2,
        editionId: "stored-edition",
        generatedAt: FETCHED_AT,
        validUntil: null,
        measures: {
          inflation: { id: "inflation", label: "CPI inflation", sourceId: "sentimentPulse", value: 3.5 },
          bankRate: { id: "bankRate", label: "Official Bank Rate", sourceId: "sentimentPulse", value: 3.75 },
        },
      },
      editionSummary: {
        id: "stored-edition",
        publishedAt: FETCHED_AT,
        sourceEditionIds: ["boe", "ons"],
        changes: [
          { measureId: "bankRate", nextSourceEditionId: "boe" },
          { measureId: "inflation", nextSourceEditionId: "ons" },
        ],
      },
    },
    sentimentPulse: {
      available: true,
      order: IDS,
      series: Object.fromEntries(IDS.map((id) => [id, {
        id,
        label: id === "bankRate" ? "Official Bank Rate" : id,
        shortLabel: id === "bankRate" ? "Bank Rate" : id,
        publisher: id === "bankRate" ? "Bank of England" : "Office for National Statistics",
        status: "current",
        value: id === "bankRate" ? 3.75 : 4.1,
        annualDelta: 0.1,
        history: [],
      }])),
      __measureValidity: Object.fromEntries(IDS.map((id) => [id, { validUntil: "2026-12-01T00:00:00.000Z" }])),
      __provenance: {
        section: "sentimentPulse",
        upstreams: [
          { publisher: "Office for National Statistics", seriesId: "D7G7" },
          { publisher: "Bank of England", label: "Official Bank Rate IUDBEDR / IADB", seriesId: "IUDBEDR" },
          { publisher: "Office for National Statistics", seriesId: "MGSX" },
        ],
      },
      __observation: { status: "current", period: "inflation September 2026 · Bank Rate 5 November 2026 · unemployment June 2026 to August 2026" },
    },
  };
}

const noBankRate = (value: unknown) => expect(JSON.stringify(value)).not.toMatch(/bank ?rate|bank of england/i);

describe("Bank Rate removal with a stored snapshot that still carries it", () => {
  it("key indicators are the two ONS series", () => {
    expect([...SENTIMENT_MEASURE_IDS]).toEqual(["inflation", "unemployment"]);
  });

  it("keeps the stored key-indicators record current despite its extra series", () => {
    const current = filterCurrentSnapshot(storedSnapshot(), NOW);
    expect(current?.sentimentPulse).toBeDefined();
    expect(current?.meta.sources).toHaveProperty("sentimentPulse");
  });

  it("projects the stored record with CPI and unemployment only, and no Bank Rate anywhere", () => {
    const { snapshot } = projectPublic(storedSnapshot(), NOW);
    expect(snapshot.sentimentPulse.order).toEqual(["inflation", "unemployment"]);
    expect(Object.keys(snapshot.sentimentPulse.series)).toEqual(["inflation", "unemployment"]);
    expect(Object.keys(snapshot.sentimentPulse.__measureValidity)).toEqual(["inflation", "unemployment"]);
    expect(snapshot.sentimentPulse.series.inflation.value).toBe(4.1);
    expect(snapshot.sentimentPulse.__observation.period).toBe("inflation September 2026 · unemployment June 2026 to August 2026");
    expect(snapshot.meta.sources.sentimentPulse.source).toBe("CPI annual rate D7G7 / MM23 + Unemployment rate MGSX / LMS");
    expect(snapshot.meta.sources.sentimentPulse.provenance.upstreams.map((u: { seriesId: string }) => u.seriesId)).toEqual(["D7G7", "MGSX"]);
    expect(Object.keys(snapshot.meta.measureCatalog.measures)).toEqual(["inflation"]);
    expect(snapshot.meta.editionSummary.changes.map((change: { measureId: string }) => change.measureId)).toEqual(["inflation"]);
    noBankRate(snapshot);
  });

  it("a stored public artifact that still carries Bank Rate is re-filtered, not served as-is", () => {
    const filtered = filterPublicationSnapshot(storedSnapshot());
    expect(isPublicationFilteredSnapshot(filtered)).toBe(true);
    const legacy = structuredClone(filtered);
    legacy.sentimentPulse = storedSnapshot().sentimentPulse;
    expect(isPublicationFilteredSnapshot(legacy)).toBe(false);
    const legacyCatalog = structuredClone(filtered);
    legacyCatalog.meta.measureCatalog = storedSnapshot().meta.measureCatalog;
    expect(isPublicationFilteredSnapshot(legacyCatalog)).toBe(false);
    const legacySource = structuredClone(filtered);
    legacySource.meta.sources.sentimentPulse = storedSnapshot().meta.sources.sentimentPulse;
    expect(isPublicationFilteredSnapshot(legacySource)).toBe(false);
  });
});
