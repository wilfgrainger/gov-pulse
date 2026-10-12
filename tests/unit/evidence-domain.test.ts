import { describe, expect, it } from "vitest";
import {
  COLLECTION_STATUSES,
  FRESHNESS_STATES,
  PUBLICATION_STATES,
  VERIFICATION_STATUSES,
  createImmutableEdition,
  validateCollectionResult,
  validateEvidenceRecord,
  validateFreshnessAssessment,
  validateMeasureDefinition,
  validatePublicationDecision,
  validateSourceDefinition,
  validateVerificationResult,
} from "../../contracts/evidence-domain.js";

const source = {
  id: "ons-gdp",
  name: "ONS monthly GDP",
  publisher: "Office for National Statistics",
  evidenceClass: "official-statistics",
  geography: { code: "UK", label: "United Kingdom" },
  primaryUrls: ["https://www.ons.gov.uk/economy/grossdomesticproductgdp"],
  cadence: "monthly",
  caveats: ["Early estimates can be revised."],
};

const measure = {
  id: "gdp-monthly-growth",
  sourceId: "ons-gdp",
  label: "GDP: monthly growth",
  topic: "Economy",
  geography: { code: "UK", label: "United Kingdom" },
  unit: "%",
  basis: "Monthly change in real, seasonally adjusted GDP",
  valueStatus: "estimate",
  comparisonKey: "uk-real-gdp-monthly-growth",
  caveats: ["Early estimate; subject to revision."],
};

const collection = {
  id: "collection-1",
  runId: "run-1",
  sourceId: "ons-gdp",
  status: "succeeded",
  checkedAt: "2026-10-06T08:00:00.000Z",
  retrievedAt: "2026-10-06T08:00:00.000Z",
  sourceEditionId: "ons-gdp-2026-10",
  artifactRef: "kv://sources/ons-gdp/2026-10",
};

const verification = {
  id: "verification-1",
  collectionResultId: "collection-1",
  sourceId: "ons-gdp",
  sourceEditionId: "ons-gdp-2026-10",
  status: "accepted",
  verifiedAt: "2026-10-06T08:01:00.000Z",
  evidenceIds: ["evidence-gdp-2026-08"],
  reasons: [],
};

const evidence = {
  schemaVersion: 1,
  id: "evidence-gdp-2026-08",
  measureId: "gdp-monthly-growth",
  sourceId: "ons-gdp",
  sourceEditionId: "ons-gdp-2026-10",
  revisionId: "rev-1",
  geography: { code: "UK", label: "United Kingdom" },
  unit: "%",
  basis: "Monthly change in real, seasonally adjusted GDP",
  valueStatus: "estimate",
  value: 0.2,
  observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "August 2026" },
  publishedAt: "2026-10-10T06:00:00.000Z",
  fetchedAt: "2026-10-10T06:05:00.000Z",
  sourceUrl: "https://www.ons.gov.uk/economy/grossdomesticproductgdp",
  observations: [
    { period: "July 2026", observedAt: "2026-07-31", value: 0.1, valueStatus: "estimate", revisionId: "rev-0" },
    { period: "August 2026", observedAt: "2026-08-31", value: 0.2, valueStatus: "estimate", revisionId: "rev-1" },
  ],
  caveats: ["Early estimate; subject to revision."],
};

describe("canonical evidence domain", () => {
  it("defines independent lifecycle vocabularies", () => {
    expect(COLLECTION_STATUSES).toEqual(["succeeded", "failed", "blocked", "not_due"]);
    expect(VERIFICATION_STATUSES).toEqual(["accepted", "rejected", "pending"]);
    expect(FRESHNESS_STATES).toEqual(["current", "update_due", "expired"]);
    expect(PUBLICATION_STATES).toEqual(["published", "held", "retired"]);
  });

  it("validates source and measure definitions without embedding publication state", () => {
    expect(validateSourceDefinition(source)).toMatchObject({ id: "ons-gdp", cadence: "monthly" });
    expect(validateMeasureDefinition(measure)).toMatchObject({ id: "gdp-monthly-growth", sourceId: "ons-gdp" });
    expect(source).not.toHaveProperty("enabled");
    expect(measure).not.toHaveProperty("availability");
  });

  it("keeps collection success separate from publication", () => {
    expect(validateCollectionResult(collection).status).toBe("succeeded");
    expect(validatePublicationDecision({
      id: "decision-held",
      evidenceId: "evidence-gdp-2026-08",
      state: "held",
      decidedAt: "2026-10-06T08:02:00.000Z",
      reasonCode: "editorial-hold",
      reason: "Publication is intentionally held while the public product is re-baselined.",
    }).state).toBe("held");
  });

  it("requires explicit failure detail for failed or blocked collection results", () => {
    expect(() => validateCollectionResult({ ...collection, status: "failed", sourceEditionId: undefined, artifactRef: undefined, retrievedAt: undefined }))
      .toThrow(/error/i);
    expect(validateCollectionResult({
      id: "collection-blocked",
      runId: "run-2",
      sourceId: "nhs-rtt",
      status: "blocked",
      checkedAt: "2026-10-06T08:00:00.000Z",
      error: { code: "upstream-blocked", message: "Upstream rejected the supported egress path.", retryable: true },
    }).status).toBe("blocked");
  });

  it("accepts evidence only through an accepted verification result", () => {
    expect(validateVerificationResult(verification).evidenceIds).toEqual(["evidence-gdp-2026-08"]);
    expect(() => validateVerificationResult({ ...verification, status: "rejected", reasons: [], evidenceIds: [] }))
      .toThrow(/reason/i);
  });

  it("keeps evidence immutable with separate publication and freshness clocks", () => {
    const normalized = validateEvidenceRecord(evidence);
    expect(normalized.value).toBe(0.2);
    expect(normalized).not.toHaveProperty("availability");
    expect(normalized).not.toHaveProperty("publicationState");
    expect(normalized).not.toHaveProperty("validUntil");

    expect(validateFreshnessAssessment({
      evidenceId: normalized.id,
      state: "current",
      evaluatedAt: "2026-10-10T07:00:00.000Z",
      validUntil: "2026-11-20T06:00:00.000Z",
      reasonCode: "inside-source-window",
      reason: "The accepted source edition remains inside its source-owned currentness window.",
    }).state).toBe("current");

    expect(validateFreshnessAssessment({
      evidenceId: normalized.id,
      state: "expired",
      evaluatedAt: "2026-11-21T07:00:00.000Z",
      validUntil: "2026-11-20T06:00:00.000Z",
      reasonCode: "source-window-expired",
      reason: "The accepted source edition is now outside its source-owned currentness window.",
    }).state).toBe("expired");
  });

  it("rejects freshness states that contradict their validity deadline", () => {
    expect(() => validateFreshnessAssessment({
      evidenceId: evidence.id,
      state: "current",
      evaluatedAt: "2026-11-21T07:00:00.000Z",
      validUntil: "2026-11-20T06:00:00.000Z",
      reasonCode: "inside-source-window",
      reason: "Contradictory fixture.",
    })).toThrow(/deadline/i);

    expect(() => validateFreshnessAssessment({
      evidenceId: evidence.id,
      state: "expired",
      evaluatedAt: "2026-11-19T07:00:00.000Z",
      validUntil: "2026-11-20T06:00:00.000Z",
      reasonCode: "source-window-expired",
      reason: "Contradictory fixture.",
    })).toThrow(/deadline/i);
  });

  it("builds immutable editions only from explicit published decisions", () => {
    const published = validatePublicationDecision({
      id: "decision-published",
      evidenceId: evidence.id,
      state: "published",
      decidedAt: "2026-10-10T07:30:00.000Z",
      reasonCode: "verified-current",
      reason: "Accepted evidence is current and approved for public release.",
    });

    const edition = createImmutableEdition({
      publishedAt: "2026-10-10T08:00:00.000Z",
      previousEditionId: null,
      decisions: [published],
    });

    expect(edition.id).toMatch(/^edition-[0-9a-f]{16}$/);
    expect(edition.evidenceIds).toEqual([evidence.id]);
    expect(Object.isFrozen(edition)).toBe(true);
    expect(Object.isFrozen(edition.evidenceIds)).toBe(true);

    const held = validatePublicationDecision({
      id: "decision-held",
      evidenceId: evidence.id,
      state: "held",
      decidedAt: "2026-10-10T07:30:00.000Z",
      reasonCode: "editorial-hold",
      reason: "Not approved for public release.",
    });
    expect(() => createImmutableEdition({
      publishedAt: "2026-10-10T08:00:00.000Z",
      previousEditionId: null,
      decisions: [held],
    })).toThrow(/published decisions/i);
  });
});
