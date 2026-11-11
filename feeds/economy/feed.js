// Declaration for the Key Economic Indicators feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "sentimentPulse",
  slug: "economy",
  title: "Series-level economic indicators",
  displayName: "Key Economic Indicators",
  description: "Latest CPI inflation and unemployment evidence, each retaining its own period and publication date.",
  category: "Economy",
  evidenceClass: "official-statistics",
  geography: { code: "UK", label: "United Kingdom" },
  editorial: {
    publicationPeriod: "Separate latest periods for CPI and unemployment",
    unit: "Percentage for each named series",
    revisionStatus: "CPI and Labour Force Survey estimates may be revised",
    caveat: "CPI is monthly and unemployment is a rolling three-month estimate. Their observation periods, publication dates, check dates and revision status stay separate.",
  },
  sources: ["ons-cpi-d7g7", "ons-unemployment-mgsx"],
  registry: "feed",
  automation: "automated",
  collectionLayer: "worker",
  retrieval: "scheduled-publication-check",
  cadence: {
    collect: "daily",
    publication: "series-specific: monthly",
    frequency: "series-specific",
  },
  // Existing job routing; the single-pipeline replacement is a later task.
  collection: { jobType: "refresh-section", collector: "section-builder" },
  validity: {
    retrievalMaxAgeMs: 36 * HOUR_MS,
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "CPI and unemployment keep separate observation periods, publication dates and revision status.",
    observationMaxAgeDays: 75,
    extractor: "extract",
  },
  requirement: "required",
  measures: [
    {
      id: "inflation",
      label: "CPI inflation",
      topic: "Economy",
      section: "sentimentPulse",
      route: "/section/economy/",
      geography: { code: "UK", label: "United Kingdom" },
      unit: "%",
      valuePath: "series.inflation.value",
      periodPath: "series.inflation.period",
      publishedPath: "series.inflation.publishedAt",
      historyPath: "series.inflation.history",
      historyValue: "value",
      sourceUrlPath: "series.inflation.sourceUrl",
      validityPath: "__measureValidity.inflation.validUntil",
      cadence: "monthly",
      comparisonKey: "uk-cpi-annual-inflation",
      valueStatus: "observed",
      basis: "Annual change in the Consumer Prices Index",
      note: "Lower inflation means prices rise more slowly, not that they have fallen.",
      caveats: ["CPI does not describe every household's personal inflation rate."],
    },
  ],
  downloads: { json: true, csv: true, geography: "United Kingdom (check each series)" },
  releaseTitles: [
    // The CPI bulletin follows the "inflation" family, which names no feed of its own.
    { pattern: "^Consumer price inflation, UK:", flags: "i", exclude: "time series", excludeFlags: "i", familyIds: ["inflation"] },
  ],
  discovery: {
    title: "UK inflation and unemployment",
    kind: "dataset",
    sameAs: [
      "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
      "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
    ],
  },
  view: "SentimentPulse",
});
