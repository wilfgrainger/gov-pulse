import { fetchOfficialText as fetchSourceText } from "../../worker/official-source-fetch.js";
import { SENTIMENT_MEASURE_IDS } from "../../contracts/evidence-policy.js";

const ONS_ORIGIN = "https://www.ons.gov.uk";
const ONS_GENERATOR = `${ONS_ORIGIN}/generator?format=csv&uri=`;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const TEN_YEARS_MONTHLY = 120;
const ONS_MAX_PUBLICATION_AGE_MS = 75 * 24 * 60 * 60 * 1000;

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
  // LMS series labels the rolling estimate by its centre month.
  const startDate = new Date(Date.UTC(point.year, point.month - 1, 1));
  const endDate = new Date(Date.UTC(point.year, point.month + 1, 1));
  const start = `${MONTH_NAMES[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`;
  const end = `${MONTH_NAMES[endDate.getUTCMonth()]} ${endDate.getUTCFullYear()}`;
  return `${start} to ${end}`;
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
  const rolling = definition.periodType === "rolling-three-month";
  const periodFormatter = rolling ? rollingThreeMonthPeriod : monthlyPeriod;
  const observedAt = (point) => rolling
    ? new Date(Date.UTC(point.year, point.month + 2, 0)).toISOString()
    : point.observedAt;
  return {
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    value: latest.value,
    unit: definition.unit,
    color: definition.color,
    period: periodFormatter(latest),
    observedAt: observedAt(latest),
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
      .map((point) => historyPoint({ ...point, observedAt: observedAt(point) }, periodFormatter(point))),
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
  // Keep requests to the same publisher sequential. Start pacing alone does
  // not prevent overlapping responses, and live burst requests returned 429.
  const inflationCsv = await fetchOfficialText(
    `${ONS_GENERATOR}${inflationDefinition.topicPath}`,
    fetchImpl
  );
  const inflationPage = await fetchOfficialText(inflationDefinition.sourceUrl, fetchImpl);
  const unemploymentCsv = await fetchOfficialText(
    `${ONS_GENERATOR}${unemploymentDefinition.topicPath}`,
    fetchImpl
  );
  const unemploymentPage = await fetchOfficialText(unemploymentDefinition.sourceUrl, fetchImpl);

  const series = {
    inflation: buildOnsSeries(
      inflationDefinition,
      parseOnsMonthlyCsv(inflationCsv),
      parseOnsPublicationPage(inflationPage),
      retrievedAt
    ),
    unemployment: buildOnsSeries(
      unemploymentDefinition,
      parseOnsMonthlyCsv(unemploymentCsv),
      parseOnsPublicationPage(unemploymentPage),
      retrievedAt
    ),
  };

  return {
    available: true,
    order: [...SENTIMENT_MEASURE_IDS],
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
  // A record stored before Bank Rate was removed (11 November 2026) still lists
  // it; that series is ignored here and dropped from every public projection.
  const ownOrder = Array.isArray(data.order) ? data.order.filter((id) => id !== "bankRate") : null;
  return (
    data.available === true &&
    JSON.stringify(ownOrder) === JSON.stringify(order) &&
    data.series &&
    typeof data.series === "object" &&
    !Array.isArray(data.series) &&
    order.every((id) => isSeries(data.series[id], SERIES_DEFINITIONS[id], nowMs)) &&
    !("economicData" in data) &&
    !("metricConfig" in data)
  );
}

// Moved VERBATIM from worker/series-entry.js (via worker/section-builders.js).
function publicationCurrent(data, now = new Date()) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return false;

  return ["inflation", "unemployment"].every((id) => {
    const publishedAt = Date.parse(data?.series?.[id]?.publishedAt ?? "");
    return (
      Number.isFinite(publishedAt) &&
      Math.max(0, nowMs - publishedAt) <= ONS_MAX_PUBLICATION_AGE_MS
    );
  });
}

async function buildCurrentEconomicIndicators(
  fetchImpl = fetch,
  nowProvider = () => new Date()
) {
  const now = nowProvider();
  const data = await buildEconomicIndicators(fetchImpl, () => now);
  if (!isEconomicIndicatorsPayload(data, now) || !publicationCurrent(data, now)) {
    throw new Error("Official indicator series are outside their currentness contract");
  }
  return data;
}

/**
 * Feed interface (target design 2.3). `data` is exactly the section payload
 * buildCurrentEconomicIndicators has always produced: the build plus its
 * fail-closed currentness gate.
 *
 * @param {{fetch: typeof fetch, now: Date}} ctx
 */
async function collect(ctx) {
  return { data: await buildCurrentEconomicIndicators(ctx.fetch, () => ctx.now) };
}

export {
  ONS_MAX_PUBLICATION_AGE_MS,
  SERIES_DEFINITIONS,
  buildCurrentEconomicIndicators,
  buildEconomicIndicators,
  collect,
  isEconomicIndicatorsPayload,
  parseOnsMonthlyCsv,
  parseOnsPublicationPage,
  publicationCurrent,
  rollingThreeMonthPeriod,
};
