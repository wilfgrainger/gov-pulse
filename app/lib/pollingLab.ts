export type PollingPublication = {
  pollster: string;
  fieldworkStart: string;
  fieldworkEnd: string;
};

export type PollingFilters = {
  pollster: string;
  from: string;
  to: string;
};

export function filterPollingPublications<T extends PollingPublication>(
  publications: readonly T[],
  filters: PollingFilters,
): T[] {
  return publications.filter((publication) => {
    const publisherMatches = filters.pollster === "all" || publication.pollster === filters.pollster;
    const startsBeforeEnd = !filters.to || publication.fieldworkStart <= filters.to;
    const endsAfterStart = !filters.from || publication.fieldworkEnd >= filters.from;
    return publisherMatches && startsBeforeEnd && endsAfterStart;
  });
}

export function pollingLabOptions(publications: readonly PollingPublication[]) {
  return [...new Set(publications.map((publication) => publication.pollster))]
    .sort((left, right) => left.localeCompare(right, "en-GB"));
}
