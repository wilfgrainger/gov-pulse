/**
 * Polling table: primary publications only, party columns aligned.
 * No synthetic average. A share cannot appear without a source URL.
 * Correction notices are separate rows. Betting markets are absent.
 */

import type { PollCorrection } from "@/app/lib/pollingLab";

export const POLLING_TABLE_PARTY_ORDER = [
  "conservative",
  "labour",
  "liberalDemocrats",
  "reformUK",
  "green",
  "snp",
  "plaidCymru",
  "yourParty",
  "restoreBritain",
  "other",
] as const;

export type PollingTablePartyId = (typeof POLLING_TABLE_PARTY_ORDER)[number];

export const POLLING_TABLE_PARTY_LABELS: Record<PollingTablePartyId, string> = {
  conservative: "Con",
  labour: "Lab",
  liberalDemocrats: "LD",
  reformUK: "Reform",
  green: "Green",
  snp: "SNP",
  plaidCymru: "PC",
  yourParty: "Your Party",
  restoreBritain: "Restore",
  other: "Other",
};

export type PollingTablePollInput = {
  id: string;
  pollster: string;
  fieldworkStart: string;
  fieldworkEnd: string;
  publicationDate?: string | null;
  sampleSize: number;
  geography: string;
  parties: Partial<Record<PollingTablePartyId, number>>;
  sourceUrl: string;
};

export type PollingTablePublicationRow = {
  kind: "publication";
  id: string;
  pollster: string;
  fieldworkStart: string;
  fieldworkEnd: string;
  publicationDate: string | null;
  sampleSize: number;
  geography: string;
  sourceUrl: string;
  shares: Partial<Record<PollingTablePartyId, number>>;
};

export type PollingTableCorrectionRow = {
  kind: "correction";
  id: string;
  pollster: string;
  observationPeriod: string;
  geography: string;
  sourceUrl: string;
  correctedAt: string;
  title: string;
  shares: Partial<Record<PollingTablePartyId, number>>;
  originalShares: Partial<Record<PollingTablePartyId, number>>;
};

export type PollingTableRow = PollingTablePublicationRow | PollingTableCorrectionRow;

export type PollingTableModel = {
  partyColumns: PollingTablePartyId[];
  rows: PollingTableRow[];
  omittedWithoutSource: number;
  includesAverage: false;
  includesBettingMarkets: false;
};

function isHttpsSourceUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function finiteShare(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Keep only party shares that are finite percentages.
 * Called only after the publication already passed the source-URL gate.
 */
export function alignedPartyShares(
  parties: Partial<Record<PollingTablePartyId, number>> | null | undefined,
): Partial<Record<PollingTablePartyId, number>> {
  const shares: Partial<Record<PollingTablePartyId, number>> = {};
  if (!parties) return shares;
  for (const partyId of POLLING_TABLE_PARTY_ORDER) {
    const value = parties[partyId];
    if (finiteShare(value)) shares[partyId] = value;
  }
  return shares;
}

/**
 * Build the reader-facing polling table.
 * Publications without an https source URL are omitted entirely (fail closed).
 * Correction notices become their own rows and never feed an average.
 */
export function buildPollingTable(
  polls: readonly PollingTablePollInput[],
  corrections: readonly PollCorrection[] = [],
): PollingTableModel {
  const rows: PollingTableRow[] = [];
  let omittedWithoutSource = 0;

  for (const poll of polls) {
    if (!isHttpsSourceUrl(poll.sourceUrl)) {
      omittedWithoutSource += 1;
      continue;
    }
    if (!poll.id?.trim() || !poll.pollster?.trim()) continue;

    rows.push({
      kind: "publication",
      id: poll.id,
      pollster: poll.pollster,
      fieldworkStart: poll.fieldworkStart,
      fieldworkEnd: poll.fieldworkEnd,
      publicationDate: typeof poll.publicationDate === "string" ? poll.publicationDate : null,
      sampleSize: poll.sampleSize,
      geography: poll.geography,
      sourceUrl: poll.sourceUrl,
      shares: alignedPartyShares(poll.parties),
    });
  }

  for (const correction of corrections) {
    if (!isHttpsSourceUrl(correction.sourceUrl)) {
      omittedWithoutSource += 1;
      continue;
    }
    const shares: Partial<Record<PollingTablePartyId, number>> = {};
    const originalShares: Partial<Record<PollingTablePartyId, number>> = {};
    for (const result of correction.results) {
      const partyId = result.partyId as PollingTablePartyId;
      if (!POLLING_TABLE_PARTY_ORDER.includes(partyId)) continue;
      if (finiteShare(result.corrected)) shares[partyId] = result.corrected;
      if (finiteShare(result.original)) originalShares[partyId] = result.original;
    }
    rows.push({
      kind: "correction",
      id: correction.id,
      pollster: correction.pollster,
      observationPeriod: correction.observationPeriod,
      geography: correction.geography,
      sourceUrl: correction.sourceUrl,
      correctedAt: correction.correctedAt,
      title: correction.title,
      shares,
      originalShares,
    });
  }

  const usedParties = new Set<PollingTablePartyId>();
  for (const row of rows) {
    for (const partyId of POLLING_TABLE_PARTY_ORDER) {
      if (row.shares[partyId] !== undefined) usedParties.add(partyId);
      if (row.kind === "correction" && row.originalShares[partyId] !== undefined) {
        usedParties.add(partyId);
      }
    }
  }

  return {
    partyColumns: POLLING_TABLE_PARTY_ORDER.filter((partyId) => usedParties.has(partyId)),
    rows,
    omittedWithoutSource,
    includesAverage: false,
    includesBettingMarkets: false,
  };
}

/** Two pollsters can appear as separate rows; never as a combined average. */
export function distinctPollsters(table: PollingTableModel): string[] {
  return [...new Set(table.rows.map((row) => row.pollster))].sort((left, right) =>
    left.localeCompare(right, "en-GB"),
  );
}
