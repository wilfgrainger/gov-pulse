import discovery from "@/contracts/section-discovery.json";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import { DATA_SOURCES } from "@/app/lib/config";
import { isCompatibleMetricsSnapshot, type MetricsSnapshot } from "@/app/lib/metricsSnapshot";

export type DiscoveryKind = "dataset" | "tool" | "withdrawn";

export interface SectionDiscovery {
  title: string;
  description: string;
  category: string;
  kind: DiscoveryKind;
  sourceKey: string;
  sameAs: string[];
}

export const SITE_DISCOVERY = discovery.site;
export const SECTION_DISCOVERY = discovery.sections as Record<string, SectionDiscovery>;
export const PUBLIC_SECTION_IDS = Object.keys(SECTION_DISCOVERY);

export function sectionPath(id: string) {
  return `/section/${id}/`;
}

export function socialImagePath(id: string) {
  return `/social/${id}.svg`;
}

export function absoluteUrl(path: string) {
  return new URL(path, SITE_DISCOVERY.origin).toString();
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function getBuildPublication(section: SectionDiscovery) {
  if (!isCompatibleMetricsSnapshot(BUILD_METRICS_SNAPSHOT)) {
    return null;
  }

  const snapshot = BUILD_METRICS_SNAPSHOT as MetricsSnapshot;
  const source = snapshot.meta.sources[section.sourceKey];
  const data = snapshot[section.sourceKey];
  if (!source || source.status !== "ok" || !data) {
    return null;
  }

  const observation =
    typeof data === "object" && !Array.isArray(data)
      ? (data as { __observation?: { period?: unknown; observedAt?: unknown; status?: unknown } }).__observation
      : undefined;

  return {
    dateModified:
      typeof snapshot.meta.generatedAt === "string"
        ? snapshot.meta.generatedAt
        : undefined,
    temporalCoverage:
      typeof observation?.period === "string" && observation.period.trim()
        ? observation.period.trim()
        : undefined,
    observationStatus:
      typeof observation?.status === "string" ? observation.status : undefined,
  };
}

export function structuredDataForSection(id: string) {
  const section = SECTION_DISCOVERY[id];
  if (!section) return null;

  const url = absoluteUrl(sectionPath(id));
  const common = {
    "@context": "https://schema.org",
    name: section.title,
    description: section.description,
    url,
    isAccessibleForFree: true,
    creator: {
      "@type": "Organization",
      name: SITE_DISCOVERY.name,
      url: SITE_DISCOVERY.origin,
    },
  };

  if (section.kind === "tool") {
    return {
      ...common,
      "@type": "WebApplication",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any",
    };
  }

  if (section.kind === "withdrawn") {
    return {
      ...common,
      "@type": "Article",
      articleSection: section.category,
    };
  }

  const publication = getBuildPublication(section);
  const source = DATA_SOURCES[section.sourceKey];

  return {
    ...common,
    "@type": "Dataset",
    license: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    spatialCoverage: source?.geographicCoverage,
    temporalCoverage: publication?.temporalCoverage,
    dateModified: publication?.dateModified,
    sameAs: section.sameAs,
    measurementTechnique: source?.evidenceClass,
  };
}

export function publicationEntries() {
  return Object.entries(SECTION_DISCOVERY)
    .filter(([, section]) => section.kind === "dataset")
    .map(([id, section]) => ({
      id,
      ...section,
      path: sectionPath(id),
      publication: getBuildPublication(section),
    }))
    .filter((entry) => entry.publication);
}
