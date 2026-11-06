// Declaration for the Release Calendar feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "releaseCalendar",
  slug: "release-calendar",
  title: "Official release calendar",
  displayName: "Release Calendar",
  evidenceClass: "administrative-data",
  legacyEvidenceClass: "official-publication-schedule",
  geography: { code: "UK", label: "United Kingdom" },
  sources: ["ons-release-calendar"],
  registry: "publication",
  automation: "automated",
  collectionLayer: "publication",
  retrieval: "scheduled-publication-check",
  cadence: { collect: "daily", publication: "publisher-announced dates", frequency: "daily" },
  // Existing job routing; the single-pipeline replacement is a later task.
  collection: { jobType: "refresh-external-section", collector: "external" },
  validity: {
    retrievalMaxAgeMs: 36 * HOUR_MS,
    retrievalOnly: true,
  },
  requirement: "optional",
  measures: [],
  downloads: { json: false, csv: false, geography: "United Kingdom" },
  releaseTitles: [],
});
