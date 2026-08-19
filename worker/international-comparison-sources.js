import {
  MAX_RESPONSE_BYTES,
  fetchResponse,
  readResponseArrayBuffer,
  readResponseText,
} from "./live-feed-common.js";
import { extractPdfText } from "./live-polling-collector.js";

const IMF_DATAMAPPER = "https://www.imf.org/external/datamapper/api/v2";
const OECD_SDMX = "https://sdmx.oecd.org/public/rest/data";
const WORLD_BANK_API = "https://api.worldbank.org/v2";
const SIPRI_MILEX_2025_URL =
  "https://www.sipri.org/sites/default/files/2026-04/2604_milex_2025.pdf";

const COMPARISON_IDS = Object.freeze([
  "GBR", "USA", "CHN", "RUS", "UKR", "DEU", "FRA", "ITA", "ESP", "TUR", "NLD", "CHE", "POL",
]);
const OECD_COMPARABLE_IDS = Object.freeze([
  "GBR", "USA", "DEU", "FRA", "ITA", "ESP", "TUR", "NLD", "CHE", "POL",
]);
const COUNTRY_PATH = COMPARISON_IDS.join("/");
const WORLD_BANK_COUNTRIES = COMPARISON_IDS.join(";");
const OECD_COUNTRIES = OECD_COMPARABLE_IDS.join("+");

const SOURCE_QUERIES = Object.freeze({
  imfGdpPerCapita2023: `${IMF_DATAMAPPER}/NGDPDPC/${COUNTRY_PATH}?periods=2023`,
  imfGdpPerCapita2024: `${IMF_DATAMAPPER}/NGDPDPC/${COUNTRY_PATH}?periods=2024`,
  imfGdpPerCapita2026: `${IMF_DATAMAPPER}/NGDPDPC/${COUNTRY_PATH}?periods=2026`,
  imfDebtPctGdp2026: `${IMF_DATAMAPPER}/GGXWDG_NGDP/${COUNTRY_PATH}?periods=2026`,
  imfInterestPctGdp2024: `${IMF_DATAMAPPER}/ie@FPP/${COUNTRY_PATH}?periods=2024`,
  oecdOda2025: `${OECD_SDMX}/OECD.DCD.FSD,DSD_DAC1@DF_DAC1,1.7/${OECD_COUNTRIES}.1010..1160.USD.V._Z?startPeriod=2025&endPeriod=2025&dimensionAtObservation=AllDimensions`,
  oecdSocx2023: `${OECD_SDMX}/OECD.ELS.SPD,DSD_SOCX_AGG@DF_SOCX_AGG,1.0/${OECD_COUNTRIES}.A..PT_B1GQ.ES10._T._T.?startPeriod=2023&endPeriod=2023&dimensionAtObservation=AllDimensions`,
  oecdTax2024: `${OECD_SDMX}/OECD.CTP.TPS,DSD_REV_COMP_OECD@DF_RSOECD,/${OECD_COUNTRIES}..S13._T..PT_B1GQ.A?startPeriod=2024&endPeriod=2024&dimensionAtObservation=AllDimensions`,
  worldBankHealth2024: `${WORLD_BANK_API}/country/${WORLD_BANK_COUNTRIES}/indicator/SH.XPD.CHEX.PC.CD?date=2024&format=json&per_page=100`,
  sipriMilitary2025: SIPRI_MILEX_2025_URL,
});

const SIPRI_COUNTRY_IDS = Object.freeze({
  "United Kingdom": "GBR",
  "United States": "USA",
  China: "CHN",
  Russia: "RUS",
  Ukraine: "UKR",
  Germany: "DEU",
  France: "FRA",
  Italy: "ITA",
  Spain: "ESP",
  Türkiye: "TUR",
  Turkey: "TUR",
  Netherlands: "NLD",
  Switzerland: "CHE",
  Poland: "POL",
});
const SIPRI_COUNTRY_PATTERN = Object.keys(SIPRI_COUNTRY_IDS)
  .sort((left, right) => right.length - left.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

function finiteNumber(value) {
  if (value === null || value === undefined || value === "" || value === "..") return null;
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseImfSeries(payload, indicator, year) {
  const values = payload?.values?.[indicator];
  if (!values || typeof values !== "object") {
    throw new Error(`IMF DataMapper did not expose ${indicator}`);
  }
  const result = new Map();
  for (const country of COMPARISON_IDS) {
    if (!Object.prototype.hasOwnProperty.call(values, country)) continue;
    result.set(country, finiteNumber(values[country]?.[String(year)] ?? values[country]?.[year]));
  }
  return result;
}

function parseWorldBankSeries(payload, year) {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw new Error("World Bank API response was not an indicator result");
  }
  const result = new Map();
  for (const row of payload[1]) {
    const country = String(row?.countryiso3code ?? "").toUpperCase();
    if (!COMPARISON_IDS.includes(country) || Number(row?.date) !== year) continue;
    result.set(country, finiteNumber(row?.value));
  }
  return result;
}

function csvColumns(line) {
  const columns = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      columns.push(current.trim());
      current = "";
    } else current += character;
  }
  columns.push(current.trim());
  return columns;
}

function parseOecdCsvSeries(csv, year) {
  const lines = String(csv).split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("OECD SDMX response was empty");
  const headers = csvColumns(lines[0]).map((header) => header.replace(/^\uFEFF/, ""));
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  for (const required of ["REF_AREA", "TIME_PERIOD", "OBS_VALUE"]) {
    if (index[required] === undefined) throw new Error(`OECD SDMX response was missing ${required}`);
  }
  const result = new Map();
  for (const line of lines.slice(1)) {
    const row = csvColumns(line);
    const country = row[index.REF_AREA];
    if (!COMPARISON_IDS.includes(country) || Number(row[index.TIME_PERIOD]) !== year) continue;
    const raw = finiteNumber(row[index.OBS_VALUE]);
    const unitMultiplier = index.UNIT_MULT === undefined ? 0 : finiteNumber(row[index.UNIT_MULT]) ?? 0;
    result.set(country, raw === null ? null : raw * 10 ** unitMultiplier);
  }
  return result;
}

function parseOdaProfile(html, year) {
  const text = String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ");
  const expression = new RegExp(`provided\\s+USD\\s+([\\d.,]+)\\s+billion[^.]{0,120}ODA[^.]{0,120}in\\s+${year}`, "i");
  const match = text.match(expression);
  const billions = match ? finiteNumber(match[1]) : null;
  if (billions === null) throw new Error(`OECD profile did not expose comparable ODA for ${year}`);
  return billions * 1_000_000_000;
}

function parseSipriTop40Text(text) {
  const source = String(text).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const rows = new RegExp(
    `(?:^|\\s)(\\d{1,2})\\s+\\d{1,2}\\s+(${SIPRI_COUNTRY_PATTERN})\\s+\\[?([\\d,.]+)\\]?`,
    "gi"
  );
  const result = new Map();
  for (const match of source.matchAll(rows)) {
    const name = Object.keys(SIPRI_COUNTRY_IDS).find(
      (candidate) => candidate.toLowerCase() === match[2].toLowerCase()
    );
    const billions = finiteNumber(match[3]);
    if (!name || billions === null || billions <= 0) continue;
    result.set(SIPRI_COUNTRY_IDS[name], billions * 1_000_000_000);
  }
  if (result.size === 0) {
    throw new Error("SIPRI 2025 source did not expose comparison-country military expenditure");
  }
  return result;
}

function calculatePerResidentFromPercentGdp(percentGdp, gdpPerResident) {
  const percent = finiteNumber(percentGdp);
  const gdp = finiteNumber(gdpPerResident);
  if (percent === null || percent < 0 || percent > 500) throw new Error("percent of GDP input was invalid");
  if (gdp === null || gdp <= 0) throw new Error("GDP per resident input was invalid");
  return (percent / 100) * gdp;
}

function calculatePerResidentFromTotal(totalUsd, population) {
  const total = finiteNumber(totalUsd);
  const people = finiteNumber(population);
  if (total === null || total < 0) throw new Error("total USD input was invalid");
  if (people === null || people <= 0) throw new Error("population input was invalid");
  return total / people;
}

async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchResponse(url, fetchImpl, "application/json");
  const text = await readResponseText(response, { label: `${new URL(url).hostname} JSON` });
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${new URL(url).hostname} returned invalid JSON`);
  }
}

async function fetchText(url, fetchImpl = fetch, accept = "text/csv,text/plain;q=0.9") {
  const response = await fetchResponse(url, fetchImpl, accept);
  return readResponseText(response, { label: `${new URL(url).hostname} data` });
}

async function fetchImfSeries(indicator, year, fetchImpl = fetch) {
  const url = `${IMF_DATAMAPPER}/${encodeURIComponent(indicator)}/${COUNTRY_PATH}?periods=${year}`;
  return parseImfSeries(await fetchJson(url, fetchImpl), indicator, year);
}

async function fetchWorldBankSeries(indicator, year, fetchImpl = fetch) {
  const url = `${WORLD_BANK_API}/country/${WORLD_BANK_COUNTRIES}/indicator/${indicator}?date=${year}&format=json&per_page=100`;
  return parseWorldBankSeries(await fetchJson(url, fetchImpl), year);
}

async function fetchOecdSeries(url, year, fetchImpl = fetch) {
  return parseOecdCsvSeries(await fetchText(url, fetchImpl), year);
}

async function fetchSipri2025Series(fetchImpl = fetch) {
  const response = await fetchResponse(SIPRI_MILEX_2025_URL, fetchImpl, "application/pdf");
  const bytes = await readResponseArrayBuffer(response, {
    limit: MAX_RESPONSE_BYTES.pdf,
    label: "SIPRI 2025 military expenditure PDF",
  });
  return parseSipriTop40Text(await extractPdfText(bytes));
}

export {
  COMPARISON_IDS,
  IMF_DATAMAPPER,
  OECD_COMPARABLE_IDS,
  OECD_SDMX,
  SIPRI_MILEX_2025_URL,
  SOURCE_QUERIES,
  WORLD_BANK_API,
  calculatePerResidentFromPercentGdp,
  calculatePerResidentFromTotal,
  fetchImfSeries,
  fetchJson,
  fetchOecdSeries,
  fetchSipri2025Series,
  fetchText,
  fetchWorldBankSeries,
  parseImfSeries,
  parseOdaProfile,
  parseOecdCsvSeries,
  parseSipriTop40Text,
  parseWorldBankSeries,
};
