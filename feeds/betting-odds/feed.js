// Declaration for the Political Betting Markets feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "bettingOdds",
  slug: "betting-odds",
  title: "Strict political betting market snapshots",
  displayName: "Political Betting Markets",
  description: "Timestamped UK political market prices with raw reciprocal percentages and clear commercial-market caveats.",
  category: "Politics",
  evidenceClass: "market-signal",
  geography: { code: "UK", label: "United Kingdom" },
  editorial: {
    publicationPeriod: "Latest complete Oddschecker snapshot inside a four-hour observation window",
    unit: "Decimal odds and raw reciprocal percentage",
    revisionStatus: "Continuously repriced rather than statistically revised",
    caveat: "public-data.org shows each named market separately, calculates 100 divided by decimal odds and does not normalize prices to 100%. The results are neither official statistics nor official forecasts. Liquidity, provider coverage, bookmaker margins and market rules affect them; stale, embedded or incomplete prices are unavailable.",
  },
  sources: ["oddschecker-next-pm", "oddschecker-most-seats", "oddschecker-election-year"],
  uiSourceLabels: ["Oddschecker public politics markets"],
  registry: "feed",
  automation: "automated",
  collectionLayer: "worker",
  retrieval: "scheduled-publication-check",
  cadence: {
    collect: "every 3 hours",
    publication: "continuous market repricing",
    frequency: "every 3 hours",
  },
  // Existing job routing; the single-pipeline replacement is a later task.
  collection: { jobType: "refresh-external-section", collector: "external" },
  validity: {
    retrievalMaxAgeMs: 4 * HOUR_MS,
    freshnessWindow: "Within 4 hours of market observation",
    freshnessRationale: "Each observation retains its original time and is withdrawn after four hours. Older prices are never presented as current.",
    retrievalOnly: true,
  },
  requirement: "optional",
  measures: [],
  downloads: { json: true, csv: true, listed: false, geography: "United Kingdom" },
  releaseTitles: [],
  discovery: {
    title: "UK political betting markets",
    kind: "dataset",
    sameAs: ["https://www.oddschecker.com/politics"],
  },
  view: "BettingOdds",
});
