// Declaration for the Election Polling feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "electionPolling",
  slug: "election-polls",
  title: "Primary voting-intention poll publications",
  displayName: "Election Polling",
  description: "Latest verified Great Britain voting-intention polls, shown individually with fieldwork, sample and primary-source links.",
  category: "Politics",
  evidenceClass: "polling",
  geography: { code: "GB", label: "Great Britain" },
  editorial: {
    publicationPeriod: "Latest verified primary pollster publication inside a 14-day evidence window",
    unit: "Published party share (%)",
    revisionStatus: "Individual poll publications are normally final; the site does not revise or average them",
    caveat: "Each poll is shown separately with fieldwork, sample, question or headline method, commissioner, uncertainty and a direct primary source. One poll is not evidence of a durable trend.",
  },
  sources: [
    "yougov-voting-intention",
    "more-in-common-voting-intention",
    "british-polling-council-rules",
  ],
  uiSourceLabels: ["Verified primary pollster publications", "British Polling Council disclosure rules"],
  registry: "feed",
  automation: "automated",
  collectionLayer: "worker",
  retrieval: "scheduled-publication-check",
  cadence: { collect: "daily", publication: "as published", frequency: "as published" },
  // Existing job routing; the single-pipeline replacement is a later task.
  collection: { jobType: "refresh-external-section", collector: "external" },
  validity: {
    retrievalMaxAgeMs: 336 * HOUR_MS,
    freshnessWindow: "Within 14 days of primary publication",
    freshnessRationale: "Each accepted poll retains its original publication date and is withdrawn after 14 days.",
    observationMaxAgeDays: 45,
    extractor: "extract",
  },
  requirement: "required",
  measures: [],
  downloads: { json: true, csv: true, geography: "United Kingdom (check each poll's sample)" },
  releaseTitles: [],
  discovery: {
    title: "UK election polling",
    kind: "dataset",
    sameAs: [
      "https://www.britishpollingcouncil.org/objects-and-rules/",
      "https://yougov.com/en-gb/topics/topic/British_Politics",
    ],
  },
  view: "ElectionPolling",
});
