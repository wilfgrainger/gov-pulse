import { fetchOfficialText as fetchSourceText } from "./official-source-fetch.js";

const ONS_ORIGIN = "https://www.ons.gov.uk";
const ONS_GENERATOR = `${ONS_ORIGIN}/generator?format=csv&uri=`;
const DEBT_SERIES_PATH = "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf";
const DEBT_GDP_SERIES_PATH = "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf";
const DEBT_SERIES_URL = `${ONS_ORIGIN}${DEBT_SERIES_PATH}`;
const DEBT_GDP_SERIES_URL = `${ONS_ORIGIN}${DEBT_GDP_SERIES_PATH}`;
const TEN_YEARS_MONTHLY = 120;

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
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
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
  const debtPoints = parseMonthlyOnsCsv(debtText);
  const debtGdpPoints = parseMonthlyOnsCsv(debtGdpText);
  const debt = latestPoint(debtPoints, "ONS HF6W");
  const debtToGdp = latestPoint(debtGdpPoints, "ONS HF6X");

  if (debt.period !== debtToGdp.period) {
    throw new Error(
      `ONS national debt series periods do not align: HF6W ${debt.period}, HF6X ${debtToGdp.period}`
    );
  }
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
    publicationDate: parseOnsReleaseDate(debtPage),
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
  buildNationalDebt,
  fetchOfficialCsv,
  fetchOfficialPage,
  parseMonthlyOnsCsv,
  parseOnsReleaseDate,
};
