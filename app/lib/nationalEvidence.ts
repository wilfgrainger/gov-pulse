import {
  isCompatibleMetricsSnapshot,
  type MetricsSnapshot,
  type SnapshotSourceStatus,
} from "./metricsSnapshot";

export type EvidenceState = "current" | "update-due" | "unavailable";

type SignalId =
  | "gdp"
  | "inflation"
  | "bank-rate"
  | "unemployment"
  | "national-debt"
  | "nhs-waiting-list"
  | "net-migration"
  | "latest-poll";

export type SignalHistoryPoint = { observedAt: number; value: number };

export type SignalPresentation = {
  id: SignalId;
  anchorId: string | null;
  title: string;
  kicker: string;
  href: string;
  evidenceClass: string;
  state: EvidenceState;
  value: string | null;
  comparison: string | null;
  period: string | null;
  publishedAt: string | null;
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
  Pick<SignalPresentation, "id" | "anchorId" | "title" | "kicker" | "href" | "evidenceClass">
> = {
  gdp: {
    id: "gdp",
    anchorId: "gdp",
    title: "GDP",
    kicker: "Growth",
    href: "/section/gdp",
    evidenceClass: "Official statistics",
  },
  inflation: {
    id: "inflation",
    anchorId: "economy",
    title: "Inflation",
    kicker: "Prices",
    href: "/section/economy",
    evidenceClass: "Official data",
  },
  "bank-rate": {
    id: "bank-rate",
    anchorId: null,
    title: "Bank Rate",
    kicker: "Borrowing costs",
    href: "/section/economy",
    evidenceClass: "Official data",
  },
  unemployment: {
    id: "unemployment",
    anchorId: null,
    title: "Unemployment",
    kicker: "Labour market",
    href: "/section/economy",
    evidenceClass: "Official data",
  },
  "national-debt": {
    id: "national-debt",
    anchorId: "national-debt",
    title: "National debt",
    kicker: "Public finances",
    href: "/section/national-debt",
    evidenceClass: "Official monthly data",
  },
  "nhs-waiting-list": {
    id: "nhs-waiting-list",
    anchorId: "nhs",
    title: "NHS waiting list",
    kicker: "Public services",
    href: "/section/nhs",
    evidenceClass: "Administrative data",
  },
  "net-migration": {
    id: "net-migration",
    anchorId: "migration",
    title: "Net migration",
    kicker: "Population",
    href: "/section/migration",
    evidenceClass: "Official statistics",
  },
  "latest-poll": {
    id: "latest-poll",
    anchorId: "election-polls",
    title: "Latest poll",
    kicker: "Public opinion",
    href: "/section/election-polls",
    evidenceClass: "Polling evidence",
  },
};

const SIGNAL_ORDER = Object.keys(SIGNAL_META) as SignalId[];
const LEAD_PRIORITY: SignalId[] = [
  "gdp",
  "inflation",
  "national-debt",
  "nhs-waiting-list",
  "net-migration",
  "latest-poll",
  "bank-rate",
  "unemployment",
];

export const DIRECT_EVIDENCE_LINKS = [
  {
    href: "/section/crime-stats",
    label: "Crime statistics",
    description: "Crime Survey, police-recorded and court evidence kept separate.",
  },
  {
    href: "/section/government-contracts",
    label: "Government contracts",
    description: "The largest comparable disclosed awards and their limits.",
  },
  {
    href: "/section/tax",
    label: "Tax receipts",
    description: "Current official receipts on a stated accounting basis.",
  },
  {
    href: "/section/employment",
    label: "Employment",
    description: "Employment, inactivity and vacancies from the labour-market release.",
  },
] as const;

const PARTY_LABELS: Record<string, string> = {
  conservative: "Conservative",
  labour: "Labour",
  liberalDemocrats: "Liberal Democrats",
  reformUK: "Reform UK",
  green: "Green",
  snp: "SNP",
  plaidCymru: "Plaid Cymru",
  yourParty: "Your Party",
  restoreBritain: "Restore Britain",
  other: "Other",
};

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

function sourceState(source: SnapshotSourceStatus | undefined): EvidenceState {
  if (!source || (source.status !== "ok" && source.status !== "stale")) return "unavailable";
  if (source.cacheState === "missing" || source.cacheState === "expired") return "unavailable";
  if (source.status === "stale" || source.cacheState === "stale") return "update-due";
  return "current";
}

function unavailable(id: SignalId): SignalPresentation {
  return {
    ...SIGNAL_META[id],
    state: "unavailable",
    value: null,
    comparison: null,
    period: null,
    publishedAt: null,
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
  const state = sourceState(source);
  return state === "unavailable"
    ? unavailable(signal.id)
    : { ...signal, state };
}

function selectGdp(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.gdpTracker);
  const headline = record(data?.headline);
  const period = text(headline?.period);
  const monthly = finite(headline?.monthlyGrowth);
  const threeMonth = finite(headline?.threeMonthGrowth);
  const annual = finite(headline?.annualGrowth);
  const publishedAt = formatDate(headline?.releaseDate);
  if (data?.available !== true || !period || monthly === null || threeMonth === null || annual === null || !publishedAt) {
    return unavailable("gdp");
  }
  const movement = monthly === 0 ? "was unchanged" : monthly > 0 ? "grew" : "fell";
  const broader = threeMonth === 0 ? "was unchanged" : threeMonth > 0 ? "grew" : "fell";
  return applySourceState(
    {
      ...unavailable("gdp"),
      value: formatPercent(monthly, true),
      comparison: `Latest three months ${formatPercent(threeMonth, true)} · from a year earlier ${formatPercent(annual, true)}`,
      period,
      publishedAt,
      history: historyPoints(data?.history, "index"),
      leadHeadline: `UK GDP ${movement} in ${period}${monthly === 0 ? "." : ` by ${Math.abs(monthly).toFixed(1)}%.`}`,
      leadSummary: `Across the latest three months, real GDP ${broader}${threeMonth === 0 ? "." : ` by ${Math.abs(threeMonth).toFixed(1)}%.`}`,
      caveat: "Monthly GDP is an early estimate and may be revised.",
    },
    snapshot.meta.sources.gdpTracker
  );
}

function selectEconomicSeries(
  snapshot: MetricsSnapshot,
  key: "inflation" | "bankRate" | "unemployment",
  id: "inflation" | "bank-rate" | "unemployment"
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
      caveat:
        key === "bankRate"
          ? "Bank Rate changes after Monetary Policy Committee decisions; it is not a monthly estimate."
          : key === "unemployment"
            ? "Unemployment is a rolling three-month survey estimate."
            : "CPI does not describe every household's personal inflation rate.",
    },
    snapshot.meta.sources.sentimentPulse
  );
}

function selectDebt(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.nationalDebt);
  const debt = finite(data?.baseDebt);
  const ratio = finite(data?.debtToGdp);
  const annualDebt = finite(record(data?.annualDelta)?.debtBillion);
  const period = text(data?.observationPeriod) ?? formatDate(data?.baseDate, true);
  const publishedAt = formatDate(data?.publicationDate);
  if (debt === null || debt <= 0 || ratio === null || !period || !publishedAt) return unavailable("national-debt");
  const value = `£${(debt / 1_000_000_000_000).toFixed(2)}tn`;
  return applySourceState(
    {
      ...unavailable("national-debt"),
      value,
      comparison: `${ratio.toFixed(1)}% of GDP${annualDebt === null ? "" : ` · annual change ${annualDebt > 0 ? "+" : "-"}£${Math.abs(annualDebt).toFixed(1)}bn`}`,
      period,
      publishedAt,
      history: historyPoints(data?.history, "debtBillion"),
      leadHeadline: `UK public sector net debt stands at ${value}.`,
      leadSummary: `The matching official release puts debt at ${ratio.toFixed(1)}% of GDP for ${period}.`,
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
  const direction = yearChange === null || yearChange === 0 ? "was unchanged" : yearChange < 0 ? "fell" : "rose";
  return applySourceState(
    {
      ...unavailable("nhs-waiting-list"),
      value,
      comparison: `${yearChange === null ? "Annual change unavailable" : `${Math.abs(yearChange).toFixed(1)}% ${yearChange < 0 ? "lower" : yearChange > 0 ? "higher" : "unchanged"} than a year earlier`}${within18Weeks === null ? "" : ` · ${within18Weeks.toFixed(1)}% within 18 weeks`}`,
      period,
      publishedAt,
      history: historyPoints(data?.history, "waitingPathwaysEstimate"),
      leadHeadline: `${value} were waiting at the end of ${period}.`,
      leadSummary: `The waiting list ${direction}${yearChange === null || yearChange === 0 ? "." : ` by ${Math.abs(yearChange).toFixed(1)}% from a year earlier.`}`,
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
  if (value === null || !period || !publishedAt) return unavailable("net-migration");
  const direction = change === null || change === 0 ? "was unchanged" : change > 0 ? "rose" : "fell";
  const comparison = change === null
    ? "Previous-period comparison unavailable"
    : `${Math.abs(change).toFixed(0)}% ${change > 0 ? "higher" : change < 0 ? "lower" : "unchanged"}${previousPeriod ? ` than ${previousPeriod}` : ""}`;
  return applySourceState(
    {
      ...unavailable("net-migration"),
      value: formatPeople(value),
      comparison,
      period,
      publishedAt,
      history: historyPoints(data?.history, "netMigration"),
      leadHeadline: `Net migration ${direction} to ${formatPeople(value)} in ${period}.`,
      leadSummary:
        change === null
          ? `The latest accepted ONS estimate covers ${period}; a matched previous-period comparison is unavailable.`
          : `The estimate is ${comparison.toLowerCase()}.`,
      caveat: "Long-term migration estimates are provisional and subject to revision.",
    },
    snapshot.meta.sources.migrationStats
  );
}

function selectPoll(snapshot: MetricsSnapshot): SignalPresentation {
  const data = record(snapshot.electionPolling);
  const poll = Array.isArray(data?.polls) ? record(data.polls[0]) : null;
  const parties = record(poll?.parties);
  if (data?.available !== true || !poll || !parties) return unavailable("latest-poll");
  const leader = Object.entries(parties)
    .flatMap(([key, value]) => {
      const share = finite(value);
      return share === null ? [] : [{ key, share }];
    })
    .sort((left, right) => right.share - left.share)[0];
  const pollster = text(poll.pollster);
  const start = formatDate(poll.fieldworkStart);
  const end = formatDate(poll.fieldworkEnd);
  const publishedAt = formatDate(poll.publicationDate);
  if (!leader || !pollster || !end || !publishedAt) return unavailable("latest-poll");
  const label = PARTY_LABELS[leader.key] ?? leader.key;
  const period = start && start !== end ? `${start}–${end}` : end;
  return applySourceState(
    {
      ...unavailable("latest-poll"),
      value: `${leader.share.toFixed(0)}% ${label}`,
      comparison: `${pollster} · fieldwork ${period} · one publication, not a trend`,
      period,
      publishedAt,
      history: [],
      leadHeadline: `${pollster} reports ${label} at ${leader.share.toFixed(0)}%.`,
      leadSummary: "This is one accepted primary poll publication, not a polling average or forecast.",
      caveat: text(poll.uncertainty) ?? "Polling estimates carry sampling and methodology uncertainty.",
    },
    snapshot.meta.sources.electionPolling
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

export function selectNationalEvidenceEdition(snapshot: unknown): NationalEvidenceEdition {
  if (!isCompatibleMetricsSnapshot(snapshot)) return emptyEdition();
  const signals = [
    selectGdp(snapshot),
    selectEconomicSeries(snapshot, "inflation", "inflation"),
    selectEconomicSeries(snapshot, "bankRate", "bank-rate"),
    selectEconomicSeries(snapshot, "unemployment", "unemployment"),
    selectDebt(snapshot),
    selectNhs(snapshot),
    selectMigration(snapshot),
    selectPoll(snapshot),
  ];
  const preferred = (state: EvidenceState) =>
    LEAD_PRIORITY.map((id) => signals.find((signal) => signal.id === id))
      .find((signal) => signal?.state === state) ?? null;
  const counts = signals.reduce<Record<EvidenceState, number>>(
    (result, signal) => ({ ...result, [signal.state]: result[signal.state] + 1 }),
    { current: 0, "update-due": 0, unavailable: 0 }
  );
  return {
    generatedAt: formatDate(snapshot.meta.generatedAt),
    lead: preferred("current") ?? preferred("update-due"),
    signals,
    counts,
  };
}
