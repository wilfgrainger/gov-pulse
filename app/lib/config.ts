// Verified data delivery configuration.

// The browser uses one same-origin, schema-checked snapshot path. Runtime
// publisher identity and currentness policy live in worker/feed-registry.js.
export const METRICS_SNAPSHOT_PATH = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data/metrics-snapshot.json`;

// Published evidence changes daily; hourly client revalidation avoids wasteful polling.
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export type DataAutomation =
  | "automated"
  | "static"
  | "interactive"
  | "withdrawn";

export type DataCollectionLayer = "worker" | "publication";

export type EvidenceClass =
  | "official-data"
  | "public-opinion"
  | "market-signal"
  | "derived-analysis"
  | "user-generated";

export const EVIDENCE_CLASS_LABELS: Record<EvidenceClass, string> = {
  "official-data": "Official data",
  "public-opinion": "Public opinion",
  "market-signal": "Market signal",
  "derived-analysis": "Derived analysis",
  "user-generated": "User-generated",
};

export const EVIDENCE_CLASS_DESCRIPTIONS: Record<EvidenceClass, string> = {
  "official-data":
    "Published by public statistical, fiscal, monetary or service bodies. Definitions, revisions and release timing follow the named publishers.",
  "public-opinion":
    "Survey or polling evidence. Results are estimates and can vary with sample, fieldwork dates, question wording and methodology.",
  "market-signal":
    "Commercial market prices and raw reciprocal percentages. They depend on liquidity, provider coverage and market rules. They are not an official statistic or an official forecast.",
  "derived-analysis":
    "public-data.org analysis combining named public sources. Interpretation depends on the stated method and source coverage.",
  "user-generated":
    "A result generated from user responses. It is not a public statistic or population estimate.",
};

export interface DataSourceDefinition {
  name: string;
  frequency: string;
  sources: string[];
  automation: DataAutomation;
  collectionLayer?: DataCollectionLayer;
  evidenceClass: EvidenceClass;
  geographicCoverage: string;
  freshnessWindow?: string;
  freshnessRationale?: string;
  freshnessWindowMs?: number;
  publicationRequirement?: "required" | "optional";
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const INTERACTIVE_ONLY_SECTIONS = ["politicalCompass"] as const;

// UI copy only. Runtime source identity and publication currentness are owned by
// worker/feed-registry.js and are checked separately in source-ownership tests.
export const DATA_SOURCES: Record<string, DataSourceDefinition> = {
  pmApproval: {
    name: "PM Approval",
    frequency: "withdrawn",
    sources: ["No current verified source"],
    automation: "withdrawn",
    evidenceClass: "public-opinion",
    geographicCoverage: "Great Britain",
  },
  electionPolling: {
    name: "Election Polling",
    frequency: "as published",
    sources: ["Verified primary pollster publications", "British Polling Council disclosure rules"],
    automation: "automated",
    evidenceClass: "public-opinion",
    geographicCoverage: "Great Britain",
    freshnessWindow: "Within 14 days of primary publication",
    freshnessRationale: "Each accepted poll retains its original publication date and is withdrawn after 14 days.",
    freshnessWindowMs: 14 * DAY_MS,
  },
  bettingOdds: {
    name: "Political Betting Markets",
    frequency: "every 3 hours",
    sources: ["Oddschecker public politics markets"],
    automation: "automated",
    evidenceClass: "market-signal",
    geographicCoverage: "United Kingdom",
    freshnessWindow: "Within 4 hours of market observation",
    freshnessRationale: "Each observation retains its original time and is withdrawn after four hours. Older prices are never presented as current.",
    freshnessWindowMs: 4 * HOUR_MS,
    publicationRequirement: "optional",
  },
  polarizationMeter: {
    name: "Polarization Measure",
    frequency: "withdrawn",
    sources: ["No current verified source"],
    automation: "withdrawn",
    evidenceClass: "derived-analysis",
    geographicCoverage: "Great Britain",
  },
  trendLines: {
    name: "Government Satisfaction Trend",
    frequency: "withdrawn",
    sources: ["No current verified source"],
    automation: "withdrawn",
    evidenceClass: "public-opinion",
    geographicCoverage: "Great Britain",
  },
  nationalDebt: {
    name: "National Debt",
    frequency: "monthly",
    sources: ["ONS Public Sector Finances"],
    automation: "automated",
    evidenceClass: "official-data",
    geographicCoverage: "United Kingdom",
    freshnessWindow: "Checked within 40 days",
    freshnessRationale: "Public sector finance data is normally monthly; the window allows for weekends, bank holidays and release-calendar variation.",
    freshnessWindowMs: 40 * DAY_MS,
  },
  gdpTracker: {
    name: "GDP",
    frequency: "monthly",
    sources: ["ONS GDP monthly estimate"],
    automation: "automated",
    evidenceClass: "official-data",
    geographicCoverage: "United Kingdom",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The rolling ONS bulletin is checked regularly. The observation period is assessed separately from the date of that check.",
    freshnessWindowMs: 36 * HOUR_MS,
  },
  sentimentPulse: {
    name: "Key Economic Indicators",
    frequency: "series-specific",
    sources: ["ONS CPI D7G7", "Bank of England Bank Rate IUDBEDR", "ONS unemployment MGSX"],
    automation: "automated",
    evidenceClass: "official-data",
    geographicCoverage: "United Kingdom",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "CPI, Bank Rate and unemployment keep separate observation periods, publication dates and revision status.",
    freshnessWindowMs: 36 * HOUR_MS,
  },
  taxRevenue: {
    name: "Government Receipts",
    frequency: "monthly",
    sources: ["ONS Public Sector Finances"],
    automation: "automated",
    evidenceClass: "official-data",
    geographicCoverage: "United Kingdom",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The rolling public-sector-finance bulletin is checked regularly, while its publication period is assessed separately.",
    freshnessWindowMs: 36 * HOUR_MS,
  },
  governmentContracts: {
    name: "Government Contracts",
    frequency: "daily Cloudflare Queue collection",
    sources: ["Cabinet Office Find a Tender OCDS award releases"],
    automation: "automated",
    collectionLayer: "publication",
    evidenceClass: "official-data",
    geographicCoverage: "United Kingdom — Find a Tender publication coverage",
    freshnessWindow: "Within 72 hours of the verified collection",
    freshnessRationale: "The ranking uses seven complete UTC day shards collected by the Cloudflare Free data worker and can reuse only a still-current bounded last-known-good publication.",
    freshnessWindowMs: 72 * HOUR_MS,
    publicationRequirement: "optional",
  },
  employmentStats: {
    name: "Employment",
    frequency: "monthly",
    sources: ["ONS UK labour market bulletin"],
    automation: "automated",
    evidenceClass: "official-data",
    geographicCoverage: "United Kingdom",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The latest labour-market bulletin is checked regularly, with each observation period shown separately.",
    freshnessWindowMs: 36 * HOUR_MS,
  },
  crimeStatistics: {
    name: "Crime Statistics",
    frequency: "periodic",
    sources: ["ONS Crime Survey for England and Wales", "Home Office Police Recorded Crime", "Ministry of Justice Criminal Court Statistics"],
    automation: "automated",
    evidenceClass: "official-data",
    geographicCoverage: "England and Wales",
  },
  nhsStats: {
    name: "NHS Referral to Treatment",
    frequency: "monthly",
    sources: ["NHS England RTT statistical press notice"],
    automation: "automated",
    evidenceClass: "official-data",
    geographicCoverage: "England",
    freshnessWindow: "Within 45 days of primary publication",
    freshnessRationale: "Each accepted RTT publication retains its NHS England publication date and is withdrawn after 45 days.",
    freshnessWindowMs: 45 * DAY_MS,
  },
  migrationStats: {
    name: "Migration",
    frequency: "periodic",
    sources: ["ONS Long-term international migration"],
    automation: "automated",
    evidenceClass: "official-data",
    geographicCoverage: "United Kingdom",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The latest ONS edition is checked regularly, while its publication period is assessed separately.",
    freshnessWindowMs: 36 * HOUR_MS,
  },
  earlyYears: {
    name: "Early Years Spotlight",
    frequency: "periodic",
    sources: ["UKHSA COVER childhood vaccination statistics", "DfE School Readiness"],
    automation: "static",
    evidenceClass: "official-data",
    geographicCoverage: "England",
  },
  geographicHeatmap: {
    name: "UK Regional Comparison",
    frequency: "withdrawn",
    sources: ["No current comparable regional series"],
    automation: "withdrawn",
    evidenceClass: "derived-analysis",
    geographicCoverage: "United Kingdom — former mixed geographies",
  },
  echoChamberMap: {
    name: "Policy Relationship Matrix",
    frequency: "withdrawn",
    sources: ["No current reproducible survey analysis"],
    automation: "withdrawn",
    evidenceClass: "derived-analysis",
    geographicCoverage: "Great Britain — former derived analysis",
  },
  politicalCompass: {
    name: "Political Compass",
    frequency: "user interaction only",
    sources: ["User responses"],
    automation: "interactive",
    evidenceClass: "user-generated",
    geographicCoverage: "Not geographic",
  },
};