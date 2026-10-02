export type MeasureDefinition = {
  id: string;
  label: string;
  topic: string;
  section: string;
  route: string;
  geography: string;
  unit: string;
  valuePath: string;
  periodPath: string;
  publicationPath: string;
  historyPath: string;
  historyValue: string;
  note: string;
};

export type Measure = MeasureDefinition & {
  value: number | null;
  period: string | null;
  publishedAt: string | null;
  sourceUrl: string | null;
  history: { date: number; period: string; value: number }[];
  updateDue: boolean;
};

const base = (
  section: string,
  route: string,
  topic: string,
  geography = "United Kingdom",
) => ({ section, route: `/section/${route}/`, topic, geography });
const headline = {
  periodPath: "headline.period",
  publicationPath: "headline.releaseDate",
  historyPath: "history",
};
const labour = {
  ...base("employmentStats", "employment", "Jobs"),
  ...headline,
  historyPath: "history.labourForce",
};
const nhs = {
  ...base("nhsStats", "nhs", "Health", "England"),
  ...headline,
  publicationPath: "headline.publicationDate",
};

export const MEASURES: MeasureDefinition[] = [
  {
    ...base("gdpTracker", "gdp", "Economy"), ...headline,
    id: "gdp-threeMonthGrowth", label: "GDP: three-month growth", unit: "%",
    valuePath: "headline.threeMonthGrowth", historyValue: "threeMonthGrowth",
    note: "Real GDP across the latest three months. An early estimate that can be revised.",
  },
  {
    ...base("sentimentPulse", "economy", "Economy"),
    id: "inflation", label: "CPI inflation", unit: "%",
    valuePath: "series.inflation.value", periodPath: "series.inflation.period",
    publicationPath: "series.inflation.publishedAt", historyPath: "series.inflation.history",
    historyValue: "value",
    note: "Annual CPI rate. Lower inflation means prices rise more slowly, not that they have fallen.",
  },
  {
    ...labour, id: "unemployment", label: "Unemployment rate", unit: "%",
    valuePath: "headline.unemploymentRate", historyValue: "unemploymentRate",
    note: "A rolling three-month Labour Force Survey estimate; subject to sampling uncertainty and revision.",
  },
  {
    ...nhs, id: "waitingPathwaysEstimate", label: "NHS waiting list", unit: "pathways",
    valuePath: "headline.waitingPathwaysEstimate", historyValue: "waitingPathwaysEstimate",
    note: "NHS England referral-to-treatment pathways, not unique people. A person can wait on more than one pathway.",
  },
  {
    ...base("nationalDebt", "national-debt", "Public finances"),
    id: "debt-ratio", label: "Debt as a share of GDP", unit: "%",
    valuePath: "debtToGdp", periodPath: "observationPeriod", publicationPath: "publicationDate",
    historyPath: "history", historyValue: "debtToGdp",
    note: "Public sector net debt excluding public sector banks, divided by GDP.",
  },
  {
    ...base("taxRevenue", "tax", "Public finances"), ...headline,
    id: "receipts", label: "Central government receipts", unit: "£bn",
    valuePath: "headline.receiptsBillion", historyValue: "receiptsBillion",
    note: "Monthly nominal receipts on the ONS accounting basis. Not all receipts are taxes. Compare the same month across years to avoid seasonality.",
  },
  {
    ...base("migrationStats", "migration", "Population"), ...headline,
    id: "netMigration", label: "Net migration", unit: "people",
    valuePath: "headline.netMigration", historyValue: "netMigration",
    note: "ONS long-term migration estimates. Provisional and subject to revision; not a count of small-boat arrivals.",
  },
  {
    ...base("realWages", "real-wages", "Economy", "Great Britain"), ...headline,
    id: "regularPayRealGrowth", label: "Real wages: regular pay growth", unit: "%",
    valuePath: "headline.regularPayRealGrowthPercent", historyValue: "regularPayRealGrowthPercent",
    note: "ONS's own real-terms (CPIH-adjusted) regular pay growth figure, published directly in the average weekly earnings bulletin. Provisional and subject to revision.",
  },
];
