import PRODUCT_CAPABILITIES from "../config/product-capabilities.json" with { type: "json" };
import definitions from "./measure-definitions.json" with { type: "json" };
import { FEED_CATALOG } from "./source-catalog.js";
import {
  PUBLICATION_CONFIG,
  PUBLICATION_STATES,
  filterPublicationCatalog,
  filterPublicationSnapshot,
  filterPublicationSummary,
  publicationDecision,
  publicationHeld,
  publicationPublished,
  publicationRetired,
  publicationState,
} from "./evidence-policy.js";

const NON_SOURCE_PUBLICATION_IDS = new Set([
  "editionArchive",
  "storyHouseholdBudgets",
  "storyPublicFinances",
]);

/**
 * @typedef {import("./evidence-policy.js").PublicationConfig} PublicationConfig
 * @typedef {{version:number, capabilities: Record<string, {available:boolean}>}} ProductCapabilityConfig
 */

// Publication decisions and snapshot projection live in evidence-policy.js;
// this module keeps route availability and the compatibility exports.
/** @param {string} id @param {ProductCapabilityConfig} config */
function productCapabilityAvailable(id, config = PRODUCT_CAPABILITIES) {
  return config?.capabilities?.[id]?.available === true;
}

/** @param {PublicationConfig} config */
function anyEvidencePublished(config = PUBLICATION_CONFIG) {
  return Object.keys(FEED_CATALOG).some((id) => publicationPublished(id, config));
}

/** @param {string} id @param {PublicationConfig} config */
function publicationEnabled(id, config = PUBLICATION_CONFIG) {
  return publicationPublished(id, config);
}

/** @param {PublicationConfig} config */
function anyPublicationEnabled(config = PUBLICATION_CONFIG) {
  return Object.keys(config.publications ?? {}).some((id) => publicationPublished(id, config));
}

/** @param {PublicationConfig} config */
function anyEvidenceSourceEnabled(config = PUBLICATION_CONFIG) {
  return Object.entries(config.publications ?? {}).some(
    ([id, entry]) => !NON_SOURCE_PUBLICATION_IDS.has(id) && publicationPublished(id, config),
  );
}

/** @param {string} path @param {PublicationConfig} config */
function publicationRouteEnabled(path, config = PUBLICATION_CONFIG) {
  const pathname = path.split("?")[0].replace(/\/$/, "");
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "section") {
    return publicationPublished(sectionPublication(parts[1], config), config);
  }
  if (parts[0] === "money") return publicationPublished("governmentContracts", config);
  if (parts[0] === "editions") return publicationPublished("editionArchive", config);
  if (parts[0] === "stories") {
    return publicationPublished(
      {
        "household-budgets": "storyHouseholdBudgets",
        "public-finances": "storyPublicFinances",
      }[parts[1]] ?? "",
      config,
    );
  }
  if (parts[0] === "measure" && parts[1]) {
    return publicationPublished(
      definitions.measures.find((entry) => entry.id === parts[1])?.section ?? "",
      config,
    );
  }
  if (parts[0] === "sources" && parts[1]) {
    return publicationPublished(parts[1], config);
  }
  if (parts[0] === "calendar") {
    return (
      publicationPublished("releaseCalendar", config) ||
      publicationPublished("nhsReleaseCalendar", config)
    );
  }
  if (
    ["explore", "measure", "compare", "briefing", "cost-of-living", "sources"].includes(parts[0]) ||
    parts.length === 0
  ) {
    return anyEvidenceSourceEnabled(config);
  }
  return true;
}

/**
 * Whether the application has a reader-facing route for this path.
 *
 * Held datasets can still expose methodology, search and calendar pages; the
 * publication policy controls whether evidence values are returned.
 *
 * @param {string} path
 * @param {PublicationConfig} config
 */
function productRouteAvailable(path, config = PUBLICATION_CONFIG) {
  const pathname = path.split("?")[0].replace(/\/$/, "");
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return true;
  if (parts[0] === "feed.xml") return true;
  if (parts[0] === "section") {
    return Boolean(parts[1] && sectionPublication(parts[1], config));
  }
  if (parts[0] === "sources" && parts[1]) {
    return Object.hasOwn(config.publications ?? {}, parts[1]);
  }
  if (parts[0] === "measure" && parts[1]) {
    return definitions.measures.some((entry) => entry.id === parts[1]);
  }
  if (parts[0] === "editions") return publicationPublished("editionArchive", config);
  if (parts[0] === "stories") return publicationRouteEnabled(path, config);
  if (
    ["explore", "measure", "compare", "briefing", "cost-of-living", "sources", "calendar", "money"].includes(
      parts[0],
    ) &&
    parts.length === 1
  ) {
    return true;
  }
  return false;
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

export {
  PRODUCT_CAPABILITIES,
  PUBLICATION_CONFIG,
  PUBLICATION_STATES,
  anyEvidencePublished,
  anyEvidenceSourceEnabled,
  anyPublicationEnabled,
  filterPublicationCatalog,
  filterPublicationSnapshot,
  filterPublicationSummary,
  productCapabilityAvailable,
  productRouteAvailable,
  publicRouteAvailable,
  publicationDecision,
  publicationEnabled,
  publicationHeld,
  publicationPublished,
  publicationRetired,
  publicationRouteEnabled,
  publicationState,
  sectionPublication,
};
