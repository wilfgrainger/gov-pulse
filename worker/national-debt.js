import { fetchOfficialText as fetchSourceText } from "./official-source-fetch.js";
import { parseOnsNextReleaseDate } from "./ons-release-date.js";
import {
  FINANCES_BULLETIN_URL,
  fetchLatestOnsBulletin,
} from "./economy-evidence.js";

const ONS_ORIGIN = "https://www.ons.gov.uk";
const ONS_GENERATOR = `${ONS_ORIGIN}/generator?format=csv&uri=`;
const DEBT_SERIES_PATH = "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf";
const DEBT_GDP_SERIES_PATH = "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf";
const DEBT_SERIES_URL = `${ONS_ORIGIN}${DEBT_SERIES_PATH}`;
const DEBT_GDP_SERIES_URL = `${ONS_ORIGIN}${DEBT_GDP_SERIES_PATH}`;
const TEN_YEARS_MONTHLY = 120;
const BULLETIN_VALUE_TOLERANCE = 0.05;

const MONTHS = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const MONTH_NAMES = {
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

const MONTH_LABELS = [
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
];

function parseNumericValue(value) {
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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

  for (const line of String(text).split(/\r?\n/)) {
    const [rawPeriod, rawValue] = parseCsvColumns(line);
    const period = String(rawPeriod ?? "").trim().toUpperCase();
    const match = period.match(/^(\d{4})\s+([A-Z]{3})$/);
    const value = parseNumericValue(rawValue);

    if (!match || value === null || MONTHS[match[2]] === undefined) {
      continue;
    }

    const year = Number(match[1]);
    const month = MONTHS[match[2]];
    points.push({
      period,
      year,
      month,
      value,
      observedAt: Date.UTC(year, month + 1, 0),
    });
  }

  return points.sort((left, right) => left.observedAt - right.observedAt);
}

function decodeHtml(value) {
  return String(value)
    .replace(/\u003cscript\b[^\u003e]*\u003e[\s\S]*?\u003c\/script\u003e/gi, " ")
    .replace(/\u003cstyle\b[^\u003e]*\u003e[\s\S]*?\u003c\/style\u003e/gi, " ")
    .replace(/\u003c[^\u003e]+\u003e/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/&pound;|&#163;/gi, "£")
    .replace(/&minus;|&#8722;/gi, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOnsReleaseDate(html) {
  const text = decodeHtml(html);
  const match = text.match(/Release date:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  const month = match ? MONTH_NAMES[match[2].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error("ONS debt series page did not expose a release date");
  }
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  if (
    date.getUTCFullYear() !== Number(match[3]) ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== Number(match[1])
  ) {
    throw new Error("ONS debt series page exposed an invalid release date");
  }
  return date.toISOString().slice(0, 10);
}

function displayMonthlyPeriod(period) {
  const match = String(period).match(/^(\d{4})\s+([A-Z]{3})$/);
  const month = match ? MONTHS[match[2]] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to display ONS debt period '${period}'`);
  }
  return `${MONTH_LABELS[month]} ${match[1]}`;
}

function requiredMatch(text, expression, label) {
  const match = text.match(expression);
  if (!match) {
    throw new Error(`ONS public-finances bulletin did not expose ${label}`);
  }
  return match;
}

function assertClose(left, right, label) {
  if (Math.abs(Number(left) - Number(right)) > BULLETIN_VALUE_TOLERANCE) {
    throw new Error(
      `ONS ${label} does not reconcile with the public-finances bulletin: generator ${left}, bulletin ${right}`
    );
  }
}

function parseDebtBulletinCheck(html, finalUrl = FINANCES_BULLETIN_URL) {
  const text = decodeHtml(html);
  const titlePeriod = requiredMatch(
    text,
    /Public sector finances, UK:\s*([A-Za-z]+\s+\d{4})/i,
    "bulletin period"
  )[1];
  const debtMatch = requiredMatch(
    text,
    /Public sector net debt\b[\s\S]{0,240}?was provisionally estimated at\s+£([\d,.]+)\s+billion at the end of\s+([A-Za-z]+\s+\d{4})/i,
    "public sector net debt stock"
  );
  const ratioMatch = requiredMatch(
    text,
    /Debt at the end of\s+([A-Za-z]+\s+\d{4})\s+was equivalent to\s+([\d.]+)%\s+of GDP/i,
    "public sector net debt as a percentage of GDP"
  );
  if (debtMatch[2] !== titlePeriod || ratioMatch[1] !== titlePeriod) {
    throw new Error(
      "ONS public-finances debt period does not match the bulletin period"
    );
  }
  const debtBillion = parseNumericValue(debtMatch[1]);
  const debtToGdp = parseNumericValue(ratioMatch[2]);
  if (debtBillion === null || debtToGdp === null) {
    throw new Error("ONS public-finances bulletin exposed non-numeric debt figures");
  }
  const releaseDate = parseOnsReleaseDate(html);
  const nextReleaseDate = parseOnsNextReleaseDate(text);

  return {
    period: titlePeriod,
    debtBillion: Number(debtBillion.toFixed(1)),
    debtToGdp: Number(debtToGdp.toFixed(1)),
    releaseDate,
    ...(nextReleaseDate ? { nextReleaseDate } : {}),
    source: {
      bulletinUrl: finalUrl,
      landingUrl: FINANCES_BULLETIN_URL,
    },
  };
}

function reconcileDebtWithBulletin(debt, debtToGdp, seriesPublicationDate, seriesNextReleaseDate, bulletin) {
  const generatorPeriod = displayMonthlyPeriod(debt.period);
  if (generatorPeriod !== bulletin.period) {
    throw new Error(
      `ONS national debt generator period does not match the public-finances bulletin: HF6W ${debt.period}, bulletin ${bulletin.period}`
    );
  }
  assertClose(debt.value, bulletin.debtBillion, "HF6W debt stock");
  assertClose(debtToGdp.value, bulletin.debtToGdp, "HF6X debt-to-GDP");
  if (seriesPublicationDate !== bulletin.releaseDate) {
    throw new Error(
      `ONS debt release dates do not match: series page ${seriesPublicationDate}, bulletin ${bulletin.releaseDate}`
    );
  }
  if (
    seriesNextReleaseDate &&
    bulletin.nextReleaseDate &&
    seriesNextReleaseDate !== bulletin.nextReleaseDate
  ) {
    throw new Error(
      `ONS debt next-release dates do not match: series page ${seriesNextReleaseDate}, bulletin ${bulletin.nextReleaseDate}`
    );
  }
}

async function fetchOfficialText(url, accept, fetchImpl = fetch) {
  return fetchSourceText(url, {
    accept,
    fetchImpl,
    sourceName: "ONS",
  });
}

function fetchOfficialCsv(path, fetchImpl = fetch) {
  return fetchOfficialText(
    `${ONS_GENERATOR}${path}`,
    "text/csv,text/plain;q=0.9,*/*;q=0.8",
    fetchImpl
  );
}

function fetchOfficialPage(url, fetchImpl = fetch) {
  return fetchOfficialText(
    url,
    "text/html,text/plain;q=0.9,*/*;q=0.8",
    fetchImpl
  );
}

function latestPoint(points, label) {
  const point = points.at(-1);
  if (!point) throw new Error(`${label} did not contain a monthly observation`);
  return point;
}

async function buildNationalDebt(fetchImpl = fetch) {
  const debtText = await fetchOfficialCsv(DEBT_SERIES_PATH, fetchImpl);
  const debtGdpText = await fetchOfficialCsv(DEBT_GDP_SERIES_PATH, fetchImpl);
  const debtPage = await fetchOfficialPage(DEBT_SERIES_URL, fetchImpl);
  const bulletin = await fetchLatestOnsBulletin(FINANCES_BULLETIN_URL, fetchImpl);
  const debtPoints = parseMonthlyOnsCsv(debtText);
  const debtGdpPoints = parseMonthlyOnsCsv(debtGdpText);
  const debt = latestPoint(debtPoints, "ONS HF6W");
  const debtToGdp = latestPoint(debtGdpPoints, "ONS HF6X");
  const publicationDate = parseOnsReleaseDate(debtPage);
  const nextReleaseDate = parseOnsNextReleaseDate(decodeHtml(debtPage));
  const bulletinCheck = parseDebtBulletinCheck(bulletin.html, bulletin.finalUrl);

  if (debt.period !== debtToGdp.period) {
    throw new Error(
      `ONS national debt series periods do not align: HF6W ${debt.period}, HF6X ${debtToGdp.period}`
    );
  }

  reconcileDebtWithBulletin(
    debt,
    debtToGdp,
    publicationDate,
    nextReleaseDate,
    bulletinCheck
  );

  const debtByPeriod = new Map(debtPoints.map((point) => [point.period, point]));
  const aligned = debtGdpPoints
    .filter((point) => debtByPeriod.has(point.period))
    .slice(-TEN_YEARS_MONTHLY);
  if (aligned.length < 13 || aligned.at(-1).period !== debt.period) {
    throw new Error("ONS national debt series did not expose a comparable annual history");
  }
  const history = aligned.map((ratioPoint) => ({
    period: ratioPoint.period,
    observedAt: ratioPoint.observedAt,
    debtBillion: Number(debtByPeriod.get(ratioPoint.period).value.toFixed(1)),
    debtToGdp: Number(ratioPoint.value.toFixed(1)),
  }));
  const priorYear = history.at(-13);

  return {
    baseDebt: Math.round(debt.value * 1_000_000_000),
    baseDate: debt.observedAt,
    debtToGdp: Number(debtToGdp.value.toFixed(1)),
    observationPeriod: debt.period,
    publicationDate,
    nextReleaseDate,
    annualDelta: {
      debtBillion: Number((debt.value - priorYear.debtBillion).toFixed(1)),
      debtToGdpPoints: Number((debtToGdp.value - priorYear.debtToGdp).toFixed(1)),
    },
    history,
    revisionStatus:
      "Public-sector-finance estimates can be revised as source data and classifications are updated.",
    source: {
      publisher: "Office for National Statistics",
      debtUrl: DEBT_SERIES_URL,
      debtToGdpUrl: DEBT_GDP_SERIES_URL,
      bulletinUrl: bulletinCheck.source.bulletinUrl,
      landingUrl: bulletinCheck.source.landingUrl,
    },
    series: {
      debt: "HF6W",
      debtToGdp: "HF6X",
    },
  };
}

export {
  DEBT_GDP_SERIES_PATH,
  DEBT_GDP_SERIES_URL,
  DEBT_SERIES_PATH,
  DEBT_SERIES_URL,
  FINANCES_BULLETIN_URL,
  buildNationalDebt,
  fetchOfficialCsv,
  fetchOfficialPage,
  parseDebtBulletinCheck,
  parseMonthlyOnsCsv,
  parseOnsReleaseDate,
  reconcileDebtWithBulletin,
};
