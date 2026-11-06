// Declaration for the real wages feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

const BULLETIN_LATEST =
  "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/latest";

// Key order matches contracts/measure-definitions.json so --write is byte-stable.
const measure = ({ id, label, valuePath, historyValue, comparisonKey, basis, note }) => ({
  id,
  label,
  topic: "Economy",
  section: "realWages",
  route: "/section/real-wages/",
  geography: { code: "GB", label: "Great Britain" },
  unit: "%",
  valuePath,
  periodPath: "headline.period",
  publishedPath: "headline.releaseDate",
  historyPath: "history",
  historyValue,
  sourceUrlPath: "source.bulletinUrl",
  cadence: "monthly-three-month-average",
  comparisonKey,
  valueStatus: "estimate",
  basis,
  note,
  caveats: ["Published directly by ONS and subject to revision."],
});

export const definition = defineFeed({
  id: "realWages",
  slug: "real-wages",
  title: "Real-terms growth in average weekly earnings",
  displayName: "Real Wages",
  description:
    "ONS's own real-terms regular and total pay growth, adjusted for inflation using CPIH, from the average weekly earnings bulletin.",
  category: "Economy",
  evidenceClass: "official-statistics",
  geography: { code: "GB", label: "Great Britain" },
  editorial: {
    publicationPeriod: "Latest ONS average weekly earnings bulletin edition",
    unit: "Percentage, real terms (CPIH-adjusted)",
    revisionStatus: "Average weekly earnings are provisional and subject to revision",
    caveat:
      "This uses ONS's own CPIH-adjusted real-terms earnings growth figure, not a calculation from separate nominal-pay and inflation series.",
  },
  sources: ["ons-average-weekly-earnings"],
  automation: "automated",
  collectionLayer: "worker",
  retrieval: "scheduled-publication-check",
  cadence: { collect: "daily", publication: "monthly", frequency: "monthly" },
  // Existing job routing; the single-pipeline replacement is a later task.
  collection: { jobType: "refresh-section", collector: "section-builder" },
  validity: {
    retrievalMaxAgeMs: 36 * HOUR_MS,
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale:
      "The latest ONS average weekly earnings bulletin is checked regularly, while its publication period is assessed separately.",
    observationMaxAgeDays: 40,
    extractor: "publishedObservation",
  },
  requirement: "required",
  measures: [
    measure({
      id: "regularPayRealGrowth",
      label: "Real wages: regular pay growth",
      valuePath: "headline.regularPayRealGrowthPercent",
      historyValue: "regularPayRealGrowthPercent",
      comparisonKey: "gb-ons-regular-pay-real-growth-cpih",
      basis: "ONS regular pay growth in real terms, CPIH-adjusted",
      note: "ONS's directly published real-terms regular-pay growth figure; provisional and subject to revision.",
    }),
    measure({
      id: "totalPayRealGrowth",
      label: "Real wages: total pay growth",
      valuePath: "headline.totalPayRealGrowthPercent",
      historyValue: "totalPayRealGrowthPercent",
      comparisonKey: "gb-ons-total-pay-real-growth-cpih",
      basis: "ONS total pay growth in real terms, including bonuses, CPIH-adjusted",
      note: "ONS's directly published real-terms total-pay growth figure; provisional and subject to revision.",
    }),
  ],
  downloads: { json: true, csv: true, geography: "United Kingdom" },
  releaseTitles: [
    { pattern: "^UK Labour Market:", flags: "i" },
    { pattern: "^Average weekly earnings in Great Britain:", flags: "i", exclude: "time series", excludeFlags: "i" },
  ],
  discovery: {
    title: "UK real wages (CPIH-adjusted)",
    kind: "dataset",
    sameAs: [BULLETIN_LATEST],
  },
  view: "RealWages",
});

