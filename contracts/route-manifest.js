// Derived route manifest and the single page gate. Isomorphic: no Node or DOM
// APIs. Availability decisions come from evidence-policy.routeAccess; this
// module only decides which RouteEntry applies to a path.
//
// The manifest itself is built in feeds/registry.js (routes.json for non-feed
// routes; FEEDS for section and download routes; the catalogue for the rest) and
// re-exported here so existing importers are unchanged.
//
// "Current" for a page gate means the publication decision is "published".
// Clock currentness (validity windows) is still applied to the data itself by
// the snapshot filters, exactly as before; the gate never relaxes it.
import PRODUCT_CAPABILITIES from "../config/product-capabilities.json" with { type: "json" };
import { routeManifest } from "../feeds/registry.js";
import { PUBLICATION_CONFIG, publicationPublished, routeAccess } from "./evidence-policy.js";

/**
 * @typedef {{path:string, kind:"static"|"evidence"|"api", feeds:string[], gate:"none"|"any-published"|"all-of"|"product", capability?:string}} RouteEntry
 * @typedef {{access:"serve"|"unavailable"|"not-found", heldFeeds:string[]}} GateResult
 * @typedef {import("./evidence-policy.js").PublicationConfig} PublicationConfig
 * @typedef {{version:number, capabilities: Record<string, {available:boolean}>}} ProductCapabilityConfig
 */

const PARAM_SEGMENT = /^\[[^/]+\]$/;

/** Query and fragment removed, one leading slash, no trailing slash (root stays "/"). */
function normalizePath(path) {
  const clean = String(path ?? "").split(/[?#]/)[0].replace(/\/+$/, "");
  return clean.startsWith("/") ? clean || "/" : `/${clean}`;
}

function indexFor(config) {
  const manifest = routeManifest(config);
  if (!indexCache.has(manifest)) {
    const exact = new Map();
    const templates = [];
    for (const entry of manifest) {
      const key = normalizePath(entry.path);
      if (key.split("/").some((segment) => PARAM_SEGMENT.test(segment))) templates.push({ segments: key.split("/"), entry });
      else if (!exact.has(key)) exact.set(key, entry);
    }
    indexCache.set(manifest, { exact, templates });
  }
  return indexCache.get(manifest);
}
const indexCache = new WeakMap();

/** @param {string} path @param {PublicationConfig} [config] @returns {RouteEntry|null} */
function matchRoute(path, config = PUBLICATION_CONFIG) {
  const key = normalizePath(path);
  const { exact, templates } = indexFor(config);
  if (exact.has(key)) return exact.get(key);
  const segments = key.split("/");
  for (const template of templates) {
    if (template.segments.length !== segments.length) continue;
    if (template.segments.every((segment, i) => (PARAM_SEGMENT.test(segment) ? Boolean(segments[i]) : segment === segments[i]))) {
      return template.entry;
    }
  }
  return null;
}

/** Evidence gate only: feed verdicts through routeAccess, before any product capability. */
function evidenceGate(entry, now, config) {
  const verdicts = Object.fromEntries(
    entry.feeds.map((id) => [
      id,
      publicationPublished(id, config)
        ? { state: "current", reason: null, validUntil: null }
        : { state: "held", reason: "held", validUntil: null },
    ]),
  );
  return {
    access: routeAccess(entry, now, verdicts),
    heldFeeds: entry.feeds.filter((id) => verdicts[id].state !== "current"),
  };
}

/**
 * @param {string} path
 * @param {Date} [now]
 * @param {{config?: PublicationConfig, capabilities?: ProductCapabilityConfig}} [options]
 * @returns {GateResult}
 */
function gateRouteWith(path, now = new Date(), options = {}) {
  const config = options.config ?? PUBLICATION_CONFIG;
  const capabilities = options.capabilities ?? PRODUCT_CAPABILITIES;
  const entry = matchRoute(path, config);
  if (!entry) return { access: "not-found", heldFeeds: [] };

  const gate = evidenceGate(entry, now, config);
  if (gate.access === "serve" && entry.capability && capabilities?.capabilities?.[entry.capability]?.available !== true) {
    return { access: "unavailable", heldFeeds: gate.heldFeeds };
  }
  return gate;
}

/**
 * True when the route exists and its evidence gate is unavailable, ignoring
 * product capabilities. Pages use it to choose their in-page "held" notice.
 *
 * @param {string} path
 * @param {Date} [now]
 * @param {{config?: PublicationConfig}} [options]
 */
function routeEvidenceHeld(path, now = new Date(), options = {}) {
  const config = options.config ?? PUBLICATION_CONFIG;
  const entry = matchRoute(path, config);
  return entry ? evidenceGate(entry, now, config).access === "unavailable" : false;
}

export { gateRouteWith, matchRoute, normalizePath, routeEvidenceHeld, routeManifest };
