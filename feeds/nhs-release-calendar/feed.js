// Declaration for the NHS Release Calendar feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "nhsReleaseCalendar",
  slug: "nhs-release-calendar",
  title: "NHS England RTT release schedule",
  displayName: "NHS Release Calendar",
  evidenceClass: "administrative-data",
  legacyEvidenceClass: "official-publication-schedule",
  geography: { code: "ENG", label: "England" },
  sources: ["nhs-release-calendar"],
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
  downloads: { json: false, csv: false, geography: "England" },
  releaseTitles: [],
});
