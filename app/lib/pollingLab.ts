export type PollingPublication = {
  pollster: string;
  fieldworkStart: string;
  fieldworkEnd: string;
  publicationDate?: string | null;
};

export type PollingFilters = {
  pollster: string;
  from: string;
  to: string;
  publicationFrom?: string;
  publicationTo?: string;
};

export type PollCorrectionResult = {
  partyId: string;
  label: string;
  original: number;
  corrected: number;
};

export type PollCorrection = {
  id: string;
  pollster: string;
  title: string;
  geography: string;
  observationPeriod: string;
  measure: string;
  unit: string;
  correctedAt: string;
  reason: string;
  sourceUrl: string;
  results: readonly PollCorrectionResult[];
};

export const HISTORICAL_POLL_CORRECTIONS: readonly PollCorrection[] = Object.freeze([
  Object.freeze({
    id: "ipsos-scottish-parliament-first-vote-september-2013",
    pollster: "Ipsos",
    title: "Scottish Parliament first vote intention",
    geography: "Scotland",
    observationPeriod: "September 2013",
    measure: "Certain to vote",
    unit: "%",
    correctedAt: "2013-10-03",
    reason: "Ipsos reported a data-processing error: responses for candidates outside the four main parties were omitted, making the main-party percentages too high. The correction notice provides the original and corrected values for the latest poll.",
    sourceUrl: "https://www.ipsos.com/en-uk/statement-voting-intention-figures-scottish-parliament-elections",
    results: Object.freeze([
      Object.freeze({ partyId: "snp", label: "Scottish National Party (SNP)", original: 41, corrected: 39 }),
      Object.freeze({ partyId: "labour", label: "Scottish Labour", original: 37, corrected: 35 }),
      Object.freeze({ partyId: "conservative", label: "Scottish Conservative and Unionist", original: 13, corrected: 12 }),
      Object.freeze({ partyId: "liberalDemocrats", label: "Scottish Liberal Democrat", original: 7, corrected: 7 }),
    ]),
  }),
]);

export function filterPollingPublications<T extends PollingPublication>(
  publications: readonly T[],
  filters: PollingFilters,
): T[] {
  return publications.filter((publication) => {
    const publisherMatches = filters.pollster === "all" || publication.pollster === filters.pollster;
    const startsBeforeEnd = !filters.to || publication.fieldworkStart <= filters.to;
    const endsAfterStart = !filters.from || publication.fieldworkEnd >= filters.from;
    const hasPublicationWindow = Boolean(filters.publicationFrom || filters.publicationTo);
    const publicationMatches = !hasPublicationWindow || (
      typeof publication.publicationDate === "string" &&
      (!filters.publicationFrom || publication.publicationDate >= filters.publicationFrom) &&
      (!filters.publicationTo || publication.publicationDate <= filters.publicationTo)
    );
    return publisherMatches && startsBeforeEnd && endsAfterStart && publicationMatches;
  });
}

export function pollingLabOptions(publications: readonly PollingPublication[]) {
  return [...new Set(publications.map((publication) => publication.pollster))]
    .sort((left, right) => left.localeCompare(right, "en-GB"));
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializePollingCorrectionJson(corrections: readonly PollCorrection[]) {
  return JSON.stringify({ schemaVersion: 1, correctionHistory: corrections }, null, 2);
}

export function serializePollingCorrectionCsv(corrections: readonly PollCorrection[]) {
  const columns = [
    "pollster", "correction_id", "title", "geography", "observation_period", "measure",
    "party_id", "party", "original_value", "corrected_value", "unit", "correction_date", "reason", "source_url",
  ];
  const rows = corrections.flatMap((correction) => correction.results.map((result) => [
    correction.pollster,
    correction.id,
    correction.title,
    correction.geography,
    correction.observationPeriod,
    correction.measure,
    result.partyId,
    result.label,
    result.original,
    result.corrected,
    correction.unit,
    correction.correctedAt,
    correction.reason,
    correction.sourceUrl,
  ].map(csvCell).join(",")));
  return [columns.map(csvCell).join(","), ...rows].join("\r\n") + "\r\n";
}
