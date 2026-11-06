// Declaration for the Government Contracts feed. Pure data: no fetching, no parsing.
// Collector: ./parse.js. Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

const HOUR_MS = 60 * 60 * 1000;

export const definition = defineFeed({
  id: "governmentContracts",
  slug: "government-contracts",
  title: "Government contracts",
  displayName: "Government Contracts",
  description: "Inspect comparable disclosed procurement awards when this publication is enabled and its source records pass verification.",
  category: "Public money",
  evidenceClass: "administrative-data",
  geography: { code: "UK", label: "United Kingdom — Find a Tender publication coverage" },
  editorial: {
    publicationPeriod: "Latest complete seven-day Find a Tender update window, collected in six-hour slices",
    unit: "Disclosed award value in GBP, excluding VAT where supplied",
    revisionStatus: "Contracting authorities can publish corrections, updates and later notices; the newest release for each award identity is retained",
    caveat: "Award values are not invoices or confirmed lifetime expenditure. Framework ceilings, lots and multi-supplier awards may not be fully spent; missing, redacted and non-GBP values are excluded.",
  },
  sources: ["cabinet-office-find-a-tender"],
  uiSourceLabels: ["Cabinet Office Find a Tender OCDS award releases"],
  registry: "publication",
  automation: "automated",
  collectionLayer: "publication",
  retrieval: "scheduled-publication-check",
  cadence: {
    collect: "daily",
    publication: "continuous notice publication",
    frequency: "daily Cloudflare Queue collection",
  },
  validity: {
    retrievalMaxAgeMs: 72 * HOUR_MS,
    freshnessWindow: "Within 72 hours of the verified collection",
    freshnessRationale: "The ranking uses seven complete UTC day shards and can reuse only a still-current accepted publication.",
    retrievalOnly: true,
  },
  requirement: "optional",
  // Seven complete UTC day shards, each collected in four six-hour slices.
  shards: { kind: "day", window: 7 },
  measures: [],
  downloads: { json: false, csv: false, geography: "United Kingdom — Find a Tender publication coverage" },
  releaseTitles: [],
  discovery: {
    title: "UK government contracts",
    kind: "dataset",
    sameAs: ["https://www.find-tender.service.gov.uk/"],
  },
  view: "GovernmentContracts",
});
