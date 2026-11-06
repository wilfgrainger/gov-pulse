// Declaration for the International Comparison feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "internationalComparison",
  slug: "international-comparison",
  title: "International country comparisons",
  displayName: "International Comparison",
  evidenceClass: "official-statistics",
  legacyEvidenceClass: "international-comparative-statistics",
  geography: {
    code: "INT",
    label: "United Kingdom and twelve named peer countries, with measure-specific coverage",
  },
  sources: ["imf-data", "world-bank-wdi", "oecd-data-explorer", "sipri-milex", "who-world-bank-health"],
  runtimeSourceIds: [
    "imf-gdp-2026",
    "world-bank-population-2025",
    "imf-debt-2026",
    "imf-interest-2024",
    "oecd-oda-2025",
    "sipri-2025",
    "oecd-socx-2023",
    "world-bank-health-2024",
    "oecd-tax-2024",
    "world-bank-gdp-per-capita-2023",
    "world-bank-gdp-per-capita-2024",
  ],
  registry: "publication",
  automation: "automated",
  collectionLayer: "publication",
  retrieval: "scheduled-publication-check",
  cadence: {
    collect: "weekly and on-demand by measure",
    publication: "publisher-specific annual releases",
    frequency: "weekly and on-demand by measure",
  },
  validity: {
    retrievalMaxAgeMs: 720 * HOUR_MS,
    retrievalOnly: true,
  },
  requirement: "independent",
  // One shard per source batch. The batch list is the single declaration the queue
  // dispatcher and the comparison runner read (INTERNATIONAL_COMPARISON_REFRESH_BATCHES).
  shards: {
    kind: "batch",
    batches: [
      { id: "government-debt", sourceIds: ["imf-gdp-2026", "imf-debt-2026"], measureIds: ["governmentDebt"] },
      { id: "oda", sourceIds: ["world-bank-population-2025", "oecd-oda-2025"], measureIds: ["officialDevelopmentAssistance"] },
      { id: "defence", sourceIds: ["world-bank-population-2025", "sipri-2025"], measureIds: ["defenceSpending"] },
      { id: "social-spending", sourceIds: ["world-bank-gdp-per-capita-2023", "oecd-socx-2023"], measureIds: ["publicSocialExpenditure"] },
      { id: "healthcare", sourceIds: ["world-bank-health-2024"], measureIds: ["healthcareSpending"] },
      { id: "tax-revenue", sourceIds: ["world-bank-gdp-per-capita-2024", "oecd-tax-2024"], measureIds: ["taxRevenue"] },
      { id: "debt-interest", sourceIds: ["world-bank-gdp-per-capita-2024", "imf-interest-2024"], measureIds: ["debtInterest"] },
    ],
  },
  measures: [],
  downloads: {
    json: false,
    csv: false,
    geography: "United Kingdom and twelve named peer countries, with measure-specific coverage",
  },
  releaseTitles: [],
});
