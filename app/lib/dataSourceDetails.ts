export interface DataSourceDetail {
  publicationPeriod: string;
  unit: string;
  revisionStatus: string;
  caveat: string;
}

export const DATA_SOURCE_DETAILS: Record<string, DataSourceDetail> = {
  pmApproval: {
    publicationPeriod: "No current publication represented",
    unit: "No approval value displayed",
    revisionStatus: "Previous embedded series withdrawn",
    caveat: "public-data.org will not infer or average a current PM approval number without first-party poll publications, complete fieldwork and sample disclosures, consistent question wording and a tested comparison method.",
  },
  electionPolling: {
    publicationPeriod: "Latest verified primary pollster publication inside a 14-day evidence window",
    unit: "Published party share (%)",
    revisionStatus: "Individual poll publications are normally final; public-data.org does not revise or average them",
    caveat: "Each poll is shown separately with fieldwork, sample, question or headline method, commissioner, uncertainty and a direct first-party source. One poll is not evidence of a durable trend.",
  },
  bettingOdds: {
    publicationPeriod: "Latest complete Oddschecker snapshot inside a four-hour observation window",
    unit: "Decimal odds and raw reciprocal percentage",
    revisionStatus: "Continuously repriced rather than statistically revised",
    caveat: "public-data.org shows each named market separately, calculates 100 divided by decimal odds and does not normalize prices to 100%. The results are neither official statistics nor official forecasts. Liquidity, provider coverage, bookmaker margins and market rules affect them; stale, embedded or incomplete prices are unavailable.",
  },
  polarizationMeter: {
    publicationPeriod: "No current publication represented",
    unit: "No derived score displayed",
    revisionStatus: "Previous site-derived score withdrawn",
    caveat: "The measure remains unavailable until its poll-level or respondent-level inputs, coverage, weighting, missing-data treatment, exclusions, formula, sensitivity checks and uncertainty are published and tested.",
  },
  trendLines: {
    publicationPeriod: "No current publication represented",
    unit: "No satisfaction or trust value displayed",
    revisionStatus: "Previous hardcoded trend and event annotations withdrawn",
    caveat: "Satisfaction, approval and trust questions are not interchangeable. A future series must use one named measure, direct first-party tables, complete wave disclosures and explicit comparability breaks without implying that annotated events caused polling movements.",
  },
  nationalDebt: {
    publicationPeriod: "Latest monthly public-sector-finance period available",
    unit: "£ billions and percentage of GDP",
    revisionStatus: "Subject to routine ONS public-sector-finance revisions",
    caveat: "public-data.org shows public sector net debt excluding public sector banks (HF6W) and the matching percentage-of-GDP series (HF6X). Other debt measures use different coverage and are not interchangeable.",
  },
  gdpTracker: {
    publicationPeriod: "Latest ONS monthly GDP bulletin edition",
    unit: "Percentage change in real, seasonally adjusted GDP",
    revisionStatus: "Early monthly estimate; revised as fuller source data become available",
    caveat: "public-data.org keeps the latest monthly movement separate from the three-month comparison and does not mix forecasts, nominal totals or international estimates into the headline.",
  },
  sentimentPulse: {
    publicationPeriod: "Separate latest periods for CPI, Bank Rate and unemployment",
    unit: "Percentage for each named series",
    revisionStatus: "CPI and Labour Force Survey estimates may be revised; Bank Rate is event-dated",
    caveat: "CPI is monthly, unemployment is a rolling three-month estimate and Bank Rate changes after Monetary Policy Committee decisions. public-data.org keeps their observation periods, publication dates, check dates and revision status separate and does not align them onto one shared month.",
  },
  taxRevenue: {
    publicationPeriod: "Latest ONS public-sector-finance bulletin edition",
    unit: "£ billions of central government receipts",
    revisionStatus: "Subject to routine public-finance revisions",
    caveat: "The displayed monthly receipts measure is not a tax-burden ratio, category breakdown, forecast or average-per-person estimate.",
  },
  governmentContracts: {
    publicationPeriod: "Latest complete seven-day Find a Tender update window, collected in six-hour slices",
    unit: "Disclosed award value in GBP, excluding VAT where supplied",
    revisionStatus: "Contracting authorities can publish corrections, updates and later notices; the newest release for each award identity is retained",
    caveat: "Award values are not invoices or confirmed lifetime expenditure. Framework ceilings, lots and multi-supplier awards may not be fully spent. Missing, redacted and non-GBP values are excluded, and contract size alone is not evidence of waste, fraud, corruption or savings.",
  },
  employmentStats: {
    publicationPeriod: "Latest ONS UK labour-market bulletin edition",
    unit: "Rates (%) and vacancies (people), as labelled",
    revisionStatus: "Labour Force Survey and vacancy estimates may be revised",
    caveat: "Employment, unemployment and inactivity use rolling three-month periods. Vacancies come from a separate employer survey and retain their own period.",
  },
  crimeStatistics: {
    publicationPeriod: "Latest verified ONS Crime in England and Wales edition and current MoJ quarterly court publication, shown separately",
    unit: "Estimated incidents, recorded offences or median days, as labelled",
    revisionStatus: "Official source publications may be revised; each module retains its own release and observation period",
    caveat: "Crime Survey estimates, police-recorded offences and court timeliness measure different phenomena and are never added into one total. Regional rankings remain unavailable until one versioned geography and population method is reproducible. Geography is England and Wales.",
  },
  nhsStats: {
    publicationPeriod: "Latest verified NHS England referral-to-treatment month",
    unit: "Incomplete pathways, weeks or percentage, as labelled",
    revisionStatus: "NHS England may revise provider submissions, usually through periodic revision releases",
    caveat: "The headline counts consultant-led pathways rather than unique people. National figures include estimates for non-reporting acute trusts, while treatment-function rows exclude those estimates. A&E, GP waits, workforce and life expectancy are not mixed into this release.",
  },
  migrationStats: {
    publicationPeriod: "Latest ONS long-term international migration bulletin edition",
    unit: "People",
    revisionStatus: "Official statistics in development; the newest estimates are provisional for one year and earlier periods may be revised",
    caveat: "public-data.org shows ONS long-term migration estimates for people moving for 12 months or more. Visa grants and nationality tables are different administrative measures and are not mixed into this headline.",
  },
  earlyYears: {
    publicationPeriod: "UKHSA COVER 2024/25 and DfE EYFS profile 2024/25",
    unit: "Rates (%) as labelled",
    revisionStatus: "UKHSA immunisation data can be corrected; DfE profiles may receive publication updates",
    caveat: "EYFSP profiles were cancelled during the COVID-19 pandemic (2019/20 and 2020/21). A new EYFS profile baseline assessment was introduced in 2021/22, meaning rates before and after are not directly comparable.",
  },
  geographicHeatmap: {
    publicationPeriod: "No current regional publication represented",
    unit: "No regional value or ranking displayed",
    revisionStatus: "Previous hardcoded multi-source comparison withdrawn",
    caveat: "The former map mixed non-standard regions and source systems with different national coverage. A future comparison requires official geography codes, one named measure, direct source rows, a reproducible join and explicit cross-nation comparability.",
  },
  echoChamberMap: {
    publicationPeriod: "No current survey publication represented",
    unit: "No relationship coefficient displayed",
    revisionStatus: "Previous site-derived matrix withdrawn",
    caveat: "The analysis remains unavailable until its respondent-level or aggregate inputs, variables, survey coverage, weighting, exclusions, statistic, uncertainty and tests can be published and reproduced.",
  },
  politicalCompass: {
    publicationPeriod: "Current user session",
    unit: "User-generated position score",
    revisionStatus: "Recalculated when answers change",
    caveat: "This is an illustrative self-assessment, not a validated diagnosis, public statistic or population estimate.",
  },
};
