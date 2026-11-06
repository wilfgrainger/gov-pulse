// Compatibility re-export. The registry views are owned by feeds/registry.js;
// this shim is deleted by Task 17a. New code imports from feeds/registry.js.
export {
  FEED_REGISTRY,
  FEED_REGISTRY_VERSION,
  OPTIONAL_PUBLISHED_SECTION_IDS,
  PUBLICATION_SOURCE_REGISTRY,
  REQUIRED_PUBLISHED_SECTION_IDS,
  applyFeedRegistry,
  provenanceFor,
  registrySnapshot,
  retrievalMaxAgeMsForSection,
} from "../feeds/registry.js";
