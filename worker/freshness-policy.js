import { FEED_REGISTRY } from "./feed-registry.js";

// Compatibility export for older source-specific wrappers. Runtime freshness
// ownership lives in feed-registry.js and is projected into seconds here.
export const SECTION_FRESH_TTL_SECONDS = Object.freeze(
  Object.fromEntries(
    Object.entries(FEED_REGISTRY).map(([section, definition]) => [
      section,
      Math.floor(definition.retrievalMaxAgeMs / 1000),
    ])
  )
);

export function applyFreshnessPolicy(descriptors) {
  if (!descriptors || typeof descriptors !== "object" || Array.isArray(descriptors)) {
    throw new Error("Worker descriptors must be an object");
  }

  const policySections = Object.keys(SECTION_FRESH_TTL_SECONDS);
  const descriptorSections = Object.keys(descriptors);

  for (const section of policySections) {
    if (!descriptors[section]) {
      throw new Error(`Freshness policy references unknown section '${section}'`);
    }
  }

  for (const section of descriptorSections) {
    if (!(section in SECTION_FRESH_TTL_SECONDS)) {
      throw new Error(`Worker section '${section}' is missing a freshness policy`);
    }
  }

  for (const [section, freshTtlSeconds] of Object.entries(SECTION_FRESH_TTL_SECONDS)) {
    descriptors[section].freshTtlSeconds = freshTtlSeconds;
  }

  return descriptors;
}
