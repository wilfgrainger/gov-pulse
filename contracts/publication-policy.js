import PRODUCT_CAPABILITIES from "../config/product-capabilities.json" with { type: "json" };
import { FEED_CATALOG } from "./source-catalog.js";
import { PUBLICATION_CONFIG, publicationPublished } from "./evidence-policy.js";

/**
 * @typedef {import("./evidence-policy.js").PublicationConfig} PublicationConfig
 * @typedef {{version:number, capabilities: Record<string, {available:boolean}>}} ProductCapabilityConfig
 */

// Publication decisions and snapshot projection live in evidence-policy.js;
// route availability is derived in route-manifest.js (gateRoute).
/** @param {string} id @param {ProductCapabilityConfig} config */
function productCapabilityAvailable(id, config = PRODUCT_CAPABILITIES) {
  return config?.capabilities?.[id]?.available === true;
}

/** @param {PublicationConfig} config */
function anyEvidencePublished(config = PUBLICATION_CONFIG) {
  return Object.keys(FEED_CATALOG).some((id) => publicationPublished(id, config));
}

/** @param {PublicationConfig} config */
function anyPublicationEnabled(config = PUBLICATION_CONFIG) {
  return Object.keys(config.publications ?? {}).some((id) => publicationPublished(id, config));
}

// The sections the cost-of-living lens reads: prices, house prices and earnings.
const COST_OF_LIVING_SECTIONS = Object.freeze(["sentimentPulse", "housePriceIndex", "realWages"]);

/** @param {PublicationConfig} config */
function costOfLivingEvidencePublished(config = PUBLICATION_CONFIG) {
  return COST_OF_LIVING_SECTIONS.some((id) => publicationPublished(id, config));
}

/** @param {string} id @param {PublicationConfig} config */
function sectionPublication(id, config = PUBLICATION_CONFIG) {
  return Object.entries(config.publications ?? {}).find(([, entry]) => entry.sections?.includes(id))?.[0] ?? "";
}

export {
  PRODUCT_CAPABILITIES,
  anyEvidencePublished,
  anyPublicationEnabled,
  costOfLivingEvidencePublished,
  productCapabilityAvailable,
  sectionPublication,
};
