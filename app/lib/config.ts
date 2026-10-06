import {
  FEED_CATALOG,
  legacyDataSourceDefinition,
} from "@/contracts/source-catalog.js";

// The browser uses one same-origin, schema-checked snapshot path.
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

const applicationFeedIds = Object.values(FEED_CATALOG)
  .filter((feed) => Boolean(feed.editorial))
  .map((feed) => feed.id);

export const DATA_SOURCES = Object.freeze(Object.fromEntries(
  applicationFeedIds.map((id) => [
    id,
    legacyDataSourceDefinition(id) as unknown as DataSourceDefinition,
  ])
)) as Readonly<Record<string, DataSourceDefinition>>;

export const INTERACTIVE_ONLY_SECTIONS = Object.freeze(
  applicationFeedIds.filter((id) => FEED_CATALOG[id]?.automation === "interactive")
);
