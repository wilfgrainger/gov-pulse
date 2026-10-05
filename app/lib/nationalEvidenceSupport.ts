import { DATA_SOURCES, type EvidenceClass } from "./config";

export type EvidenceState = "current" | "update-due" | "unavailable";

export type SignalId =
  | "inflation"
  | "unemployment"
  | "national-debt"
  | "private-rents"
  | "nhs-waiting-list"
  | "government-contracts";

export type SignalHistoryPoint = { observedAt: number; value: number };

export type SignalPresentation = {
  id: SignalId;
  anchorId: string | null;
  title: string;
  kicker: string;
  href: string;
  evidenceClass: EvidenceClass;
  geography: string;
  state: EvidenceState;
  value: string | null;
  comparison: string | null;
  period: string | null;
  publishedAt: string | null;
  /** Label shown before publishedAt on a topic card. Defaults to "Published". */
  dateLabel?: string;
  sourceUrl: string | null;
  history: SignalHistoryPoint[];
  leadHeadline: string | null;
  leadSummary: string | null;
  caveat: string | null;
};

export type NationalEvidenceEdition = {
  generatedAt: string | null;
  lead: SignalPresentation | null;
  signals: SignalPresentation[];
  counts: Record<EvidenceState, number>;
};

export const SIGNAL_META: Record<
  SignalId,
  Pick<SignalPresentation, "id" | "anchorId" | "title" | "kicker" | "href" | "evidenceClass" | "geography">
> = {
  inflation: {
    id: "inflation",
    anchorId: "economy",
    title: "Inflation",
    kicker: "Prices",
    href: "/section/economy",
    evidenceClass: DATA_SOURCES.sentimentPulse.evidenceClass,
    geography: "United Kingdom",
  },
  unemployment: {
    id: "unemployment",
    anchorId: "employment",
    title: "Unemployment",
    kicker: "Jobs",
    href: "/section/employment",
    evidenceClass: DATA_SOURCES.employmentStats.evidenceClass,
    geography: "United Kingdom",
  },
  "national-debt": {
    id: "national-debt",
    anchorId: "national-debt",
    title: "National debt",
    kicker: "Debt",
    href: "/section/national-debt",
    evidenceClass: DATA_SOURCES.nationalDebt.evidenceClass,
    geography: "United Kingdom",
  },
  "private-rents": {
    id: "private-rents",
    anchorId: "rents",
    title: "Private rents",
    kicker: "Rents",
    href: "/section/house-price-index",
    evidenceClass: DATA_SOURCES.housePriceIndex.evidenceClass,
    geography: "United Kingdom",
  },
  "nhs-waiting-list": {
    id: "nhs-waiting-list",
    anchorId: "nhs",
    title: "NHS waiting list",
    kicker: "NHS",
    href: "/section/nhs",
    evidenceClass: DATA_SOURCES.nhsStats.evidenceClass,
    geography: "England",
  },
  "government-contracts": {
    id: "government-contracts",
    anchorId: "government-contracts",
    title: "Contract award notices",
    kicker: "Contracts",
    href: "/section/government-contracts",
    evidenceClass: DATA_SOURCES.governmentContracts.evidenceClass,
    geography: "United Kingdom",
  },
};

/** The six homepage topic cards, in reading order. */
export const TOPIC_CARD_ORDER = [
  "inflation",
  "unemployment",
  "national-debt",
  "private-rents",
  "nhs-waiting-list",
  "government-contracts",
] as const satisfies readonly SignalId[];

/**
 * Procurement notices are administrative records of commitments, not a
 * measured change in an official series, so they never become the lead.
 */
export const LEAD_EXCLUDED: ReadonlySet<SignalId> = new Set<SignalId>(["government-contracts"]);

export const DIRECT_EVIDENCE_LINKS = [
  {
    href: "/section/gdp",
    label: "GDP",
    description: "Monthly and three-month growth, each on its own ONS release period.",
  },
  {
    href: "/section/real-wages",
    label: "Real wages",
    description: "ONS CPIH-adjusted regular and total pay growth for Great Britain.",
  },
  {
    href: "/section/house-price-index",
    label: "House prices",
    description: "UK House Price Index, kept separate from private rents.",
  },
  {
    href: "/section/migration",
    label: "Net migration",
    description: "Provisional ONS long-term international migration estimates.",
  },
  {
    href: "/section/government-contracts",
    label: "Government contracts",
    description: "Find a Tender award disclosures, with buyer, supplier, revision and value-basis caveats.",
  },
  {
    href: "/section/crime-stats",
    label: "Crime statistics",
    description: "Crime Survey, police-recorded and court evidence kept separate.",
  },
  {
    href: "/section/tax",
    label: "Tax receipts",
    description: "Current official receipts on a stated accounting basis.",
  },
  {
    href: "/section/election-polls",
    label: "Election polling",
    description: "Individual pollster publications, separate from official statistics.",
  },
] as const;

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function timestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDate(value: unknown, monthOnly = false): string | null {
  const parsed = timestamp(value);
  if (parsed === null) return null;
  const options: Intl.DateTimeFormatOptions = monthOnly
    ? { month: "long", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(parsed));
}

export function formatPercent(value: number, signed = false): string {
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatPoints(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} percentage points`;
}

export function formatPeople(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function trimZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatCompactCount(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${trimZeros((value / 1_000_000).toFixed(Math.abs(value) >= 10_000_000 ? 1 : 2))}m`;
  }
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return formatPeople(value);
}

export function historyPoints(value: unknown, valueKey: string): SignalHistoryPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      const row = record(entry);
      const observedAt = timestamp(row?.observedAt);
      const pointValue = finite(row?.[valueKey]);
      return observedAt === null || pointValue === null ? [] : [{ observedAt, value: pointValue }];
    })
    .sort((left, right) => left.observedAt - right.observedAt)
    .slice(-36);
}
