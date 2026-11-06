// Helpers shared by the ONS economy feeds (gdp, employment, tax) and the other
// feeds that read ONS bulletins and time-series CSVs. Moved verbatim from
// worker/economy-evidence.js; only the byte-identical parseCsvColumns is
// replaced by the shared kit copy. decodeHtml (decodes &pound;) and isoDate
// (no calendar check) deliberately differ from the kit versions and stay here.
import { fetchOfficialResponse } from "../../worker/official-source-fetch.js";
import { readResponseText } from "../../worker/response-limits.js";
import { parseCsvColumns } from "./csv.js";

const ONS_ORIGIN = "https://www.ons.gov.uk";

const ONS_GENERATOR = `${ONS_ORIGIN}/generator?format=csv&uri=`;

const TEN_YEARS_MONTHLY = 120;

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

function parseRollingThreeMonthOnsCsv(text) {
  const points = [];
  const seen = new Set();

  for (const line of String(text).split(/\r?\n/)) {
    const [rawPeriod, rawValue] = parseCsvColumns(line);
    const match = String(rawPeriod ?? "")
      .replace(/^"|"$/g, "")
      .trim()
      .toUpperCase()
      .match(/^(\d{4})\s+([A-Z]{3,4})-([A-Z]{3,4})$/);
    if (!match) continue;

    const startMonth = MONTHS[match[2].toLowerCase()];
    const endMonth = MONTHS[match[3].toLowerCase()];
    const value = Number.parseFloat(
      String(rawValue ?? "").replace(/^"|"$/g, "").replace(/,/g, "")
    );
    if (
      startMonth === undefined ||
      endMonth === undefined ||
      (endMonth - startMonth + 12) % 12 !== 2 ||
      !Number.isFinite(value)
    ) {
      continue;
    }

    const period = `${match[1]} ${match[2]}-${match[3]}`;
    if (seen.has(period)) throw new Error(`ONS series contains duplicate period '${period}'`);
    seen.add(period);
    points.push({
      period,
      observedAt: Date.UTC(Number(match[1]), endMonth + 1, 0),
      value: Number(value.toFixed(4)),
    });
  }

  points.sort((left, right) => left.observedAt - right.observedAt);
  if (points.length === 0) {
    // Some ONS series label a rolling three-month estimate by its centre month.
    // Convert that month to the corresponding observation window before joining
    // series and comparing the latest point with the bulletin headline.
    return parseMonthlyOnsCsv(text).map((point) => {
      const centre = new Date(point.observedAt);
      const year = centre.getUTCFullYear();
      const month = centre.getUTCMonth();
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month + 1, 1));
      const code = (date) => date.toLocaleString("en-GB", {
        month: "short", timeZone: "UTC",
      }).toUpperCase().replace("SEPT", "SEP");
      return {
        period: `${end.getUTCFullYear()} ${code(start)}-${code(end)}`,
        observedAt: Date.UTC(year, month + 2, 0),
        value: point.value,
      };
    });
  }
  return points;
}

async function fetchOnsSeries(
  definition,
  fetchImpl = fetch,
  parseSeries = parseMonthlyOnsCsv
) {
  const response = await fetchOfficialResponse(`${ONS_GENERATOR}${definition.path}`, {
    accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
    fetchImpl,
    sourceName: `ONS ${definition.id}`,
  });
  return parseSeries(await readResponseText(response, { label: "ONS CSV" }));
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

export {
  MONTHS,
  ONS_GENERATOR,
  ONS_ORIGIN,
  TEN_YEARS_MONTHLY,
  alignedPeriods,
  annualDelta,
  assertClose,
  assertLatestPeriod,
  decodeHtml,
  discoverLatestBulletinUrl,
  displayMonthlyPeriod,
  escapeRegExp,
  fetchLatestOnsBulletin,
  fetchOfficialPage,
  fetchOnsSeries,
  includeCurrentBulletinPoint,
  integer,
  isoDate,
  monthlyPeriodEnd,
  numeric,
  parseMonthlyOnsCsv,
  parseReleaseDate,
  parseRollingThreeMonthOnsCsv,
  pointMap,
  requiredMatch,
  rollingPeriodEnd,
  signedChange,
};
