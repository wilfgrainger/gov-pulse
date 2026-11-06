// Declaration for the NHS Referral to Treatment feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "nhsStats",
  slug: "nhs",
  title: "Referral-to-treatment waiting times",
  displayName: "NHS Referral to Treatment",
  description: "Latest NHS England referral-to-treatment waiting-list evidence, including the publication period and direct source.",
  category: "Society",
  evidenceClass: "administrative-data",
  geography: { code: "ENG", label: "England" },
  editorial: {
    publicationPeriod: "Latest verified NHS England referral-to-treatment month",
    unit: "Incomplete pathways, weeks or percentage, as labelled",
    revisionStatus: "NHS England may revise provider submissions, usually through periodic revision releases",
    caveat: "The headline counts consultant-led pathways rather than unique people. National figures include estimates for non-reporting acute trusts, while treatment-function rows exclude those estimates.",
  },
  sources: ["nhs-england-rtt"],
  registry: "feed",
  automation: "automated",
  collectionLayer: "worker",
  retrieval: "scheduled-publication-check",
  cadence: { collect: "daily", publication: "monthly", frequency: "monthly" },
  // Existing job routing; the single-pipeline replacement is a later task.
  collection: { jobType: "refresh-external-section", collector: "external" },
  validity: {
    retrievalMaxAgeMs: 1080 * HOUR_MS,
    freshnessWindow: "Within 45 days of primary publication",
    freshnessRationale: "Each accepted RTT publication retains its NHS England publication date and is withdrawn after 45 days.",
    observationMaxAgeDays: 45,
    extractor: "nhsPublishedObservation",
  },
  requirement: "required",
  measures: [
    {
      id: "waitingPathwaysEstimate",
      label: "NHS waiting list",
      topic: "Health",
      section: "nhsStats",
      route: "/section/nhs/",
      geography: { code: "ENG", label: "England" },
      unit: "pathways",
      valuePath: "headline.waitingPathwaysEstimate",
      periodPath: "headline.period",
      publishedPath: "headline.publicationDate",
      historyPath: "history",
      historyValue: "waitingPathwaysEstimate",
      sourceUrlPath: "source.bulletinUrl",
      cadence: "monthly",
      comparisonKey: "england-nhs-rtt-waiting-pathways",
      valueStatus: "estimate",
      basis: "Referral-to-treatment waiting pathways, not unique people",
      note: "NHS England referral-to-treatment pathways; a person can wait on more than one pathway.",
      caveats: ["A person can wait on more than one pathway."],
    },
  ],
  downloads: { json: true, csv: true, geography: "England" },
  releaseTitles: [],
  discovery: {
    title: "NHS waiting times in England",
    kind: "dataset",
    sameAs: ["https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/"],
  },
  view: "NHSStats",
});
