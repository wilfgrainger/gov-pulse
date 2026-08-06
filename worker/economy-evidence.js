import { fetchOfficialResponse } from "./official-source-fetch.js";
import { readResponseText } from "./response-limits.js";

const ONS_ORIGIN = "https://www.ons.gov.uk";
const GDP_BULLETIN_URL =
  `${ONS_ORIGIN}/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk/latest`;
const LABOUR_BULLETIN_URL =
  `${ONS_ORIGIN}/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest`;
const FINANCES_BULLETIN_URL =
  `${ONS_ORIGIN}/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/latest`;
const ONS_GENERATOR = `${ONS_ORIGIN}/generator?format=csv&uri=`;
const TEN_YEARS_MONTHLY = 120;

const GDP_SERIES = Object.freeze({
  index: Object.freeze({
    id: "ECY2",
    path: "/economy/grossdomesticproductgdp/timeseries/ecy2/mgdp",
  }),
  monthlyGrowth: Object.freeze({
    id: "ECYX",
    path: "/economy/grossdomesticproductgdp/timeseries/ecyx/mgdp",
  }),
  annualGrowth: Object.freeze({
    id: "ED2R",
    path: "/economy/grossdomesticproductgdp/timeseries/ed2r/mgdp",
  }),
  threeMonthGrowth: Object.freeze({
    id: "ED3H",
    path: "/economy/grossdomesticproductgdp/timeseries/ed3h/mgdp",
  }),
});

const LABOUR_SERIES = Object.freeze({
  employmentRate: Object.freeze({
    id: "LF24",
    path: "/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/timeseries/lf24/lms",
  }),
  unemploymentRate: Object.freeze({
    id: "MGSX",
    path: "/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
  }),
  inactivityRate: Object.freeze({
    id: "LF2S",
    path: "/employmentandlabourmarket/peoplenotinwork/economicinactivity/timeseries/lf2s/lms",
  }),
  vacancies: Object.freeze({
    id: "AP2Y",
    path: "/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/timeseries/ap2y/unem",
  }),
});

const RECEIPTS_SERIES = Object.freeze({
  id: "ANBV",
  path: "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/anbv/pusf",
});

const MONTHS = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function decodeHtml(value) {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&pound;|&#163;/gi, "£")
    .replace(/&minus;|&#8722;/gi, "-")
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/&rsquo;|&#8217;|&#39;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function requiredMatch(text, expression, label) {
  const match = text.match(expression);
  if (!match) {
    throw new Error(`ONS bulletin did not expose ${label}`);
  }
  return match;
}

function numeric(value, label) {
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse ${label}`);
  }
  return parsed;
}

function integer(value, label) {
  const parsed = Number.parseInt(String(value).replace(/,/g, ""), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse ${label}`);
  }
  return parsed;
}

function isoDate(value, label) {
  const match = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse ${label} '${value}'`);
  }
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])))
    .toISOString()
    .slice(0, 10);
}

function monthlyPeriodEnd(period) {
  const match = String(period).trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse monthly period '${period}'`);
  }
  return Date.UTC(Number(match[2]), month + 1, 0);
}

function parseCsvColumns(line) {
  const columns = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      columns.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  columns.push(current.trim());
  return columns;
}

function parseMonthlyOnsCsv(text) {
  const points = [];
  const seen = new Set();

  for (const line of String(text).split(/\r?\n/)) {
    const [rawPeriod, rawValue] = parseCsvColumns(line);
    const match = String(rawPeriod ?? "")
      .replace(/^"|"$/g, "")
      .trim()
      .toUpperCase()
      .match(/^(\d{4})\s+([A-Z]{3,4})$/);
    if (!match) continue;
    const month = MONTHS[match[2].toLowerCase()];
    const value = Number.parseFloat(String(rawValue ?? "").replace(/^"|"$/g, "").replace(/,/g, ""));
    if (month === undefined || !Number.isFinite(value)) continue;

    const period = `${match[1]} ${match[2]}`;
    if (seen.has(period)) throw new Error(`ONS series contains duplicate period '${period}'`);
    seen.add(period);
    points.push({
      period,
      observedAt: Date.UTC(Number(match[1]), month + 1, 0),
      value: Number(value.toFixed(4)),
    });
  }

  points.sort((left, right) => left.observedAt - right.observedAt);
  if (points.length === 0) throw new Error("ONS CSV did not expose monthly observations");
  return points;
}

async function fetchOnsSeries(definition, fetchImpl = fetch) {
  const response = await fetchOfficialResponse(`${ONS_GENERATOR}${definition.path}`, {
    accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
    fetchImpl,
    sourceName: `ONS ${definition.id}`,
  });
  return parseMonthlyOnsCsv(await readResponseText(response, { label: "ONS CSV" }));
}

function pointMap(points) {
  return new Map(points.map((point) => [point.period, point]));
}

function alignedPeriods(series, label) {
  const [first, ...rest] = series;
  const otherSets = rest.map(pointMap);
  const periods = first.filter((point) =>
    otherSets.every((points) => points.has(point.period))
  );
  if (periods.length === 0) {
    throw new Error(`${label} series did not expose aligned monthly observations`);
  }
  return periods.slice(-TEN_YEARS_MONTHLY);
}

function displayMonthlyPeriod(period) {
  const match = period.match(/^(\d{4})\s+([A-Z]{3})$/);
  if (!match) return period;
  const month = Object.entries(MONTHS).find(([, value]) => value === MONTHS[match[2].toLowerCase()])?.[0];
  return month ? `${month[0].toUpperCase()}${month.slice(1)} ${match[1]}` : period;
}

function annualDelta(points, transform = (value) => value) {
  if (points.length < 13) return null;
  return Number((transform(points.at(-1).value) - transform(points.at(-13).value)).toFixed(1));
}

function assertLatestPeriod(points, observedAt, label) {
  if (points.at(-1)?.observedAt !== observedAt) {
    throw new Error(`${label} time series does not align with the current bulletin period`);
  }
}

function assertClose(actual, expected, label, tolerance = 0.11) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} time series does not reconcile with the current bulletin headline`);
  }
}

function includeCurrentBulletinPoint(points, observedAt, value, label) {
  const latest = points.at(-1);
  if (!latest) throw new Error(`${label} time series is empty`);
  if (latest.observedAt === observedAt) {
    assertClose(latest.value, value, label, label === "Vacancies" ? 1 : 0.11);
    return points;
  }
  const lag = observedAt - latest.observedAt;
  if (lag <= 0 || lag > 35 * 24 * 60 * 60 * 1000) {
    throw new Error(`${label} time series does not align with the current bulletin period`);
  }
  assertClose(latest.value, value, label, label === "Vacancies" ? 1_000 : 0.11);
  const date = new Date(observedAt);
  const period = `${date.getUTCFullYear()} ${date
    .toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
    .toUpperCase()
    .replace("SEPT", "SEP")}`;
  return [...points, { period, observedAt, value }];
}

function rollingPeriodEnd(period) {
  const match = String(period).trim().match(/to\s+([A-Za-z]+)\s+(\d{4})$/i);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse rolling period '${period}'`);
  }
  return Date.UTC(Number(match[2]), month + 1, 0);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function discoverLatestBulletinUrl(html, landingUrl) {
  const landingPath = new URL(landingUrl).pathname
    .replace(/\/latest\/?$/i, "")
    .replace(/\/$/, "");
  const normalized = String(html)
    .replace(/&amp;/gi, "&")
    .replace(/%2F/gi, "/")
    .replace(/%3A/gi, ":");
  const pattern = new RegExp(
    `(?:https:\\/\\/www\\.ons\\.gov\\.uk)?(${escapeRegExp(landingPath)}\\/[a-z0-9-]+)`,
    "gi"
  );
  const match = pattern.exec(normalized);
  if (!match) {
    throw new Error(`ONS landing page did not expose a latest bulletin for ${landingUrl}`);
  }
  return new URL(match[1], ONS_ORIGIN).toString();
}

async function fetchOfficialPage(url, fetchImpl = fetch) {
  const response = await fetchOfficialResponse(url, {
    accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
    fetchImpl,
    sourceName: "ONS",
  });
  return { html: await readResponseText(response, { label: "ONS bulletin" }), finalUrl: response.url || url };
}

async function fetchLatestOnsBulletin(landingUrl, fetchImpl = fetch) {
  const landing = await fetchOfficialPage(landingUrl, fetchImpl);
  const landingPath = new URL(landingUrl).pathname.replace(/\/$/, "");
  const collectionPath = landingPath.replace(/\/latest$/i, "");
  const finalPath = new URL(landing.finalUrl).pathname.replace(/\/$/, "");

  if (finalPath !== landingPath && finalPath.startsWith(`${collectionPath}/`)) {
    return landing;
  }

  const latestUrl = discoverLatestBulletinUrl(landing.html, landingUrl);
  return fetchOfficialPage(latestUrl, fetchImpl);
}

function parseReleaseDate(text) {
  return isoDate(
    requiredMatch(text, /Release date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i, "release date")[1],
    "release date"
  );
}

function signedChange(text, noChangeExpression, changeExpression, label) {
  if (noChangeExpression.test(text)) {
    return 0;
  }
  const match = requiredMatch(text, changeExpression, label);
  const value = numeric(match[2], label);
  return /fall|fell|decreas|contract/i.test(match[1]) ? -value : value;
}

function parseGdpBulletin(html, finalUrl = GDP_BULLETIN_URL) {
  const text = decodeHtml(html);
  const period = requiredMatch(
    text,
    /GDP monthly estimate, UK:\s*([A-Za-z]+\s+\d{4})/i,
    "GDP period"
  )[1];
  const monthlyGrowth = signedChange(
    text,
    /Monthly real GDP is estimated to have shown no growth/i,
    /Monthly real GDP is estimated to have\s+(grown|increased|fallen|decreased|contracted)\s+by\s+([\d.]+)%/i,
    "monthly GDP growth"
  );
  const threeMonthGrowth = signedChange(
    text,
    /(?:Real gross domestic product \(GDP\)|GDP) is estimated to have shown no growth in the three months to/i,
    /(?:Real gross domestic product \(GDP\)|GDP) is estimated to have\s+(grown|increased|fallen|decreased|contracted)\s+by\s+([\d.]+)%\s+in the three months to/i,
    "three-month GDP growth"
  );

  return {
    available: true,
    headline: {
      period,
      observedAt: monthlyPeriodEnd(period),
      releaseDate: parseReleaseDate(text),
      monthlyGrowth,
      threeMonthGrowth,
    },
    methodology: {
      measure: "Real gross domestic product, seasonally adjusted",
      status: "Official statistics",
      revisionNote:
        "Monthly GDP is an early estimate and is revised as fuller source data become available.",
    },
    source: {
      bulletinUrl: finalUrl,
      landingUrl: GDP_BULLETIN_URL,
    },
  };
}

function parseLabourBulletin(html, finalUrl = LABOUR_BULLETIN_URL) {
  const text = decodeHtml(html);
  const periodPattern = "([A-Za-z]+(?:\\s+\\d{4})?\\s+to\\s+[A-Za-z]+\\s+\\d{4})";
  function rateMatch(subject, label) {
    const current = text.match(
      new RegExp(`${subject}[^.]*?was estimated at\\s+([\\d.]+)%\\s+in\\s+${periodPattern}`, "i")
    );
    if (current) return { value: current[1], period: current[2] };
    const legacy = text.match(
      new RegExp(`${subject}\\s+for\\s+${periodPattern}[^.]*?estimated at\\s+([\\d.]+)%`, "i")
    );
    if (legacy) return { value: legacy[2], period: legacy[1] };
    throw new Error(`ONS bulletin did not expose ${label}`);
  }

  const employment = rateMatch("UK employment rate", "employment rate");
  const unemployment = rateMatch("UK unemployment rate", "unemployment rate");
  const inactivity = rateMatch(
    "UK economic inactivity rate",
    "economic inactivity rate"
  );
  const vacanciesCurrent = text.match(
    new RegExp(
      `Early estimates for\\s+${periodPattern}.{0,240}?\\bto\\s+([\\d,]+),\\s+compared`,
      "i"
    )
  );
  const vacanciesLegacy = text.match(
    new RegExp(`estimated number of vacancies in the UK economy(?:\\s+in|\\s+for)?\\s+${periodPattern}[^.]*?was(?: estimated at)?\\s+([\\d,]+)`, "i")
  );
  const vacancies = vacanciesCurrent
    ? { period: vacanciesCurrent[1], value: vacanciesCurrent[2] }
    : vacanciesLegacy
      ? { period: vacanciesLegacy[1], value: vacanciesLegacy[2] }
      : null;
  if (!vacancies) throw new Error("ONS bulletin did not expose vacancies");

  const period = employment.period;
  if (unemployment.period !== period || inactivity.period !== period) {
    throw new Error("ONS labour-market headline periods do not align");
  }

  return {
    available: true,
    headline: {
      period,
      observedAt: rollingPeriodEnd(period),
      releaseDate: parseReleaseDate(text),
      employmentRate: numeric(employment.value, "employment rate"),
      unemploymentRate: numeric(unemployment.value, "unemployment rate"),
      inactivityRate: numeric(inactivity.value, "economic inactivity rate"),
      vacancies: integer(vacancies.value, "vacancies"),
      vacanciesPeriod: vacancies.period,
    },
    methodology: {
      status: "Official statistics",
      caveat:
        "Labour Force Survey rates use rolling three-month periods and carry sampling uncertainty. Vacancy estimates use a separate business survey and have their own rolling period.",
    },
    source: {
      bulletinUrl: finalUrl,
      landingUrl: LABOUR_BULLETIN_URL,
    },
  };
}

function parseFinancesBulletin(html, finalUrl = FINANCES_BULLETIN_URL) {
  const text = decodeHtml(html);
  const titlePeriod = requiredMatch(
    text,
    /Public sector finances, UK:\s*([A-Za-z]+\s+\d{4})/i,
    "public-finances period"
  )[1];
  const receiptsMatch = requiredMatch(
    text,
    /Central government(?:'s)? receipts were(?: estimated to be)?\s+£([\d.]+)\s+billion in\s+([A-Za-z]+\s+\d{4}),\s+(?:which was\s+)?£([\d.]+)\s+billion(?:\s+\([\d.]+%\))?\s+(more|less)\s+than/i,
    "central government receipts"
  );
  if (receiptsMatch[2] !== titlePeriod) {
    throw new Error("ONS public-finances receipt period does not match the bulletin period");
  }
  const yearChange = numeric(receiptsMatch[3], "annual receipts change");

  return {
    available: true,
    headline: {
      period: titlePeriod,
      observedAt: monthlyPeriodEnd(titlePeriod),
      releaseDate: parseReleaseDate(text),
      receiptsBillion: numeric(receiptsMatch[1], "central government receipts"),
      yearChangeBillion: receiptsMatch[4].toLowerCase() === "less" ? -yearChange : yearChange,
    },
    methodology: {
      measure: "Central government receipts",
      status: "Official statistics",
      caveat:
        "This ONS public-sector-finance measure is not the same as a tax forecast, tax-burden ratio or category-by-category HMRC receipts table.",
    },
    source: {
      bulletinUrl: finalUrl,
      landingUrl: FINANCES_BULLETIN_URL,
    },
  };
}

async function buildGdpTracker(fetchImpl = fetch) {
  const response = await fetchLatestOnsBulletin(GDP_BULLETIN_URL, fetchImpl);
  const parsed = parseGdpBulletin(response.html, response.finalUrl);
  const index = await fetchOnsSeries(GDP_SERIES.index, fetchImpl);
  const monthlyGrowth = await fetchOnsSeries(GDP_SERIES.monthlyGrowth, fetchImpl);
  const annualGrowth = await fetchOnsSeries(GDP_SERIES.annualGrowth, fetchImpl);
  const threeMonthGrowth = await fetchOnsSeries(GDP_SERIES.threeMonthGrowth, fetchImpl);
  const periods = alignedPeriods(
    [index, monthlyGrowth, annualGrowth, threeMonthGrowth],
    "ONS GDP"
  );
  const indexByPeriod = pointMap(index);
  const monthlyByPeriod = pointMap(monthlyGrowth);
  const annualByPeriod = pointMap(annualGrowth);
  const threeMonthByPeriod = pointMap(threeMonthGrowth);
  assertLatestPeriod(periods, parsed.headline.observedAt, "ONS GDP");
  assertClose(monthlyByPeriod.get(periods.at(-1).period).value, parsed.headline.monthlyGrowth, "Monthly GDP");
  assertClose(
    threeMonthByPeriod.get(periods.at(-1).period).value,
    parsed.headline.threeMonthGrowth,
    "Three-month GDP"
  );

  return {
    ...parsed,
    headline: {
      ...parsed.headline,
      annualGrowth: annualByPeriod.get(periods.at(-1).period).value,
    },
    history: periods.map((point) => ({
      period: displayMonthlyPeriod(point.period),
      observedAt: point.observedAt,
      index: indexByPeriod.get(point.period).value,
      monthlyGrowth: monthlyByPeriod.get(point.period).value,
      annualGrowth: annualByPeriod.get(point.period).value,
      threeMonthGrowth: threeMonthByPeriod.get(point.period).value,
    })),
    series: Object.fromEntries(
      Object.entries(GDP_SERIES).map(([key, definition]) => [
        key,
        {
          id: definition.id,
          url: `${ONS_ORIGIN}${definition.path}`,
        },
      ])
    ),
  };
}

async function buildEmploymentStats(fetchImpl = fetch) {
  const response = await fetchLatestOnsBulletin(LABOUR_BULLETIN_URL, fetchImpl);
  const parsed = parseLabourBulletin(response.html, response.finalUrl);
  const employment = includeCurrentBulletinPoint(
    await fetchOnsSeries(LABOUR_SERIES.employmentRate, fetchImpl),
    parsed.headline.observedAt,
    parsed.headline.employmentRate,
    "Employment rate"
  );
  const unemployment = includeCurrentBulletinPoint(
    await fetchOnsSeries(LABOUR_SERIES.unemploymentRate, fetchImpl),
    parsed.headline.observedAt,
    parsed.headline.unemploymentRate,
    "Unemployment rate"
  );
  const inactivity = includeCurrentBulletinPoint(
    await fetchOnsSeries(LABOUR_SERIES.inactivityRate, fetchImpl),
    parsed.headline.observedAt,
    parsed.headline.inactivityRate,
    "Inactivity rate"
  );
  const vacanciesObservedAt = rollingPeriodEnd(parsed.headline.vacanciesPeriod);
  const vacancies = includeCurrentBulletinPoint(
    (await fetchOnsSeries(LABOUR_SERIES.vacancies, fetchImpl)).map((point) => ({
      ...point,
      value: Math.round(point.value * 1_000),
    })),
    vacanciesObservedAt,
    parsed.headline.vacancies,
    "Vacancies"
  );
  const labourPeriods = alignedPeriods(
    [employment, unemployment, inactivity],
    "ONS labour-market"
  );
  const employmentByPeriod = pointMap(employment);
  const unemploymentByPeriod = pointMap(unemployment);
  const inactivityByPeriod = pointMap(inactivity);
  assertLatestPeriod(labourPeriods, parsed.headline.observedAt, "ONS labour-market");

  return {
    ...parsed,
    annualDelta: {
      employmentRatePoints: annualDelta(employment),
      unemploymentRatePoints: annualDelta(unemployment),
      inactivityRatePoints: annualDelta(inactivity),
      vacancies: annualDelta(vacancies),
    },
    history: {
      labourForce: labourPeriods.map((point) => ({
        period: displayMonthlyPeriod(point.period),
        observedAt: point.observedAt,
        employmentRate: employmentByPeriod.get(point.period).value,
        unemploymentRate: unemploymentByPeriod.get(point.period).value,
        inactivityRate: inactivityByPeriod.get(point.period).value,
      })),
      vacancies: vacancies.slice(-TEN_YEARS_MONTHLY).map((point) => ({
        period: displayMonthlyPeriod(point.period),
        observedAt: point.observedAt,
        vacancies: Math.round(point.value),
      })),
    },
    series: Object.fromEntries(
      Object.entries(LABOUR_SERIES).map(([key, definition]) => [
        key,
        { id: definition.id, url: `${ONS_ORIGIN}${definition.path}` },
      ])
    ),
  };
}

async function buildTaxRevenue(fetchImpl = fetch) {
  const response = await fetchLatestOnsBulletin(FINANCES_BULLETIN_URL, fetchImpl);
  const parsed = parseFinancesBulletin(response.html, response.finalUrl);
  const receipts = await fetchOnsSeries(RECEIPTS_SERIES, fetchImpl);
  assertLatestPeriod(receipts, parsed.headline.observedAt, "ONS receipts");
  assertClose(
    receipts.at(-1).value / 1_000,
    parsed.headline.receiptsBillion,
    "Central-government receipts"
  );
  const history = receipts.slice(-TEN_YEARS_MONTHLY).map((point) => ({
    period: displayMonthlyPeriod(point.period),
    observedAt: point.observedAt,
    receiptsBillion: Number((point.value / 1_000).toFixed(1)),
  }));

  return {
    ...parsed,
    history,
    series: {
      receipts: RECEIPTS_SERIES.id,
      url: `${ONS_ORIGIN}${RECEIPTS_SERIES.path}`,
    },
  };
}

export {
  FINANCES_BULLETIN_URL,
  GDP_BULLETIN_URL,
  LABOUR_BULLETIN_URL,
  buildEmploymentStats,
  buildGdpTracker,
  buildTaxRevenue,
  discoverLatestBulletinUrl,
  fetchLatestOnsBulletin,
  parseFinancesBulletin,
  parseGdpBulletin,
  parseLabourBulletin,
  parseMonthlyOnsCsv,
};
