import { DATA_SOURCES, type EvidenceClass } from "./config";
import {
  isCompatibleMetricsSnapshot,
  type MetricsSnapshot,
  type SnapshotSourceStatus,
} from "./metricsSnapshot";
import { describeChange, describePercentageChange } from "./changeLanguage";
import { selectMeasure, type MeasureCatalog, type MeasureRecord } from "./measureCatalog";

export type EvidenceState = "current" | "update-due" | "unavailable";

type SignalId =
  | "gdp"
  | "inflation"
  | "unemployment"
  | "national-debt"
  | "nhs-waiting-list"
  | "net-migration"
  | "house-price-index"
  | "real-wages";

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

const SIGNAL_META: Record<
  SignalId,
  Pick<SignalPresentation, "id" | "anchorId" | "title" | "kicker" | "href" | "evidenceClass" | "geography">
> = {
  gdp: {
    id: "gdp",
    anchorId: "gdp",
    title: "GDP",
    kicker: "Growth",
    href: "/section/gdp",
    evidenceClass: DATA_SOURCES.gdpTracker.evidenceClass,
    geography: "United Kingdom",
  },
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
    kicker: "Labour market",
    href: "/section/employment",
    evidenceClass: DATA_SOURCES.employmentStats.evidenceClass,
    geography: "United Kingdom",
  },
  "national-debt": {
    id: "national-debt",
    anchorId: "national-debt",
    title: "National debt",
    kicker: "Public finances",
    href: "/section/national-debt",
    evidenceClass: DATA_SOURCES.nationalDebt.evidenceClass,
    geography: "United Kingdom",
  },
  "nhs-waiting-list": {
    id: "nhs-waiting-list",
    anchorId: "nhs",
    title: "NHS waiting list",
    kicker: "Public services",
    href: "/section/nhs",
    evidenceClass: DATA_SOURCES.nhsStats.evidenceClass,
    geography: "England",
  },
  "net-migration": {
    id: "net-migration",
    anchorId: "migration",
    title: "Net migration",
    kicker: "Population",
    href: "/section/migration",
    evidenceClass: DATA_SOURCES.migrationStats.evidenceClass,
    geography: "United Kingdom",
  },
  "house-price-index": {
    id: "house-price-index",
    anchorId: "house-price-index",
    title: "Average UK house price",
    kicker: "Housing",
    href: "/section/house-price-index",
    evidenceClass: DATA_SOURCES.housePriceIndex.evidenceClass,
    geography: "United Kingdom",
  },
  "real-wages": {
    id: "real-wages",
    anchorId: "real-wages",
    title: "Real wages",
    kicker: "Earnings",
    href: "/section/real-wages",
    evidenceClass: DATA_SOURCES.realWages.evidenceClass,
    geography: "Great Britain",
  },
};

const SIGNAL_ORDER = Object.keys(SIGNAL_META) as SignalId[];

export const DIRECT_EVIDENCE_LINKS = [
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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: unknown, monthOnly = false): string | null {
  const parsed = timestamp(value);
  if (parsed === null) return null;
  const options: Intl.DateTimeFormatOptions = monthOnly
    ? { month: "long", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(parsed));
}

function formatPercent(value: number, signed = false): string {
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatPoints(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} percentage points`;
}

function formatPeople(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function trimZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatCompactCount(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${trimZeros((value / 1_000_000).toFixed(Math.abs(value) >= 10_000_000 ? 1 : 2))}m`;
  }
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return formatPeople(value);
}

function historyPoints(value: unknown, valueKey: string): SignalHistoryPoint[] {
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

const CATALOG_BINDINGS = [
  { id: "gdp-threeMonthGrowth", section: "gdpTracker", valuePath: "headline.threeMonthGrowth", periodPath: "headline.period", publishedPath: "headline.releaseDate", historyPath: "history", historyKey: "threeMonthGrowth" },
  { id: "inflation", section: "sentimentPulse", valuePath: "series.inflation.value", periodPath: "series.inflation.period", publishedPath: "series.inflation.publishedAt", historyPath: "series.inflation.history", historyKey: "value" },
  { id: "unemployment", section: "employmentStats", valuePath: "headline.unemploymentRate", periodPath: "headline.period", publishedPath: "headline.releaseDate", historyPath: "history.labourForce", historyKey: "unemploymentRate" },
  { id: "debt-ratio", section: "nationalDebt", valuePath: "debtToGdp", periodPath: "observationPeriod", publishedPath: "publicationDate", historyPath: "history", historyKey: "debtToGdp" },
  { id: "waitingPathwaysEstimate", section: "nhsStats", valuePath: "headline.waitingPathwaysEstimate", periodPath: "headline.period", publishedPath: "headline.publicationDate", historyPath: "history", historyKey: "waitingPathwaysEstimate" },
  { id: "netMigration", section: "migrationStats", valuePath: "headline.netMigration", periodPath: "headline.period", publishedPath: "headline.releaseDate", historyPath: "history", historyKey: "netMigration" },
  { id: "regularPayRealGrowth", section: "realWages", valuePath: "headline.regularPayRealGrowthPercent", periodPath: "headline.period", publishedPath: "headline.releaseDate", historyPath: "history", historyKey: "regularPayRealGrowthPercent" },
] as const;

function setPath(root: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let target = root;
  for (const part of parts.slice(0, -1)) {
    const child = record(target[part]);
    if (!child) target[part] = {};
    target = target[part] as Record<string, unknown>;
  }
  target[parts.at(-1)!] = value;
}

function projectCatalogMeasures(snapshot: MetricsSnapshot, now: Date): MetricsSnapshot {
  if (!Object.hasOwn(snapshot.meta, "measureCatalog")) return snapshot;
  const rawCatalog = record(snapshot.meta.measureCatalog);
  const projected = structuredClone(snapshot);
  const catalog = rawCatalog as unknown as MeasureCatalog;
  for (const binding of CATALOG_BINDINGS) {
    const measure = selectMeasure(catalog, binding.id, now);
    const current: MeasureRecord | null = measure?.availability === "current" ? measure : null;
    const section = record(projected[binding.section]) ?? {};
    projected[binding.section] = section;
    section.available = current !== null;
    setPath(section, binding.valuePath, current?.value ?? null);
    setPath(section, binding.periodPath, current?.observationPeriod.label ?? null);
    setPath(section, binding.publishedPath, current?.publishedAt ?? null);
    const history = current?.points.flatMap((point) => point.value === null ? [] : [{
      observedAt: Date.parse(`${point.observedAt}T00:00:00.000Z`),
      period: point.period,
      [binding.historyKey]: point.value,
    }]) ?? [];
    setPath(section, binding.historyPath, history);
    const sources = projected.meta.sources as Record<string, Record<string, unknown> | undefined>;
    const source = { ...(record(sources[binding.section]) ?? {}) };
    const states = { ...(record(source.catalogMeasureStates) ?? {}) };
    const urls = { ...(record(source.catalogMeasureSources) ?? {}) };
    states[binding.id] = current ? "current" : measure ? "historical" : "unavailable";
    if (measure) urls[binding.id] = measure.sourceUrl;
    source.catalogMeasureStates = states;
    source.catalogMeasureSources = urls;
    sources[binding.section] = source;
  }
  return projected;
}

function sourceState(source: SnapshotSourceStatus | undefined): EvidenceState {
  if (!source || (source.status !== "ok" && source.status !== "stale")) return "unavailable";
  if (source.cacheState === "missing" || source.cacheState === "expired") return "unavailable";
  if (source.status === "stale" || source.cacheState === "stale") return "update-due";
  return "current";
}

export function hasNewerRelatedRelease(snapshot: MetricsSnapshot, section: "employmentStats" | "nationalDebt"): boolean {
  const sibling = section === "employmentStats" ? "sentimentPulse" : "taxRevenue";
  if (sourceState(snapshot.meta.sources[sibling]) !== "current") return false;
  const relatedDate = section === "employmentStats"
    ? timestamp(record(record(record(snapshot.sentimentPulse)?.series)?.unemployment)?.publishedAt)
    : timestamp(record(record(snapshot.taxRevenue)?.headline)?.releaseDate);
  const storedDate = section === "employmentStats"
    ? timestamp(record(record(snapshot.employmentStats)?.headline)?.releaseDate)
    : timestamp(record(snapshot.nationalDebt)?.publicationDate);
  return relatedDate !== null && storedDate !== null &&
    Math.floor(relatedDate / 86_400_000) > Math.floor(storedDate / 86_400_000);
}

function unavailable(id: SignalId): SignalPresentation {
  return {
    ...SIGNAL_META[id],
    state: "unavailable",
    value: null,
    comparison: null,
    period: null,
    publishedAt: null,
    sourceUrl: null,
    history: [],
    leadHeadline: null,
    leadSummary: null,
    caveat: null,
  };
}

function applySourceState(
  signal: SignalPresentation,
  source: SnapshotSourceStatus | undefined
): SignalPresentation {
  const catalogIds: Partial<Record<SignalId, string>> = {
    gdp: "gdp-threeMonthGrowth",
    inflation: "inflation",
    unemployment: "unemployment",
    "national-debt": "debt-ratio",
    "nhs-waiting-list": "waitingPathwaysEstimate",
    "net-migration": "netMigration",
    "real-wages": "regularPayRealGrowth",
  };
  const catalogId = catalogIds[signal.id];
  const catalogState = catalogId
    ? record(record(source)?.catalogMeasureStates)?.[catalogId]
    : undefined;
  const sourceUrl = catalogId
    ? record(record(source)?.catalogMeasureSources)?.[catalogId]
    : undefined;
  if (catalogState === "historical" || catalogState === "unavailable") return unavailable(signal.id);
  if (catalogState === "current") {
    const currentness = source?.status === "ok" && source.cacheState === "fresh" ? "current" : "update-due";
    return { ...signal, state: currentness, sourceUrl: typeof sourceUrl === "string" ? sourceUrl : null };
  }
  const state = sourceState(source);
  return state === "unavailable"
    ? unavailable(signal.id)
    : { ...signal, state };
}

function selectGdp(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.gdpTracker);
  const headline = record(data?.headline);
  const period = text(headline?.period);
  const threeMonth = finite(headline?.threeMonthGrowth);
  const annual = finite(headline?.annualGrowth);
  const publishedAt = formatDate(headline?.releaseDate);
  const monthly = finite(headline?.monthlyGrowth);
  if (data?.available !== true || !period || monthly === null || threeMonth === null || annual === null || !publishedAt) {
    return unavailable("gdp");
  }
  const movement = threeMonth === 0 ? "was unchanged" : threeMonth > 0 ? "grew" : "fell";
  const broader = threeMonth === 0 ? "was unchanged" : threeMonth > 0 ? "grew" : "fell";
  return applySourceState(
    {
      ...unavailable("gdp"),
      value: formatPercent(threeMonth, true),
      comparison: `Latest month ${formatPercent(monthly, true)} · from a year earlier ${formatPercent(annual, true)}`,
      period,
      publishedAt,
      history: historyPoints(data?.history, "threeMonthGrowth"),
      leadHeadline: `UK GDP ${movement} across the latest three months to ${period}${threeMonth === 0 ? "." : ` by ${Math.abs(threeMonth).toFixed(1)}%.`}`,
      leadSummary: `GDP ${broader}${threeMonth === 0 ? "." : ` by ${Math.abs(threeMonth).toFixed(1)}% over the latest three months.`} Monthly growth was ${formatPercent(monthly, true)}.`,
      caveat: "Monthly GDP is an early estimate and may be revised.",
    },
    snapshot.meta.sources.gdpTracker
  );
}

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

function selectMigration(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.migrationStats);
  const headline = record(data?.headline);
  const value = finite(headline?.netMigration);
  const change = finite(headline?.changePercent);
  const period = text(headline?.period);
  const previousPeriod = text(headline?.previousPeriod);
  const publishedAt = formatDate(headline?.releaseDate);
  const immigration = finite(headline?.immigration);
  const emigration = finite(headline?.emigration);
  if (value === null || !period || !publishedAt) return unavailable("net-migration");
  const direction = describeChange(change);
  const baseComparison = change === null
    ? "Previous-period comparison unavailable"
    : `${Math.abs(change).toFixed(0)}% ${change > 0 ? "higher" : change < 0 ? "lower" : "unchanged"}${previousPeriod ? ` than ${previousPeriod}` : ""}`;
  const flowsPresent = immigration !== null && emigration !== null;
  const comparison = flowsPresent
    ? `Immigration ${formatPeople(immigration)} · Emigration ${formatPeople(emigration)} · ${baseComparison}`
    : baseComparison;
  const flowSentence = flowsPresent
    ? ` Immigration was ${formatPeople(immigration)} and emigration ${formatPeople(emigration)}.`
    : "";
  return applySourceState(
    {
      ...unavailable("net-migration"),
      value: formatPeople(value),
      comparison,
      period,
      publishedAt,
      history: historyPoints(data?.history, "netMigration"),
      leadHeadline: change === null ? `Net migration was ${formatPeople(value)} in ${period}.` : change === 0 ? `Net migration was unchanged at ${formatPeople(value)} in ${period}.` : `Net migration ${direction} to ${formatPeople(value)} in ${period}.`,
      leadSummary:
        (change === null
          ? `The latest accepted ONS estimate covers ${period}; a matched previous-period comparison is unavailable.`
          : `The estimate is ${baseComparison.toLowerCase()}.`) + flowSentence,
      caveat: "Long-term migration estimates are provisional and subject to revision.",
    },
    snapshot.meta.sources.migrationStats
  );
}

function selectHousePriceIndex(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.housePriceIndex);
  const headline = record(data?.headline);
  const avgPriceGbp = finite(headline?.avgPriceGbp);
  const change = finite(headline?.changePercent);
  const previousChange = finite(headline?.previousChangePercent);
  const period = text(headline?.period);
  const previousPeriod = text(headline?.previousPeriod);
  const publishedAt = formatDate(headline?.releaseDate);
  if (avgPriceGbp === null || avgPriceGbp <= 0 || change === null || !period || !publishedAt) {
    return unavailable("house-price-index");
  }
  const direction = change === 0 ? "was unchanged" : change > 0 ? "rose" : "fell";
  const comparison = previousChange === null || !previousPeriod
    ? "Previous-period comparison unavailable"
    : `${formatPercent(previousChange)} in the 12 months to ${previousPeriod}`;
  return applySourceState(
    {
      ...unavailable("house-price-index"),
      value: `£${formatPeople(avgPriceGbp)}`,
      comparison,
      period,
      publishedAt,
      history: historyPoints(data?.history, "hpiChangePercent"),
      leadHeadline: `The average UK house price ${direction} to £${formatPeople(avgPriceGbp)} in the 12 months to ${period}.`,
      leadSummary: `Annual house price inflation is ${formatPercent(change)}${previousChange === null ? "." : `, compared with ${comparison}.`}`,
      caveat: "The average price level is headline-only and is not tracked as a time series; only the annual %-change is.",
    },
    snapshot.meta.sources.housePriceIndex
  );
}

function selectRealWages(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.realWages);
  const headline = record(data?.headline);
  const regularGrowth = finite(headline?.regularPayRealGrowthPercent);
  const totalGrowth = finite(headline?.totalPayRealGrowthPercent);
  const period = text(headline?.period);
  const publishedAt = formatDate(headline?.releaseDate);
  if (regularGrowth === null || totalGrowth === null || !period || !publishedAt) {
    return unavailable("real-wages");
  }
  const direction = describeChange(regularGrowth);
  return applySourceState(
    {
      ...unavailable("real-wages"),
      value: formatPercent(regularGrowth, true),
      comparison: `Total pay, real terms (CPIH-adjusted) ${formatPercent(totalGrowth, true)}`,
      period,
      publishedAt,
      history: historyPoints(data?.history, "regularPayRealGrowthPercent"),
      leadHeadline: `Regular pay ${direction} ${Math.abs(regularGrowth).toFixed(1)}% in real terms (CPIH-adjusted) in ${period}.`,
      leadSummary: `Total pay, including bonuses, ${describePercentageChange(totalGrowth)} in real terms over the same period. This is ONS's own CPIH-adjusted figure, not a public-data.org calculation.`,
      caveat: "Average weekly earnings are published on a provisional basis and are subject to revision.",
    },
    snapshot.meta.sources.realWages
  );
}

function emptyEdition(): NationalEvidenceEdition {
  const signals = SIGNAL_ORDER.map(unavailable);
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
    selectGdp(currentSnapshot),
    selectEconomicSeries(currentSnapshot, "inflation", "inflation"),
    selectUnemployment(currentSnapshot),
    selectDebt(currentSnapshot),
    selectNhs(currentSnapshot),
    selectMigration(currentSnapshot),
    selectHousePriceIndex(currentSnapshot),
    selectRealWages(currentSnapshot),
  ].map((signal) => {
    const section = signal.id === "unemployment" ? "employmentStats"
      : signal.id === "national-debt" ? "nationalDebt" : null;
    return section && signal.state === "current" && hasNewerRelatedRelease(currentSnapshot, section)
      ? { ...signal, state: "update-due" as const }
      : signal;
  });
  const preferred = (state: EvidenceState) =>
    signals
      .filter((signal) => signal.state === state)
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
