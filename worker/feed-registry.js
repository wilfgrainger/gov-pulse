import {
  FEED_CATALOG,
  legacyRegistryEntry,
} from "../contracts/source-catalog.js";

export const FEED_REGISTRY_VERSION = "2026-08-02.1";

function registry(kind) {
  return Object.freeze(Object.fromEntries(
    Object.values(FEED_CATALOG)
      .filter((feed) => feed.registry === kind)
      .map((feed) => [feed.id, Object.freeze(legacyRegistryEntry(feed.id))])
  ));
}

// Compatibility projections for the existing Worker publication path.
// Source identity, publisher URLs, cadence, geography and caveats are owned by
// contracts/source-catalog.js and must not be re-declared here.
export const FEED_REGISTRY = registry("feed");
export const PUBLICATION_SOURCE_REGISTRY = registry("publication");

export function retrievalMaxAgeMsForSection(section) {
  return (
    FEED_REGISTRY[section]?.retrievalMaxAgeMs ??
    PUBLICATION_SOURCE_REGISTRY[section]?.retrievalMaxAgeMs ??
    null
  );
}

export function registrySnapshot() {
  return {
    version: FEED_REGISTRY_VERSION,
    feeds: FEED_REGISTRY,
  };
}

export const REQUIRED_PUBLISHED_SECTION_IDS = Object.freeze(
  Object.values(FEED_REGISTRY)
    .filter((feed) => feed.publicationRequirement !== "optional")
    .map((feed) => feed.section)
);

export const OPTIONAL_PUBLISHED_SECTION_IDS = Object.freeze(
  [
    ...Object.values(FEED_REGISTRY),
    ...Object.values(PUBLICATION_SOURCE_REGISTRY),
  ]
    .filter((feed) => feed.publicationRequirement === "optional")
    .map((feed) => feed.section)
);

export function provenanceFor(section) {
  const feed = FEED_REGISTRY[section] ?? PUBLICATION_SOURCE_REGISTRY[section];
  if (!feed) return null;
  return {
    registryVersion: FEED_REGISTRY_VERSION,
    section: feed.section,
    title: feed.title,
    evidenceClass: feed.evidenceClass,
    geography: feed.geography,
    retrieval: feed.retrieval,
    refreshCadence: feed.refreshCadence,
    publicationCadence: feed.publicationCadence,
    operationalStatus: feed.operationalStatus,
    publicationRequirement: feed.publicationRequirement ?? "required",
    upstreams: feed.upstreams,
  };
}

export function applyFeedRegistry(descriptors) {
  const descriptorKeys = Object.keys(descriptors).sort();
  const registryKeys = Object.keys(FEED_REGISTRY).sort();
  if (JSON.stringify(descriptorKeys) !== JSON.stringify(registryKeys)) {
    throw new Error(
      `Feed registry mismatch: descriptors=${descriptorKeys.join(",")} registry=${registryKeys.join(",")}`
    );
  }

  for (const [section, descriptor] of Object.entries(descriptors)) {
    const feed = FEED_REGISTRY[section];
    descriptor.source = feed.upstreams.map((upstream) => upstream.label).join(" + ");
    descriptor.registry = provenanceFor(section);
  }

  return descriptors;
}
