import discovery from "@/contracts/section-discovery.json";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import { DATA_SOURCES } from "@/app/lib/config";
import { isCompatibleMetricsSnapshot, type MetricsSnapshot } from "@/app/lib/metricsSnapshot";
import { publicSnapshot } from "@/worker/public-snapshot";
import { publicationPublished, filterPublicationSnapshot } from "@/contracts/publication-policy";

export type DiscoveryKind = "dataset" | "tool" | "withdrawn";

export interface SectionDiscovery {
  title: string;
  description: string;
  category: string;
  kind: DiscoveryKind;
  sourceKey: string;
  sameAs: string[];
}

const EXTRA_SECTION_DISCOVERY: Record<string, SectionDiscovery> = {
  "uk-in-context": {
    title: "UK in context",
    description:
      "Compare UK government debt, overseas aid, defence, public social spending, total healthcare spending, tax revenue and debt interest per resident across a fixed 13-country group.",
    category: "Public money",
    kind: "dataset",
    sourceKey: "internationalComparison",
    sameAs: [
      "https://www.imf.org/external/datamapper/datasets/WEO",
      "https://www.oecd.org/en/data/datasets/social-expenditure-database-socx.html",
      "https://www.sipri.org/databases/milex",
      "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/current-health-expenditure-%28che%29-per-capita-in-us%24",
    ],
  },
};

export const SITE_DISCOVERY = discovery.site;
export const SECTION_DISCOVERY = {
  ...(discovery.sections as Record<string, SectionDiscovery>),
  ...EXTRA_SECTION_DISCOVERY,
};
export const PUBLIC_SECTION_IDS = Object.keys(SECTION_DISCOVERY);

export function sectionPath(id: string) {
  return `/section/${id}/`;
}

export function socialImagePath(id: string) {
  return id === "uk-in-context" ? "/social/home.svg" : `/social/${id}.svg`;
}

export function absoluteUrl(path: string) {
  return new URL(path, SITE_DISCOVERY.origin).toString();
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function getBuildPublication(section: SectionDiscovery, rawSnapshot: unknown = BUILD_METRICS_SNAPSHOT) {
  if (!publicationPublished(section.sourceKey)) return null;
  const snapshot = filterPublicationSnapshot(publicSnapshot(rawSnapshot));
  if (!isCompatibleMetricsSnapshot(snapshot)) {
    return null;
  }

  const typedSnapshot = snapshot as MetricsSnapshot;
  const source = typedSnapshot.meta.sources[section.sourceKey];
  const data = typedSnapshot[section.sourceKey];
  if (!source || source.status !== "ok" || !data) {
    return null;
  }

  const observation =
    typeof data === "object" && !Array.isArray(data)
      ? (data as { __observation?: { period?: unknown; observedAt?: unknown; status?: unknown } }).__observation
      : undefined;
  const measureRecords = Object.values(typedSnapshot.meta.measureCatalog?.measures ?? {})
    .filter((measure) => measure.sourceId === section.sourceKey)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  const latestMeasure = measureRecords[0];
  const rawData = data && typeof data === "object" && !Array.isArray(data)
    ? data as {
      headline?: { releaseDate?: unknown };
      latestPublicationDate?: unknown;
      publicationDate?: unknown;
      publishedAt?: unknown;
      awards?: unknown;
    }
    : {};
  const normalizeDate = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  };
  const contractNoticeDates = Array.isArray(rawData.awards)
    ? rawData.awards
      .map((award) => award && typeof award === "object" && !Array.isArray(award)
        ? normalizeDate((award as { publishedAt?: unknown }).publishedAt)
        : undefined)
      .filter((date): date is string => Boolean(date))
      .sort()
    : [];
  const publisherPublishedAt = [
    latestMeasure?.publishedAt,
    rawData.publishedAt,
    rawData.latestPublicationDate,
    rawData.publicationDate,
    rawData.headline?.releaseDate,
    contractNoticeDates.at(-1),
  ].map(normalizeDate).find((date): date is string => Boolean(date));

  return {
    dateModified: publisherPublishedAt,
    temporalCoverage:
      typeof observation?.period === "string" && observation.period.trim()
        ? observation.period.trim()
        : latestMeasure?.observationPeriod.label,
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

  if (section.sourceKey === "internationalComparison") {
    return {
      ...common,
      "@type": "Dataset",
      spatialCoverage: "International comparison centred on the United Kingdom",
      sameAs: section.sameAs,
      measurementTechnique:
        "Source-specific per-resident comparison with per-measure country coverage and provenance",
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

export function publicationEntries(rawSnapshot: unknown = BUILD_METRICS_SNAPSHOT) {
  return Object.entries(SECTION_DISCOVERY)
    .filter(([, section]) => section.kind === "dataset")
    .map(([id, section]) => ({
      id,
      ...section,
      path: sectionPath(id),
      publication: getBuildPublication(section, rawSnapshot),
    }))
    .filter((entry) => entry.publication);
}
