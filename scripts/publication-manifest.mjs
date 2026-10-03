import {
  OPTIONAL_PUBLISHED_SECTION_IDS,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../worker/feed-registry.js";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";

export function currentPublicationManifest(snapshot, now = new Date()) {
  const currentSnapshot = filterCurrentSnapshot(snapshot, now);
  const currentSections = new Set(
    Object.keys(currentSnapshot?.meta?.sources ?? {})
  );
  const missingRequiredSections = REQUIRED_PUBLISHED_SECTION_IDS
    .filter((section) => !currentSections.has(section))
    .sort();
  const unavailableOptionalSections = OPTIONAL_PUBLISHED_SECTION_IDS
    .filter((section) => !currentSections.has(section))
    .sort();

  return {
    currentSnapshot,
    missingRequiredSections,
    unavailableOptionalSections,
  };
}
