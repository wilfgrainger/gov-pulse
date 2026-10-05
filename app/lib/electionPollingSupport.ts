import {
  HISTORICAL_POLL_CORRECTIONS,
  type PollCorrection,
} from "@/app/lib/pollingLab";

export const FALLBACK = {
  available: false,
  latestPublicationDate: null,
  latestFieldworkEnd: "",
  expiresAt: "",
  polls: [],
  sources: [],
  aggregation: { method: "none", explanation: "" },
  evidencePolicy: {
    sourceClass: "primary-pollster-publication",
    bpcDisclosureRequired: true,
    secondaryAggregatorsUsedAsData: false,
  },
};

export const PARTY_META = {
  conservative: { label: "Conservative", color: "#0087DC" },
  labour: { label: "Labour", color: "#E4003B" },
  liberalDemocrats: { label: "Liberal Democrats", color: "#FAA61A" },
  reformUK: { label: "Reform UK", color: "#12B6CF" },
  green: { label: "Green", color: "#6AB023" },
  snp: { label: "SNP", color: "#FDF38E" },
  plaidCymru: { label: "Plaid Cymru", color: "#005B54" },
  yourParty: { label: "Your Party", color: "#6B7280" },
  restoreBritain: { label: "Restore Britain", color: "#7C3AED" },
  other: { label: "Other", color: "#767676" },
} as const;

export type PartyKey = keyof typeof PARTY_META;

export type PrimaryPoll = {
  id: string;
  pollster: string;
  commissioner: string | null;
  title: string;
  questionText: string | null;
  publicationDate: string | null;
  publicationDateStatus: "published" | "not-disclosed";
  fieldworkStart: string;
  fieldworkEnd: string;
  sampleSize: number;
  sampleSizeNote: string | null;
  geography: string;
  population: string;
  mode: string | null;
  headlineMethod: string;
  parties: Partial<Record<PartyKey, number>>;
  sourceUrl: string;
  methodologyUrl: string;
  bpcMember: boolean;
  uncertainty: string | null;
};

export type PollSource = {
  pollster: string;
  status: "current" | "partial" | "unavailable";
  recordCount: number;
  archiveFilesRequested?: number;
  archiveFilesValidated?: number;
  archiveFilesUnavailable?: number;
};

export function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isHttps(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("https://");
}

export function parseDateOnlyUtc(value: unknown) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return new Date(Number.NaN);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
    ? date
    : new Date(Number.NaN);
}

export function isPollCorrection(value: unknown): value is PollCorrection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const correction = value as Partial<PollCorrection>;
  let hostname = "";
  try {
    hostname = new URL(String(correction.sourceUrl ?? "")).hostname.toLowerCase();
  } catch {
    return false;
  }
  return nonEmptyText(correction.id) &&
    correction.pollster === "Ipsos" &&
    nonEmptyText(correction.title) &&
    correction.geography === "Scotland" &&
    correction.observationPeriod === "September 2013" &&
    correction.measure === "Certain to vote" &&
    correction.unit === "%" &&
    !Number.isNaN(parseDateOnlyUtc(correction.correctedAt).getTime()) &&
    nonEmptyText(correction.reason) &&
    isHttps(correction.sourceUrl) &&
    ["ipsos.com", "www.ipsos.com"].includes(hostname) &&
    Array.isArray(correction.results) &&
    correction.results.length > 0 &&
    correction.results.every((result) => result &&
      nonEmptyText(result.partyId) &&
      nonEmptyText(result.label) &&
      Number.isFinite(result.original) && result.original >= 0 && result.original <= 100 &&
      Number.isFinite(result.corrected) && result.corrected >= 0 && result.corrected <= 100);
}

export function isPrimaryPoll(value: unknown): value is PrimaryPoll {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const poll = value as Partial<PrimaryPoll>;
  const shares = poll.parties && typeof poll.parties === "object" ? Object.values(poll.parties) : [];
  return (
    nonEmptyText(poll.id) &&
    nonEmptyText(poll.pollster) &&
    (poll.commissioner === null || nonEmptyText(poll.commissioner)) &&
    nonEmptyText(poll.title) &&
    (poll.questionText === null || nonEmptyText(poll.questionText)) &&
    nonEmptyText(poll.geography) &&
    nonEmptyText(poll.population) &&
    (poll.mode === null || nonEmptyText(poll.mode)) &&
    nonEmptyText(poll.headlineMethod) &&
    (poll.uncertainty === null || nonEmptyText(poll.uncertainty)) &&
    (typeof poll.publicationDate === "string"
      ? !Number.isNaN(parseDateOnlyUtc(poll.publicationDate).getTime()) && poll.publicationDateStatus !== "not-disclosed"
      : poll.publicationDate === null && poll.publicationDateStatus === "not-disclosed") &&
    !Number.isNaN(parseDateOnlyUtc(poll.fieldworkStart).getTime()) &&
    !Number.isNaN(parseDateOnlyUtc(poll.fieldworkEnd).getTime()) &&
    Number.isInteger(poll.sampleSize) &&
    Number(poll.sampleSize) >= 500 &&
    shares.length >= 5 &&
    shares.every((share) => typeof share === "number" && Number.isFinite(share)) &&
    isHttps(poll.sourceUrl) &&
    isHttps(poll.methodologyUrl) &&
    poll.bpcMember === true
  );
}

export function isPollSource(value: unknown): value is PollSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Partial<PollSource>;
  return nonEmptyText(source.pollster) &&
    ["current", "partial", "unavailable"].includes(String(source.status)) &&
    Number.isSafeInteger(source.recordCount) &&
    Number(source.recordCount) >= 0 &&
    (source.status !== "partial" || Number(source.archiveFilesUnavailable) > 0);
}

export function validPayload(value: typeof FALLBACK) {
  const expiresAt = Date.parse(value?.expiresAt ?? "");
  return (
    value?.available === true &&
    Number.isFinite(expiresAt) &&
    expiresAt >= Date.now() &&
    Array.isArray(value.polls) &&
    value.polls.length > 0 &&
    value.polls.every(isPrimaryPoll) &&
    (value.sources === undefined || (Array.isArray(value.sources) && value.sources.every(isPollSource))) &&
    value.aggregation?.method === "none" &&
    value.evidencePolicy?.secondaryAggregatorsUsedAsData === false
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDateOnlyUtc(value));
}

export function publicationDateLabel(poll: PrimaryPoll) {
  return poll.publicationDate
    ? `Published ${formatDate(poll.publicationDate)}`
    : "Publisher did not disclose a publication date";
}

export function sourceStatusLabel(source: PollSource) {
  if (source.status === "unavailable") return `${source.pollster}: source check unavailable.`;
  if (source.status === "partial") {
    return `${source.pollster}: ${source.recordCount} publications verified; ${source.archiveFilesUnavailable} historical archive files could not be checked.`;
  }
  return `${source.pollster}: ${source.recordCount} publications verified.`;
}

export function fieldworkLabel(poll: PrimaryPoll) {
  return poll.fieldworkStart === poll.fieldworkEnd
    ? formatDate(poll.fieldworkEnd)
    : `${formatDate(poll.fieldworkStart)}–${formatDate(poll.fieldworkEnd)}`;
}

export function rankedParties(poll: PrimaryPoll) {
  return (Object.entries(poll.parties) as Array<[PartyKey, number]>)
    .filter(([key, share]) => key in PARTY_META && Number.isFinite(share))
    .sort((left, right) => right[1] - left[1]);
}

export function acceptedCorrections() {
  return HISTORICAL_POLL_CORRECTIONS.filter(isPollCorrection);
}
