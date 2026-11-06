// Declaration for the Government Receipts feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "taxRevenue",
  slug: "tax",
  title: "Central government receipts",
  displayName: "Government Receipts",
  description: "Latest central government receipts observation from the ONS public sector finances release.",
  category: "Economy",
  evidenceClass: "official-statistics",
  geography: { code: "UK", label: "United Kingdom" },
  editorial: {
    publicationPeriod: "Latest ONS public-sector-finance bulletin edition",
    unit: "£ billions of central government receipts",
    revisionStatus: "Subject to routine public-finance revisions",
    caveat: "The monthly receipts measure is not a tax-burden ratio, category breakdown, forecast or average-per-person estimate.",
  },
  sources: ["ons-public-sector-finances"],
  uiSourceLabels: ["ONS Public Sector Finances"],
  registry: "feed",
  automation: "automated",
  collectionLayer: "worker",
  retrieval: "scheduled-publication-check",
  cadence: { collect: "daily", publication: "monthly", frequency: "monthly" },
  // Existing job routing; the single-pipeline replacement is a later task.
  collection: { jobType: "refresh-section", collector: "tax-revenue-live" },
  validity: {
    retrievalMaxAgeMs: 36 * HOUR_MS,
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The rolling public-sector-finance bulletin is checked regularly, while its publication period is assessed separately.",
    observationMaxAgeDays: 70,
    extractor: "publishedObservation",
  },
  requirement: "required",
  measures: [
    {
      id: "receipts",
      label: "Central government receipts",
      topic: "Public finances",
      section: "taxRevenue",
      route: "/section/tax/",
      geography: { code: "UK", label: "United Kingdom" },
      unit: "£bn",
      valuePath: "headline.receiptsBillion",
      periodPath: "headline.period",
      publishedPath: "headline.releaseDate",
      historyPath: "history",
      historyValue: "receiptsBillion",
      sourceUrlPath: "source.bulletinUrl",
      cadence: "monthly",
      comparisonKey: "uk-central-government-monthly-receipts-nominal",
      valueStatus: "observed",
      basis: "Nominal central-government receipts on the ONS accounting basis",
      note: "Monthly nominal receipts; not all receipts are taxes. Compare the same month across years to account for seasonality.",
      caveats: ["Nominal monthly flow; not all receipts are taxes."],
    },
  ],
  downloads: { json: true, csv: true, geography: "United Kingdom" },
  releaseTitles: [
    {
      pattern: "^Public sector finances, UK:",
      flags: "i",
      exclude: "time series",
      excludeFlags: "i",
    },
  ],
  discovery: {
    title: "UK government receipts",
    kind: "dataset",
    sameAs: ["https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance"],
  },
  view: "TaxRevenue",
});
