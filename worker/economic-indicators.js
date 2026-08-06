import { fetchOfficialText as fetchSourceText } from "./official-source-fetch.js";

const ONS_ORIGIN = "https://www.ons.gov.uk";
const ONS_GENERATOR = `${ONS_ORIGIN}/generator?format=csv&uri=`;
const BOE_BANK_RATE_URL = "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp";
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const TEN_YEARS_MONTHLY = 120;
const TEN_YEARS_MS = 10 * 365.25 * 24 * 60 * 60 * 1000;

const MONTHS = Object.freeze({
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
});

const MONTH_NAMES = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

const SERIES_DEFINITIONS = Object.freeze({
  inflation: Object.freeze({
    id: "inflation",
    label: "CPI inflation",
    shortLabel: "Inflation",
    unit: "%",
    color: "#C92F00",
    publisher: "Office for National Statistics",
    seriesId: "D7G7",
    datasetId: "MM23",
    topicPath: "/economy/inflationandpriceindices/timeseries/d7g7/mm23",
    sourceUrl:
      "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
    frequency: "Monthly",
    revisionStatus:
      "The latest CPI estimate can be revised under the ONS consumer price inflation revision policy.",
    periodType: "monthly",
  }),
  bankRate: Object.freeze({
    id: "bankRate",
    label: "Official Bank Rate",
    shortLabel: "Bank Rate",
    unit: "%",
    color: "#111111",
    publisher: "Bank of England",
    seriesId: "IUDBEDR",
    datasetId: "IADB",
    sourceUrl: BOE_BANK_RATE_URL,
    frequency: "Changed by Monetary Policy Committee decision",
    revisionStatus:
      "The official rate history is event-dated rather than statistically revised.",
    periodType: "event",
  }),
  unemployment: Object.freeze({
    id: "unemployment",
    label: "Unemployment rate",
    shortLabel: "Unemployment",
    unit: "%",
    color: "#555555",
    publisher: "Office for National Statistics",
    seriesId: "MGSX",
    datasetId: "LMS",
    topicPath:
      "/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
    sourceUrl:
      "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
    frequency: "Monthly publication of a rolling three-month estimate",
    revisionStatus:
      "Labour Force Survey estimates are subject to sampling uncertainty and later revision.",
    periodType: "rolling-three-month",
  }),
});

function decodeHtml(value) {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, "-")
    .replace(/&rsquo;|&#8217;|&#39;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value, label) {
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse ${label}`);
  }
  return Number(parsed.toFixed(4));
}

function monthIndex(value, label) {
  const month = MONTHS[String(value).slice(0, 3).toLowerCase()];
  if (month === undefined) {
    throw new Error(`Unable to parse ${label} month '${value}'`);
  }
  return month;
}

function isoDate(value, label) {
  const match = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) {
    throw new Error(`Unable to parse ${label} '${value}'`);
  }
  const month = monthIndex(match[2], label);
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  if (
    date.getUTCFullYear() !== Number(match[3]) ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== Number(match[1])
  ) {
    throw new Error(`Unable to parse ${label} '${value}'`);
  }
  return date.toISOString().slice(0, 10);
}

function parseOnsPublicationPage(html) {
  const text = decodeHtml(html);
  const releaseMatch = text.match(/Release date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (!releaseMatch) {
    throw new Error("ONS series page did not expose a release date");
  }
  const nextReleaseMatch = text.match(/Next release:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  return {
    publishedAt: isoDate(releaseMatch[1], "ONS release date"),
    nextRelease: nextReleaseMatch
      ? isoDate(nextReleaseMatch[1], "ONS next release date")
      : null,
  };
}

function parseOnsMonthlyCsv(text) {
  const points = [];
  const seen = new Set();

  for (const line of String(text).trim().split(/\r?\n/)) {
    const parts = line.split(",").map((part) => part.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2 || !/^\d{4}\s+[A-Za-z]{3}$/.test(parts[0])) {
      continue;
    }

    const rawPeriod = parts[0].toUpperCase();
    if (seen.has(rawPeriod)) {
      throw new Error(`ONS series contains duplicate period '${rawPeriod}'`);
    }
    seen.add(rawPeriod);

    const match = rawPeriod.match(/^(\d{4})\s+([A-Z]{3})$/);
    const year = Number(match[1]);
    const month = monthIndex(match[2], "ONS period");
    const observedAt = new Date(Date.UTC(year, month + 1, 0)).toISOString();
    points.push({
      rawPeriod,
      year,
      month,
      observedAt,
      value: parseNumber(parts[1], `${rawPeriod} value`),
    });
  }

  points.sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  if (points.length === 0) {
    throw new Error("ONS CSV did not expose monthly observations");
  }
  return points;
}

function monthlyPeriod(point) {
  return `${MONTH_NAMES[point.month]} ${point.year}`;
}

function rollingThreeMonthPeriod(point) {
  const startDate = new Date(Date.UTC(point.year, point.month - 2, 1));
  const endDate = new Date(Date.UTC(point.year, point.month, 1));
  const start = `${MONTH_NAMES[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`;
  const end = `${MONTH_NAMES[endDate.getUTCMonth()]} ${endDate.getUTCFullYear()}`;
  return `${start} to ${end}`;
}

function parseBoeDate(value) {
  const match = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}|\d{4})$/);
  if (!match) {
    throw new Error(`Unable to parse Bank Rate date '${value}'`);
  }
  const month = monthIndex(match[2], "Bank Rate");
  const yearValue = Number(match[3]);
  const year = match[3].length === 2 ? (yearValue >= 70 ? 1900 + yearValue : 2000 + yearValue) : yearValue;
  const date = new Date(Date.UTC(year, month, Number(match[1])));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== Number(match[1])
  ) {
    throw new Error(`Unable to parse Bank Rate date '${value}'`);
  }
  return date.toISOString();
}

function parseBankRateHtml(html) {
  const text = String(html);
  const bodyMatch = text.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const rows = [...(bodyMatch?.[1] ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const points = [];
  const seen = new Set();

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (cell) => decodeHtml(cell[1])
    );
    if (cells.length < 2 || !/^\d{1,2}\s+[A-Za-z]{3}\s+(?:\d{2}|\d{4})$/.test(cells[0])) {
      continue;
    }

    const observedAt = parseBoeDate(cells[0]);
    if (seen.has(observedAt)) {
      throw new Error(`Bank Rate history contains duplicate date '${cells[0]}'`);
    }
    seen.add(observedAt);
    points.push({
      period: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(observedAt)),
      observedAt,
      value: parseNumber(cells[1], `${cells[0]} Bank Rate`),
    });
  }

  points.sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  if (points.length === 0) {
    throw new Error("Bank of England page did not expose Bank Rate history");
  }
  return points;
}

async function fetchOfficialText(url, fetchImpl = fetch) {
  return fetchSourceText(url, {
    fetchImpl,
    sourceName: "Official source",
  });
}

function historyPoint(point, period) {
  return {
    period,
    observedAt: point.observedAt,
    value: point.value,
  };
}

function buildOnsSeries(definition, points, publication, retrievedAt) {
  const latest = points.at(-1);
  const priorYear = points.at(-13);
  const periodFormatter =
    definition.periodType === "rolling-three-month" ? rollingThreeMonthPeriod : monthlyPeriod;
  return {
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    value: latest.value,
    unit: definition.unit,
    color: definition.color,
    period: periodFormatter(latest),
    observedAt: latest.observedAt,
    publishedAt: `${publication.publishedAt}T00:00:00.000Z`,
    retrievedAt,
    publisher: definition.publisher,
    sourceUrl: definition.sourceUrl,
    seriesId: definition.seriesId,
    datasetId: definition.datasetId,
    frequency: definition.frequency,
    revisionStatus: definition.revisionStatus,
    evidenceClass: "official-data",
    status: "current",
    nextRelease: publication.nextRelease,
    annualDelta:
      priorYear === undefined ? null : Number((latest.value - priorYear.value).toFixed(1)),
    annualDeltaUnit: "percentage points",
    history: points
      .slice(-TEN_YEARS_MONTHLY)
      .map((point) => historyPoint(point, periodFormatter(point))),
  };
}

function buildBankRateSeries(points, retrievedAt) {
  const definition = SERIES_DEFINITIONS.bankRate;
  const latest = points.at(-1);
  const cutoff = Date.parse(latest.observedAt) - TEN_YEARS_MS;
  const history = points.filter((point) => Date.parse(point.observedAt) >= cutoff);
  const comparisonDate = new Date(latest.observedAt);
  comparisonDate.setUTCFullYear(comparisonDate.getUTCFullYear() - 1);
  const priorYear = points
    .filter((point) => Date.parse(point.observedAt) <= comparisonDate.getTime())
    .at(-1);
  return {
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    value: latest.value,
    unit: definition.unit,
    color: definition.color,
    period: latest.period,
    observedAt: latest.observedAt,
    publishedAt: latest.observedAt,
    retrievedAt,
    publisher: definition.publisher,
    sourceUrl: definition.sourceUrl,
    seriesId: definition.seriesId,
    datasetId: definition.datasetId,
    frequency: definition.frequency,
    revisionStatus: definition.revisionStatus,
    evidenceClass: "official-data",
    status: "current",
    nextRelease: null,
    annualDelta:
      priorYear === undefined ? null : Number((latest.value - priorYear.value).toFixed(2)),
    annualDeltaUnit: "percentage points",
    history,
  };
}

async function buildEconomicIndicators(fetchImpl = fetch, nowProvider = () => new Date()) {
  const now = nowProvider();
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error("Economic indicator retrieval time is invalid");
  }
  const retrievedAt = now.toISOString();

  const inflationDefinition = SERIES_DEFINITIONS.inflation;
  const unemploymentDefinition = SERIES_DEFINITIONS.unemployment;
  const [onsPublications, bankRatePage] = await Promise.all([
    (async () => {
      // Keep requests to the same publisher sequential. Start pacing alone does
      // not prevent overlapping responses, and live burst requests returned 429.
      const inflationCsv = await fetchOfficialText(
        `${ONS_GENERATOR}${inflationDefinition.topicPath}`,
        fetchImpl
      );
      const inflationPage = await fetchOfficialText(
        inflationDefinition.sourceUrl,
        fetchImpl
      );
      const unemploymentCsv = await fetchOfficialText(
        `${ONS_GENERATOR}${unemploymentDefinition.topicPath}`,
        fetchImpl
      );
      const unemploymentPage = await fetchOfficialText(
        unemploymentDefinition.sourceUrl,
        fetchImpl
      );
      return {
        inflationCsv,
        inflationPage,
        unemploymentCsv,
        unemploymentPage,
      };
    })(),
    fetchOfficialText(BOE_BANK_RATE_URL, fetchImpl),
  ]);
  const {
    inflationCsv,
    inflationPage,
    unemploymentCsv,
    unemploymentPage,
  } = onsPublications;

  const series = {
    inflation: buildOnsSeries(
      inflationDefinition,
      parseOnsMonthlyCsv(inflationCsv),
      parseOnsPublicationPage(inflationPage),
      retrievedAt
    ),
    bankRate: buildBankRateSeries(parseBankRateHtml(bankRatePage), retrievedAt),
    unemployment: buildOnsSeries(
      unemploymentDefinition,
      parseOnsMonthlyCsv(unemploymentCsv),
      parseOnsPublicationPage(unemploymentPage),
      retrievedAt
    ),
  };

  return {
    available: true,
    order: ["inflation", "bankRate", "unemployment"],
    series,
    methodology: {
      alignment:
        "Each series keeps its own observation period, publication date, retrieval time and revision status. public-data.org does not carry values forward onto another series' timeline.",
      evidenceClass: "official-data",
    },
  };
}

function validTimestamp(value, nowMs) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed <= nowMs + FUTURE_TOLERANCE_MS;
}

function isSeries(value, definition, nowMs) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (
    value.id !== definition.id ||
    value.publisher !== definition.publisher ||
    value.sourceUrl !== definition.sourceUrl ||
    value.seriesId !== definition.seriesId ||
    value.datasetId !== definition.datasetId ||
    value.evidenceClass !== "official-data" ||
    value.status !== "current" ||
    typeof value.period !== "string" ||
    !value.period.trim() ||
    typeof value.revisionStatus !== "string" ||
    !value.revisionStatus.trim() ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    !validTimestamp(value.observedAt, nowMs) ||
    !validTimestamp(value.publishedAt, nowMs) ||
    !validTimestamp(value.retrievedAt, nowMs) ||
    !Array.isArray(value.history) ||
    value.history.length === 0 ||
    (value.annualDelta !== null &&
      (typeof value.annualDelta !== "number" || !Number.isFinite(value.annualDelta))) ||
    value.annualDeltaUnit !== "percentage points"
  ) {
    return false;
  }

  const latest = value.history.at(-1);
  return (
    latest?.observedAt === value.observedAt &&
    latest?.value === value.value &&
    value.history.every(
      (point) =>
        point &&
        typeof point.period === "string" &&
        point.period.trim() &&
        typeof point.value === "number" &&
        Number.isFinite(point.value) &&
        validTimestamp(point.observedAt, nowMs)
    )
  );
}

function isEconomicIndicatorsPayload(data, now = new Date()) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || !data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  const order = Object.keys(SERIES_DEFINITIONS);
  return (
    data.available === true &&
    Array.isArray(data.order) &&
    JSON.stringify(data.order) === JSON.stringify(order) &&
    data.series &&
    typeof data.series === "object" &&
    !Array.isArray(data.series) &&
    order.every((id) => isSeries(data.series[id], SERIES_DEFINITIONS[id], nowMs)) &&
    !("economicData" in data) &&
    !("metricConfig" in data)
  );
}

export {
  BOE_BANK_RATE_URL,
  SERIES_DEFINITIONS,
  buildEconomicIndicators,
  isEconomicIndicatorsPayload,
  parseBankRateHtml,
  parseOnsMonthlyCsv,
  parseOnsPublicationPage,
  rollingThreeMonthPeriod,
};
