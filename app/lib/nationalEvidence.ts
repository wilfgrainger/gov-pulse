import type { MetricsSnapshot } from "./metricsSnapshot";
import { isCompatibleMetricsSnapshot } from "./metricsSnapshot";
import { describeChange } from "./changeLanguage";
import {
  type EvidenceState,
  type SignalPresentation,
  type NationalEvidenceEdition,
  SIGNAL_META,
  TOPIC_CARD_ORDER,
  LEAD_EXCLUDED,
  record,
  text,
  finite,
  formatDate,
  formatPercent,
  formatPoints,
  formatPeople,
  formatCompactCount,
  historyPoints,
  timestamp,
} from "./nationalEvidenceSupport";
import {
  projectCatalogMeasures,
  hasNewerRelatedRelease,
  unavailable,
  applySourceState,
} from "./nationalEvidenceCatalog";

export type {
  EvidenceState,
  SignalHistoryPoint,
  SignalPresentation,
  NationalEvidenceEdition,
} from "./nationalEvidenceSupport";
export { TOPIC_CARD_ORDER, DIRECT_EVIDENCE_LINKS } from "./nationalEvidenceSupport";
export { hasNewerRelatedRelease } from "./nationalEvidenceCatalog";

function selectEconomicSeries(
  snapshot: MetricsSnapshot,
  key: "inflation",
  id: "inflation"
): SignalPresentation {
  const data = record(snapshot.sentimentPulse);
  const series = record(record(data?.series)?.[key]);
  const value = finite(series?.value);
  const period = text(series?.period);
  const publishedAt = formatDate(series?.publishedAt);
  if (data?.available !== true || value === null || !period || !publishedAt) return unavailable(id);
  const annualDelta = finite(series?.annualDelta);
  const title = SIGNAL_META[id].title;
  return applySourceState(
    {
      ...unavailable(id),
      value: formatPercent(value),
      comparison: annualDelta === null ? "Annual comparison unavailable" : `Annual change ${formatPoints(annualDelta)}`,
      period,
      publishedAt,
      history: historyPoints(series?.history, "value"),
      leadHeadline: `${title} is ${formatPercent(value)}.`,
      leadSummary: `${title} is shown on its own publication period: ${period}.`,
      caveat: "CPI does not describe every household's personal inflation rate.",
    },
    snapshot.meta.sources.sentimentPulse
  );
}

function selectUnemployment(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.employmentStats);
  const headline = record(data?.headline);
  const value = finite(headline?.unemploymentRate);
  const period = text(headline?.period);
  const publishedAt = formatDate(headline?.releaseDate);
  if (data?.available !== true || value === null || !period || !publishedAt) return unavailable("unemployment");
  const annualDelta = finite(record(data?.annualDelta)?.unemploymentRatePoints);
  return applySourceState(
    {
      ...unavailable("unemployment"),
      value: formatPercent(value),
      comparison: annualDelta === null ? "Annual comparison unavailable" : `Annual change ${formatPoints(annualDelta)}`,
      period,
      publishedAt,
      history: historyPoints(record(data?.history)?.labourForce, "unemploymentRate"),
      leadHeadline: `Unemployment was ${formatPercent(value)} in ${period}.`,
      leadSummary: "This is the ONS rolling three-month Labour Force Survey estimate.",
      caveat: "Survey estimates carry sampling uncertainty and may be revised.",
    },
    snapshot.meta.sources.employmentStats
  );
}

function selectDebt(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.nationalDebt);
  const debt = finite(data?.baseDebt);
  const ratio = finite(data?.debtToGdp);
  const annualDebt = finite(record(data?.annualDelta)?.debtBillion);
  const rawPeriod = text(data?.observationPeriod);
  const period = rawPeriod?.match(/^\d{4}\s+[A-Z]{3}$/)
    ? formatDate(data?.baseDate, true)
    : rawPeriod ?? formatDate(data?.baseDate, true);
  const publishedAt = formatDate(data?.publicationDate);
  if (debt === null || debt <= 0 || ratio === null || !period || !publishedAt) return unavailable("national-debt");
  const value = `${ratio.toFixed(1)}% of GDP`;
  return applySourceState(
    {
      ...unavailable("national-debt"),
      value,
      comparison: `Debt stock £${(debt / 1_000_000_000_000).toFixed(2)}tn${annualDebt === null ? "" : ` · annual change ${annualDebt > 0 ? "+" : "-"}£${Math.abs(annualDebt).toFixed(1)}bn`}`,
      period,
      publishedAt,
      history: historyPoints(data?.history, "debtToGdp"),
      leadHeadline: `UK public sector net debt was ${value} in ${period}.`,
      leadSummary: `The same release puts the debt stock at £${(debt / 1_000_000_000_000).toFixed(2)}tn.`,
      caveat: "This is a dated stock, not a real-time counter.",
    },
    snapshot.meta.sources.nationalDebt
  );
}

function selectNhs(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.nhsStats);
  const headline = record(data?.headline);
  const waiting = finite(headline?.waitingPathwaysEstimate);
  const yearChange = finite(headline?.yearChangePercent);
  const within18Weeks = finite(headline?.within18WeeksPercent);
  const period = text(headline?.period);
  const publishedAt = formatDate(headline?.publicationDate);
  if (data?.available !== true || waiting === null || !period || !publishedAt) return unavailable("nhs-waiting-list");
  const value = `${formatCompactCount(waiting)} pathways`;
  const direction = describeChange(yearChange);
  return applySourceState(
    {
      ...unavailable("nhs-waiting-list"),
      value,
      comparison: `${yearChange === null ? "Annual change unavailable" : `${Math.abs(yearChange).toFixed(1)}% ${yearChange < 0 ? "lower" : yearChange > 0 ? "higher" : "unchanged"} than a year earlier`}${within18Weeks === null ? "" : ` · ${within18Weeks.toFixed(1)}% within 18 weeks`}`,
      period,
      publishedAt,
      history: historyPoints(data?.history, "waitingPathwaysEstimate"),
      leadHeadline: `${value} were waiting at the end of ${period}.`,
      leadSummary: yearChange === null ? "A matched annual comparison is unavailable." : `The waiting list ${direction}${yearChange === 0 ? "." : ` by ${Math.abs(yearChange).toFixed(1)}% from a year earlier.`}`,
      caveat: "Pathways are not unique people; some patients wait on more than one pathway.",
    },
    snapshot.meta.sources.nhsStats
  );
}

function selectPrivateRents(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.housePriceIndex);
  const headline = record(data?.headline);
  const change = finite(headline?.privateRentAnnualChangePercent);
  const average = finite(headline?.avgMonthlyPrivateRentGbp);
  const previousChange = finite(headline?.previousPrivateRentAnnualChangePercent);
  const period = text(headline?.privateRentPeriod);
  const previousPeriod = text(headline?.previousPrivateRentPeriod);
  const publishedAt = formatDate(headline?.releaseDate);
  if (change === null || average === null || average <= 0 || !period || !publishedAt) {
    return unavailable("private-rents");
  }
  const direction = change === 0 ? "were unchanged" : change > 0 ? "rose" : "fell";
  const previous = previousChange === null || !previousPeriod
    ? "previous-period comparison unavailable"
    : `${formatPercent(previousChange, true)} in the 12 months to ${previousPeriod}`;
  return applySourceState(
    {
      ...unavailable("private-rents"),
      value: formatPercent(change, true),
      comparison: `Average £${formatPeople(average)} a month · ${previous}`,
      period: `12 months to ${period}`,
      publishedAt,
      history: historyPoints(data?.history, "privateRentAnnualChangePercent"),
      leadHeadline: change === 0
        ? `UK private rents were unchanged in the 12 months to ${period}.`
        : `UK private rents ${direction} ${Math.abs(change).toFixed(1)}% in the 12 months to ${period}.`,
      leadSummary: `The ONS average monthly private rent was £${formatPeople(average)}.`,
      caveat: "PIPR measures rents paid by private tenants; it is not an individual household's rent.",
    },
    snapshot.meta.sources.housePriceIndex
  );
}

const CONTRACT_EXCLUSION_FIELDS = [
  "excludedMissingValue",
  "excludedAmbiguousContractValue",
  "excludedNonGbp",
  "excludedMissingBuyer",
  "excludedMissingSupplier",
  "excludedMalformed",
] as const;

function selectGovernmentContracts(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.governmentContracts);
  const window = record(data?.window);
  const quality = record(data?.dataQuality);
  const comparable = finite(quality?.validComparableAwards);
  const label = text(window?.label);
  const updatedTo = formatDate(window?.updatedTo);
  const exclusions = CONTRACT_EXCLUSION_FIELDS.map((field) => finite(quality?.[field]));
  const excluded = exclusions.every((value) => value !== null && Number.isInteger(value) && value >= 0)
    ? exclusions.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  if (
    data?.available !== true ||
    comparable === null ||
    !Number.isInteger(comparable) ||
    comparable <= 0 ||
    excluded === null ||
    !label ||
    !updatedTo
  ) {
    return unavailable("government-contracts");
  }
  return applySourceState(
    {
      ...unavailable("government-contracts"),
      value: `${formatPeople(comparable)} awards`,
      comparison: `Notices updated, not money spent · ${formatPeople(excluded)} excluded for missing or non-comparable values`,
      period: label,
      publishedAt: updatedTo,
      dateLabel: "Notices to",
      leadHeadline: null,
      leadSummary: null,
      caveat: "Award notices record commitments, not cash paid.",
    },
    snapshot.meta.sources.governmentContracts
  );
}

function emptyEdition(): NationalEvidenceEdition {
  const signals = TOPIC_CARD_ORDER.map(unavailable);
  return {
    generatedAt: null,
    lead: null,
    signals,
    counts: { current: 0, "update-due": 0, unavailable: signals.length },
  };
}

export function selectNationalEvidenceEdition(snapshot: unknown, now = new Date()): NationalEvidenceEdition {
  if (!isCompatibleMetricsSnapshot(snapshot)) return emptyEdition();
  const currentSnapshot = projectCatalogMeasures(snapshot, now);
  const signals = [
    selectEconomicSeries(currentSnapshot, "inflation", "inflation"),
    selectUnemployment(currentSnapshot),
    selectDebt(currentSnapshot),
    selectPrivateRents(currentSnapshot),
    selectNhs(currentSnapshot),
    selectGovernmentContracts(currentSnapshot),
  ].map((signal) => {
    const section = signal.id === "unemployment" ? "employmentStats"
      : signal.id === "national-debt" ? "nationalDebt" : null;
    return section && signal.state === "current" && hasNewerRelatedRelease(currentSnapshot, section)
      ? { ...signal, state: "update-due" as const }
      : signal;
  });
  const preferred = (state: EvidenceState) =>
    signals
      .filter((signal) => signal.state === state && !LEAD_EXCLUDED.has(signal.id))
      .sort((left, right) => (timestamp(right.publishedAt) ?? 0) - (timestamp(left.publishedAt) ?? 0))[0] ?? null;
  const counts = signals.reduce<Record<EvidenceState, number>>(
    (result, signal) => ({ ...result, [signal.state]: result[signal.state] + 1 }),
    { current: 0, "update-due": 0, unavailable: 0 }
  );
  return {
    generatedAt: formatDate(currentSnapshot.meta.generatedAt),
    lead: preferred("current") ?? preferred("update-due"),
    signals,
    counts,
  };
}
