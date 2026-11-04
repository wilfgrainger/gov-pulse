export type CollectionStatus = "succeeded" | "failed" | "blocked" | "not_due";
export type VerificationStatus = "accepted" | "rejected" | "pending";
export type FreshnessState = "current" | "update_due" | "expired";
export type PublicationState = "published" | "held" | "retired";
export type EvidenceClass =
  | "official-statistics"
  | "official-policy"
  | "administrative-data"
  | "polling"
  | "market-signal"
  | "derived-analysis";
export type ValueStatus = "observed" | "estimate" | "projection";

export type Geography = {
  code: string;
  label: string;
};

export type SourceDefinition = {
  id: string;
  name: string;
  publisher: string;
  evidenceClass: EvidenceClass;
  geography: Geography;
  primaryUrls: readonly string[];
  cadence: string;
  caveats: readonly string[];
};

export type MeasureDefinition = {
  id: string;
  sourceId: string;
  label: string;
  topic: string;
  geography: Geography;
  unit: string;
  basis: string;
  valueStatus: ValueStatus;
  comparisonKey: string;
  caveats: readonly string[];
};

export type CollectionError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type CollectionResult =
  | {
      id: string;
      runId: string;
      sourceId: string;
      status: "succeeded";
      checkedAt: string;
      retrievedAt: string;
      sourceEditionId: string;
      artifactRef: string;
    }
  | {
      id: string;
      runId: string;
      sourceId: string;
      status: "failed" | "blocked";
      checkedAt: string;
      error: CollectionError;
    }
  | {
      id: string;
      runId: string;
      sourceId: string;
      status: "not_due";
      checkedAt: string;
      reasonCode: string;
      reason: string;
    };

export type VerificationResult = {
  id: string;
  collectionResultId: string;
  sourceId: string;
  sourceEditionId: string;
  status: VerificationStatus;
  verifiedAt: string;
  evidenceIds: readonly string[];
  reasons: readonly string[];
};

export type EvidenceObservation = {
  period: string;
  observedAt: string;
  value: number | null;
  valueStatus: ValueStatus;
  revisionId: string;
};

export type EvidenceRecord = {
  schemaVersion: 1;
  id: string;
  measureId: string;
  sourceId: string;
  sourceEditionId: string;
  revisionId: string;
  geography: Geography;
  unit: string;
  basis: string;
  valueStatus: ValueStatus;
  value: number;
  observationPeriod: {
    start: string;
    end: string;
    label: string;
  };
  publishedAt: string;
  fetchedAt: string;
  sourceUrl: string;
  observations: readonly EvidenceObservation[];
  caveats: readonly string[];
};

export type FreshnessAssessment = {
  evidenceId: string;
  state: FreshnessState;
  evaluatedAt: string;
  validUntil: string;
  reasonCode: string;
  reason: string;
};

export type PublicationDecision = {
  id: string;
  evidenceId: string;
  state: PublicationState;
  decidedAt: string;
  reasonCode: string;
  reason: string;
};

export type ImmutableEdition = {
  schemaVersion: 1;
  id: string;
  fingerprint: string;
  publishedAt: string;
  previousEditionId: string | null;
  evidenceIds: readonly string[];
  decisionIds: readonly string[];
};

export const COLLECTION_STATUSES: readonly CollectionStatus[];
export const VERIFICATION_STATUSES: readonly VerificationStatus[];
export const FRESHNESS_STATES: readonly FreshnessState[];
export const PUBLICATION_STATES: readonly PublicationState[];
export const EVIDENCE_CLASSES: readonly EvidenceClass[];
export const VALUE_STATUSES: readonly ValueStatus[];

export function validateSourceDefinition(input: unknown): Readonly<SourceDefinition>;
export function validateMeasureDefinition(input: unknown): Readonly<MeasureDefinition>;
export function validateCollectionResult(input: unknown): Readonly<CollectionResult>;
export function validateVerificationResult(input: unknown): Readonly<VerificationResult>;
export function validateEvidenceRecord(input: unknown): Readonly<EvidenceRecord>;
export function validateFreshnessAssessment(input: unknown): Readonly<FreshnessAssessment>;
export function validatePublicationDecision(input: unknown): Readonly<PublicationDecision>;
export function createImmutableEdition(input: {
  publishedAt: string;
  previousEditionId: string | null;
  decisions: readonly PublicationDecision[];
}): Readonly<ImmutableEdition>;
export function fnv64(value: string): string;
