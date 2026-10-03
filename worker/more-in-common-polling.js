import {
  absoluteUrl,
  fetchResponse,
  MAX_RESPONSE_BYTES,
  readResponseArrayBuffer,
  readResponseText,
} from "./live-feed-common.js";
import { workbookSheetCells } from "./xlsx-workbook.js";

const MORE_IN_COMMON_ARCHIVE_URL =
  "https://www.moreincommon.org.uk/polling-tables/?_polling_tables_type=voting-intention";
const MORE_IN_COMMON_POLL_HISTORY_LIMIT = 12;
const MONTH_NUMBER = Object.freeze({
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
});

function validIsoDate(year, monthName, day) {
  const month = MONTH_NUMBER[String(monthName).toLowerCase()];
  if (!month) throw new Error("More in Common workbook has an unknown fieldwork month");
  const date = new Date(Date.UTC(Number(year), month - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error("More in Common workbook has an invalid fieldwork date");
  }
  return date.toISOString().slice(0, 10);
}

function parseFieldworkRange(value) {
  const text = String(value ?? "").trim();
  const range = text.match(
    /^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})$/,
  );
  if (range) {
    const start = validIsoDate(range[4], range[3], range[1]);
    const end = validIsoDate(range[4], range[3], range[2]);
    if (start > end) throw new Error("More in Common fieldwork range is reversed");
    return { start, end };
  }

  const single = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})$/);
  if (single) {
    const date = validIsoDate(single[3], single[2], single[1]);
    return { start: date, end: date };
  }

  throw new Error("More in Common workbook did not disclose a supported fieldwork date range");
}

function parseMoreInCommonArchiveLinks(html) {
  const seen = new Set();
  const urls = [];
  for (const anchor of String(html).matchAll(/<a\b([^>]*)>/gi)) {
    const href = anchor[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const raw = href?.[1] ?? href?.[2];
    if (!raw || !/\.xlsx(?:$|[?#])/i.test(raw) || !/voting[-_ ]?intention/i.test(raw)) continue;

    let url;
    try {
      url = new URL(absoluteUrl(MORE_IN_COMMON_ARCHIVE_URL, raw));
    } catch {
      continue;
    }
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "www.moreincommon.org.uk" ||
      url.username ||
      url.password ||
      !/^\/wp-content\/uploads\/20\d{2}\/\d{2}\//i.test(url.pathname) ||
      !/\.xlsx$/i.test(url.pathname)
    ) continue;

    const canonical = url.toString();
    if (!seen.has(canonical)) {
      seen.add(canonical);
      urls.push(canonical);
    }
  }
  return urls.slice(0, MORE_IN_COMMON_POLL_HISTORY_LIMIT);
}

function numericCell(cells, reference, label) {
  const value = Number(cells.get(reference));
  if (!Number.isFinite(value)) throw new Error(`More in Common workbook is missing ${label}`);
  return value;
}

function sourceText(cells, reference, label) {
  const value = String(cells.get(reference) ?? "").trim();
  if (!value) throw new Error(`More in Common workbook is missing ${label}`);
  return value;
}

function partySharesFromHeadline(cells) {
  if (sourceText(cells, "B5", "the overall headline column") !== "All") {
    throw new Error("More in Common headline table did not expose the overall results column");
  }
  const partyKeys = new Map([
    ["conservative", "conservative"],
    ["labour", "labour"],
    ["liberal democrat", "liberalDemocrats"],
    ["reform uk", "reformUK"],
    ["restore britain", "restoreBritain"],
    ["the green party", "green"],
    ["scottish national party (snp)", "snp"],
    ["snp", "snp"],
    ["plaid cymru", "plaidCymru"],
    ["another party/independent candidate", "other"],
  ]);
  const parties = {};
  for (const [reference, label] of cells) {
    const row = reference.match(/^A(\d+)$/i);
    if (!row || Number(row[1]) < 6) continue;
    const key = partyKeys.get(String(label).trim().toLowerCase());
    if (!key) continue;
    const proportion = numericCell(cells, `B${row[1]}`, `${label} share`);
    if (proportion < 0 || proportion > 1) {
      throw new Error(`More in Common ${label} result is outside the proportion scale`);
    }
    if (key in parties) throw new Error(`More in Common headline repeats the ${label} party`);
    parties[key] = Number((proportion * 100).toFixed(1));
  }

  const required = ["conservative", "labour", "liberalDemocrats", "reformUK", "green"];
  if (required.some((key) => !(key in parties))) {
    throw new Error("More in Common headline is missing a major party result");
  }
  const total = Object.values(parties).reduce((sum, value) => sum + value, 0);
  if (total < 95 || total > 105) {
    throw new Error(`More in Common party results do not reconcile to approximately 100% (${total})`);
  }
  return parties;
}

function parseMoreInCommonPoll(coverCells, headlineCells, sourceUrl) {
  const fieldwork = parseFieldworkRange(coverCells.get("C5"));
  const sourceSample = numericCell(coverCells, "C6", "the cover sample size");
  const population = sourceText(coverCells, "C7", "the population description");
  const weighting = String(coverCells.get("C8") ?? "").trim();
  const uncertainty = String(coverCells.get("C9") ?? "").trim();
  const bpcDisclosure = String(coverCells.get("C12") ?? "");
  if (!/British Polling Council/i.test(bpcDisclosure)) {
    throw new Error("More in Common workbook did not confirm British Polling Council membership");
  }

  const baseRow = [...headlineCells.entries()].find(([, label]) =>
    /^unweighted\s+n$/i.test(String(label).trim()),
  )?.[0]?.match(/^A(\d+)$/i);
  if (!baseRow) throw new Error("More in Common headline table did not disclose its unweighted base");
  const headlineSample = numericCell(headlineCells, `B${baseRow[1]}`, "the headline unweighted base");
  if (!Number.isSafeInteger(headlineSample) || headlineSample < 500 || headlineSample > sourceSample) {
    throw new Error("More in Common headline sample is outside the disclosed survey sample");
  }

  const weightRow = [...headlineCells.entries()].find(([, label]) =>
    /^weight$/i.test(String(label).trim()),
  )?.[0]?.match(/^A(\d+)$/i);
  const weightName = weightRow ? String(headlineCells.get(`B${weightRow[1]}`) ?? "").trim() : "";
  if (!weightName || !weighting) {
    throw new Error("More in Common workbook did not disclose its headline weighting");
  }

  const geography = /\bGreat Britain\b|\bGB adults\b/i.test(population)
    ? "Great Britain"
    : "Not disclosed";
  if (geography === "Not disclosed") {
    throw new Error("More in Common workbook did not disclose a supported geography");
  }

  return {
    id: `more-in-common-${fieldwork.end}`,
    pollster: "More in Common",
    commissioner: null,
    title: `GB Voting Intention & Trackers, fieldwork ${fieldwork.start} to ${fieldwork.end}`,
    questionText: null,
    publicationDate: null,
    publicationDateStatus: "not-disclosed",
    fieldworkStart: fieldwork.start,
    fieldworkEnd: fieldwork.end,
    sampleSize: headlineSample,
    sampleSizeNote: `Unweighted N on the headline table; workbook cover reports ${sourceSample.toLocaleString("en-GB")} total respondents.`,
    geography,
    population,
    mode: null,
    headlineMethod: `Publisher-weighted voting-intention headline; the table names weight ${weightName}. Full weighting details: ${weighting}`,
    parties: partySharesFromHeadline(headlineCells),
    sourceUrl,
    methodologyUrl: MORE_IN_COMMON_ARCHIVE_URL,
    bpcMember: true,
    uncertainty: uncertainty || null,
  };
}

async function readMoreInCommonWorkbook(url, fetchImpl) {
  const response = await fetchResponse(
    url,
    fetchImpl,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const bytes = await readResponseArrayBuffer(response, {
    limit: MAX_RESPONSE_BYTES.workbook,
    label: "More in Common polling workbook",
  });
  const coverCells = await workbookSheetCells(bytes, /^Cover page$/i);
  const headlineCells = await workbookSheetCells(bytes, /^votingintention \(headline\)$/i);
  return parseMoreInCommonPoll(coverCells, headlineCells, url);
}

async function collectMoreInCommonPolls(fetchImpl = fetch) {
  const archiveResponse = await fetchResponse(MORE_IN_COMMON_ARCHIVE_URL, fetchImpl);
  const archiveHtml = await readResponseText(archiveResponse, {
    limit: MAX_RESPONSE_BYTES.text,
    label: "More in Common polling archive",
  });
  const urls = parseMoreInCommonArchiveLinks(archiveHtml);
  if (!urls.length) throw new Error("More in Common archive did not expose voting-intention workbooks");

  const outcomes = await Promise.allSettled(urls.map((url) => readMoreInCommonWorkbook(url, fetchImpl)));
  const polls = outcomes
    .filter((outcome) => outcome.status === "fulfilled")
    .map((outcome) => outcome.value)
    .sort((left, right) => right.fieldworkEnd.localeCompare(left.fieldworkEnd));
  if (!polls.length) throw new Error("More in Common archive workbooks could not be reconciled");
  if (!polls[0] || polls[0].sourceUrl !== urls[0]) {
    throw new Error("Newest More in Common source workbook could not be reconciled");
  }
  return {
    polls,
    archive: {
      requested: urls.length,
      validated: polls.length,
      unavailable: outcomes.filter((outcome) => outcome.status === "rejected").length,
      status: polls.length === urls.length ? "complete" : "partial",
    },
  };
}

export {
  MORE_IN_COMMON_ARCHIVE_URL,
  MORE_IN_COMMON_POLL_HISTORY_LIMIT,
  collectMoreInCommonPolls,
  parseFieldworkRange,
  parseMoreInCommonArchiveLinks,
  parseMoreInCommonPoll,
  readMoreInCommonWorkbook,
};
