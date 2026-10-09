import PUBLICATION_CONFIG from "../config/publications.json" with { type: "json" };
import PRODUCT_CAPABILITIES from "../config/product-capabilities.json" with { type: "json" };
import definitions from "./measure-definitions.json" with { type: "json" };
import { FEED_CATALOG } from "./source-catalog.js";

const PUBLICATION_STATES = Object.freeze(["published", "held", "retired"]);

/**
 * @typedef {{state:"published"|"held"|"retired", reasonCode:string, reason:string, sections?:string[]}} PublicationDecision
 * @typedef {{version:number, publications: Record<string, PublicationDecision>}} PublicationConfig
 * @typedef {{version:number, capabilities: Record<string, {available:boolean}>}} ProductCapabilityConfig
 */

/** @param {string} id @param {PublicationConfig} config */
function publicationDecision(id, config = PUBLICATION_CONFIG) {
  const decision = config?.publications?.[id];
  if (!decision || !PUBLICATION_STATES.includes(decision.state)) return null;
  return decision;
}

/** @param {string} id @param {PublicationConfig} config */
function publicationState(id, config = PUBLICATION_CONFIG) {
  return publicationDecision(id, config)?.state ?? null;
}

/** @param {string} id @param {PublicationConfig} config */
function publicationPublished(id, config = PUBLICATION_CONFIG) {
  return publicationState(id, config) === "published";
}

/** @param {string} id @param {PublicationConfig} config */
function publicationHeld(id, config = PUBLICATION_CONFIG) {
  return publicationState(id, config) === "held";
}

/** @param {string} id @param {PublicationConfig} config */
function publicationRetired(id, config = PUBLICATION_CONFIG) {
  return publicationState(id, config) === "retired";
}

/** @param {string} id @param {ProductCapabilityConfig} config */
function productCapabilityAvailable(id, config = PRODUCT_CAPABILITIES) {
  return config?.capabilities?.[id]?.available === true;
}

/** @param {PublicationConfig} config */
function anyEvidencePublished(config = PUBLICATION_CONFIG) {
  return Object.keys(FEED_CATALOG).some((id) => publicationPublished(id, config));
}

/** @param {string} id @param {PublicationConfig} config */
function sectionPublication(id, config = PUBLICATION_CONFIG) {
  return Object.entries(config.publications ?? {}).find(([, entry]) => entry.sections?.includes(id))?.[0] ?? "";
}

/**
 * Route existence is deliberately separate from evidence publication.
 * Generic products are governed by product capabilities; evidence-bearing
 * routes additionally require the relevant publication decision.
 *
 * @param {string} path
 * @param {PublicationConfig} publicationConfig
 * @param {ProductCapabilityConfig} capabilityConfig
 */
function publicRouteAvailable(
  path,
  publicationConfig = PUBLICATION_CONFIG,
  capabilityConfig = PRODUCT_CAPABILITIES,
) {
  const pathname = path.split("?")[0].replace(/\/$/, "");
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) return productCapabilityAvailable("home", capabilityConfig);
  if (parts[0] === "section") {
    return publicationPublished(sectionPublication(parts[1], publicationConfig), publicationConfig);
  }
  if (parts[0] === "money") {
    return productCapabilityAvailable("publicMoney", capabilityConfig) &&
      publicationPublished("governmentContracts", publicationConfig);
  }
  if (parts[0] === "editions") {
    return productCapabilityAvailable("editionArchive", capabilityConfig) &&
      publicationPublished("editionArchive", publicationConfig);
  }
  if (parts[0] === "stories") {
    const publicationId = {
      "household-budgets": "storyHouseholdBudgets",
      "public-finances": "storyPublicFinances",
    }[parts[1]] ?? "";
    return productCapabilityAvailable(publicationId, capabilityConfig) &&
      publicationPublished(publicationId, publicationConfig);
  }
  if (parts[0] === "measure" && parts[1]) {
    return publicationPublished(
      definitions.measures.find((entry) => entry.id === parts[1])?.section ?? "",
      publicationConfig,
    );
  }
  if (parts[0] === "sources" && parts[1]) {
    return productCapabilityAvailable("sources", capabilityConfig) &&
      publicationPublished(parts[1], publicationConfig);
  }
  if (parts[0] === "calendar") {
    return productCapabilityAvailable("calendar", capabilityConfig) &&
      (
        publicationPublished("releaseCalendar", publicationConfig) ||
        publicationPublished("nhsReleaseCalendar", publicationConfig)
      );
  }

  const genericCapability = {
    explore: "explore",
    measure: "measureLibrary",
    compare: "compare",
    briefing: "briefing",
    "cost-of-living": "costOfLiving",
    sources: "sources",
  }[parts[0]];

  return genericCapability
    ? productCapabilityAvailable(genericCapability, capabilityConfig)
    : true;
}

/** @param {any} catalog @param {PublicationConfig} config */
function filterPublicationCatalog(catalog, config = PUBLICATION_CONFIG) {
  if (!catalog?.measures) return null;
  return {
    ...catalog,
    measures: Object.fromEntries(
      Object.entries(catalog.measures).filter(([, measure]) => publicationPublished(measure.sourceId, config)),
    ),
  };
}

/** @param {any} summary @param {PublicationConfig} config @param {any} catalog */
function filterPublicationSummary(summary, config = PUBLICATION_CONFIG, catalog = null) {
  const changes = (summary?.changes ?? []).filter((change) =>
    publicationPublished(
      catalog?.measures?.[change.measureId]?.sourceId ??
        definitions.measures.find((measure) => measure.id === change.measureId)?.section ??
        "",
      config,
    )
  );
  return {
    id: summary.id,
    publishedAt: summary.publishedAt,
    ...(summary.asOf ? { asOf: summary.asOf } : {}),
    ...(summary.previousEditionId !== undefined ? { previousEditionId: summary.previousEditionId } : {}),
    ...(changes.length === summary.changes?.length && summary.summaryCorrection
      ? { summaryCorrection: summary.summaryCorrection }
      : {}),
    sourceEditionIds: [...new Set(changes.map((change) => change.nextSourceEditionId))],
    changes,
  };
}

/** @param {any} input @param {PublicationConfig} config */
function filterPublicationSnapshot(input, config = PUBLICATION_CONFIG) {
  if (!input?.meta?.sources) return null;
  const sources = Object.fromEntries(
    Object.entries(input.meta.sources).filter(([id]) => publicationPublished(id, config)),
  );
  if (Object.keys(sources).length === 0) return null;

  const publishedSections = Object.keys(sources).sort();
  const snapshot = {
    meta: {
      registryVersion: input.meta.registryVersion,
      generatedAt: input.meta.generatedAt,
      sources,
      verifiedSections: (input.meta.verifiedSections ?? []).filter((id) => Object.hasOwn(sources, id)),
      measureCatalog: filterPublicationCatalog(input.meta.measureCatalog, config),
      publicProjection: {
        state: "published",
        publishedSections,
      },
      ...(publicationPublished("editionArchive", config) && input.meta.editionSummary
        ? { editionSummary: filterPublicationSummary(input.meta.editionSummary, config, input.meta.measureCatalog) }
        : {}),
    },
  };
  for (const id of publishedSections) {
    if (Object.hasOwn(input, id)) snapshot[id] = structuredClone(input[id]);
  }
  return snapshot;
}

export {
  PRODUCT_CAPABILITIES,
  PUBLICATION_CONFIG,
  PUBLICATION_STATES,
  anyEvidencePublished,
  filterPublicationCatalog,
  filterPublicationSnapshot,
  filterPublicationSummary,
  productCapabilityAvailable,
  publicRouteAvailable,
  publicationDecision,
  publicationHeld,
  publicationPublished,
  publicationRetired,
  publicationState,
  sectionPublication,
};
