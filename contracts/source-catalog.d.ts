import type { EvidenceClass, SourceDefinition } from "./evidence-domain.js";

export type CatalogSource = Readonly<SourceDefinition> & {
  sourceClass: string;
  seriesId?: string;
  datasetId?: string;
};

export type FeedAutomation = "automated" | "static" | "interactive" | "withdrawn";
export type FeedRegistryKind = "feed" | "publication" | null;
export type PublicationRequirement = "required" | "optional" | "independent";

export type FeedEditorial = {
  publicationPeriod: string;
  unit: string;
  revisionStatus: string;
  caveat: string;
};

export type FeedDefinition = {
  id: string;
  registry: FeedRegistryKind;
  title: string;
  displayName: string;
  evidenceClass: EvidenceClass;
  legacyEvidenceClass?: string;
  uiEvidenceClass?: string;
  geography: { code: string; label: string };
  sourceIds: readonly string[];
  runtimeSourceIds?: readonly string[];
  automation: FeedAutomation;
  collectionLayer: "worker" | "publication";
  frequency: string;
  retrieval?: string;
  refreshCadence?: string;
  publicationCadence?: string;
  retrievalMaxAgeMs?: number;
  publicationRequirement?: PublicationRequirement;
  freshnessWindow?: string;
  freshnessRationale?: string;
  uiSourceLabels?: readonly string[];
  editorial?: FeedEditorial;
};

export type SourceLink = {
  sourceId: string;
  publisher: string;
  label: string;
  url: string;
};

export const SOURCE_CATALOG_VERSION: string;
export const SOURCE_CATALOG: Readonly<Record<string, CatalogSource>>;
export const FEED_CATALOG: Readonly<Record<string, Readonly<FeedDefinition>>>;

export function sourceFor(id: string): CatalogSource | null;
export function feedFor(id: string): Readonly<FeedDefinition> | null;
export function sourcesForFeed(id: string): CatalogSource[];
export function sourceLinksForFeed(id: string): SourceLink[];
export function uiEvidenceClassForFeed(id: string): string | null;
export function uiSourceLabelsForFeed(id: string): string[];
export function legacyUpstreamsForFeed(id: string): Array<{
  publisher: string;
  label: string;
  url: string;
  sourceClass: string;
  seriesId?: string;
  datasetId?: string;
  caveat?: string;
}>;
export function legacyRegistryEntry(id: string): Record<string, unknown> | null;
export function legacyDataSourceDefinition(id: string): Record<string, unknown> | null;
export function legacyDataSourceDetail(id: string): FeedEditorial | null;
