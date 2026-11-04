export type PublisherLink = {
  name: string;
  url: `https://${string}`;
};

export type SourceEntry = {
  name: string;
  use: string;
  cadence: string;
  publishers: readonly PublisherLink[];
};

type SourceGroup = {
  category: string;
  kind: "current" | "gap";
  entries: readonly SourceEntry[];
};

export const SOURCE_GROUPS = [
  {
    category: "Politics and public opinion",
    kind: "current",
    entries: [
      {
        name: "Verified primary poll publications",
        use: "Individual Great Britain voting-intention publications. public-data.org does not calculate a synthetic polling average.",
        cadence: "As published; evidence expires after 14 days",
        publishers: [
          { name: "YouGov British politics", url: "https://yougov.com/en-gb/topics/topic/British_Politics" },
          { name: "British Polling Council rules", url: "https://www.britishpollingcouncil.org/objects-and-rules/" },
        ],
      },
      {
        name: "Oddschecker public politics markets",
        use: "Three named commercial markets with raw decimal odds and unnormalised reciprocal percentages. They appear only when the complete observation is inside its four-hour window.",
        cadence: "Checked every three hours; unavailable after four hours",
        publishers: [{ name: "Oddschecker politics", url: "https://www.oddschecker.com/politics" }],
      },
    ],
  },
  {
    category: "Economy and population",
    kind: "current",
    entries: [
      {
        name: "Office for National Statistics",
        use: "Monthly GDP, labour market, public-sector debt, central-government receipts, inflation, unemployment and long-term migration.",
        cadence: "Monthly or periodic, according to the named release",
        publishers: [{ name: "Office for National Statistics", url: "https://www.ons.gov.uk/" }],
      },
      {
        name: "Bank of England",
        use: "Official Bank Rate in the key economic indicators evidence.",
        cadence: "At Monetary Policy Committee decisions",
        publishers: [{ name: "Bank of England statistics", url: "https://www.bankofengland.co.uk/statistics" }],
      },
    ],
  },
  {
    category: "Public services",
    kind: "current",
    entries: [
      {
        name: "NHS England",
        use: "Monthly referral-to-treatment waiting-time publication. A&E, GP waits, workforce and life expectancy are not part of this measure.",
        cadence: "Monthly; evidence expires after 45 days",
        publishers: [{ name: "NHS England RTT statistics", url: "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/" }],
      },
    ],
  },
  {
    category: "International comparisons",
    kind: "current",
    entries: [
      {
        name: "UK in context comparison sources",
        use: "Cross-country per-resident comparisons for debt, official development assistance, defence, public social expenditure, total health spending, tax revenue and debt interest. Each measure keeps its own observation year and comparison coverage.",
        cadence: "Checked weekly; missing publisher coverage remains unavailable",
        publishers: [
          { name: "IMF DataMapper", url: "https://www.imf.org/external/datamapper/" },
          { name: "OECD Data Explorer", url: "https://data-explorer.oecd.org/" },
          { name: "SIPRI Military Expenditure Database", url: "https://www.sipri.org/databases/milex" },
          { name: "WHO Global Health Expenditure Database", url: "https://apps.who.int/nha/database" },
          { name: "World Bank World Development Indicators", url: "https://data.worldbank.org/" },
        ],
      },
    ],
  },
  {
    category: "Evidence gaps",
    kind: "gap",
    entries: [
      {
        name: "Prime-minister approval and government satisfaction",
        use: "No value is displayed until one consistent question and reproducible primary-poll series is available.",
        cadence: "Unavailable",
        publishers: [
          { name: "Ipsos Political Monitor", url: "https://www.ipsos.com/en-uk/topic/political-monitor" },
          { name: "British Polling Council rules", url: "https://www.britishpollingcouncil.org/objects-and-rules/" },
        ],
      },
      {
        name: "Polarisation analysis",
        use: "No score is displayed because the former formula and poll-level inputs were not reproducible.",
        cadence: "Unavailable",
        publishers: [{ name: "British Social Attitudes", url: "https://natcen.ac.uk/british-social-attitudes" }],
      },
      {
        name: "Crime in England and Wales",
        use: "No combined figure is displayed. Crime Survey estimates and police-recorded offences require separate official series.",
        cadence: "Separate measures only",
        publishers: [
          { name: "ONS crime and justice", url: "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice" },
          { name: "Home Office crime statistics", url: "https://www.gov.uk/government/collections/crime-statistics" },
        ],
      },
      {
        name: "UK regional comparison",
        use: "No map, ranking or value is displayed because the former layers lacked row-level evidence, standard geography codes and cross-nation comparability.",
        cadence: "Unavailable",
        publishers: [
          { name: "ONS geography", url: "https://www.ons.gov.uk/methodology/geography" },
          { name: "Electoral Commission results", url: "https://www.electoralcommission.org.uk/research-reports-and-data/election-results" },
        ],
      },
      {
        name: "Policy relationship analysis",
        use: "No coefficient or relationship strength is displayed because the former inputs, variables, weighting and calculation were not reproducible.",
        cadence: "Unavailable",
        publishers: [{ name: "British Social Attitudes", url: "https://natcen.ac.uk/british-social-attitudes" }],
      },
    ],
  },
] as const satisfies readonly SourceGroup[];
