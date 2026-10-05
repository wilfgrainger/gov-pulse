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

  for (let index = 0; index \u003c line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted \u0026\u0026 line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," \u0026\u0026 !quoted) {
      columns.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  columns.push(current.trim());
  return columns;
}
