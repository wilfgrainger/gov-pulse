// Declaration for the Early Years Spotlight feed. Pure data: no fetching, no parsing.
// Static evidence: no collector (the consumer reads reviewed values). Publication state: config/publications.json only.
import { defineFeed } from "../define-feed.js";

export const definition = defineFeed({
  id: "earlyYears",
  slug: "early-years",
  title: "Early years evidence",
  displayName: "Early Years Spotlight",
  description: "Child vaccination and school-readiness indicators in England with dated official sources and historical context.",
  category: "Society",
  evidenceClass: "official-statistics",
  geography: { code: "ENG", label: "England" },
  editorial: {
    publicationPeriod: "UKHSA COVER 2024/25 and DfE EYFS profile 2024/25",
    unit: "Rates (%) as labelled",
    revisionStatus: "UKHSA immunisation data can be corrected; DfE profiles may receive publication updates",
    caveat: "EYFSP profiles were cancelled during the COVID-19 pandemic (2019/20 and 2020/21). A new EYFS profile baseline was introduced in 2021/22, so earlier and later rates are not directly comparable.",
  },
  sources: ["ukhsa-cover", "dfe-eyfs"],
  uiSourceLabels: ["UKHSA COVER childhood vaccination statistics", "DfE School Readiness"],
  registry: null,
  automation: "static",
  collectionLayer: "worker",
  cadence: { frequency: "periodic" },
  measures: [],
  downloads: { json: false, csv: false, geography: "England" },
  releaseTitles: [],
  discovery: {
    title: "Early years evidence in England",
    kind: "dataset",
    sameAs: [
      "https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-annual-reports/vaccination-coverage-statistics-for-children-aged-up-to-5-years-england-cover-programme-report-april-2024-to-march-2025",
      "https://explore-education-statistics.service.gov.uk/find-statistics/early-years-foundation-stage-profile-results/2024-25",
    ],
  },
  view: "EarlyYearsStats",
});
