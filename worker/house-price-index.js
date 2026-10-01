import { fetchOfficialText } from "./official-source-fetch.js";

const BULLETIN_BASE_URL =
  "https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk";
const BULLETIN_LATEST_URL = `${BULLETIN_BASE_URL}/latest`;

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
    .replace(/&minus;|&#8722;/gi, "-")
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/&rsquo;|&#8217;|&#39;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function matchRequired(text, expression, label) {
  const match = text.match(expression);
  if (!match) {
    throw new Error(`ONS house price index bulletin did not expose ${label}`);
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

function isoDate(value, label) {
  const match = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse ${label} '${value}'`);
  }
  const parsed = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  if (
    parsed.getUTCFullYear() !== Number(match[3]) ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== Number(match[1])
  ) {
    throw new Error(`Unable to parse ${label} '${value}'`);
  }
  return parsed.toISOString().slice(0, 10);
}

function monthlyPeriodEnd(period) {
  const match = String(period).trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse house price index period '${period}'`);
  }
  return Date.UTC(Number(match[2]), month + 1, 0);
}

function normalizeMonthlyPeriod(period) {
  // The chart download link's history CSV has been observed abbreviating the
  // month ("Jul 2026"); normalize anyway so a fully-spelled month compares
  // equal with the bulletin's own period.
  const match = String(period).trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return String(period).trim();
  const month = MONTHS[match[1].toLowerCase()];
  if (month === undefined) return String(period).trim();
  const shortNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${shortNames[month]} ${match[2]}`;
}

async function fetchOfficialPage(url, fetchImpl = fetch) {
  return {
    html: await fetchOfficialText(url, { fetchImpl, sourceName: "ONS" }),
  };
}

function editionFromCanonical(html) {
  const canonical = String(html).match(
    /rel="canonical"\s+href="[^"]*\/privaterentandhousepricesuk\/([a-z0-9]+)"/i
  );
  return canonical ? canonical[1].toLowerCase() : null;
}

function discoverLatestEdition(html) {
  // ONS serves the current edition's content directly at the /latest alias
  // without an HTTP redirect (confirmed live for this bulletin), so the dated
  // edition slug must be read from the page itself (the canonical link).
  const canonical = editionFromCanonical(html);
  if (canonical) {
    return canonical;
  }

  const visibleText = decodeHtml(html);
  const titleEdition = visibleText.match(
    /Private rent and house prices, UK:\s*([A-Za-z]+\s+\d{4})/i
  );
  if (titleEdition) {
    const match = titleEdition[1].trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (match && MONTHS[match[1].toLowerCase()] !== undefined) {
      return `${match[1].toLowerCase()}${match[2]}`;
    }
  }

  throw new Error("ONS house price index bulletin did not expose a latest edition");
}

async function fetchLatestHousePriceIndexBulletin(fetchImpl = fetch) {
  const landing = await fetchOfficialPage(BULLETIN_LATEST_URL, fetchImpl);
  const edition = discoverLatestEdition(landing.html);
  return {
    html: landing.html,
    finalUrl: `${BULLETIN_BASE_URL}/${edition}`,
    edition,
  };
}

function discoverHousePriceIndexChartUrl(html, bulletinUrl) {
  // Anchor on the stable "Download this chart" label (the figure number and
  // title live in an adjacent visually-hidden span, not inline with the
  // label text, so match the label alone and take its FIRST occurrence —
  // Figure 1 is always the chart nearest the top of the bulletin). This is
  // stable across editions, unlike the chart's own caption text.
  const markup = String(html);
  const marker = markup.search(/Download this chart/i);
  if (marker === -1) {
    throw new Error("ONS house price index bulletin did not expose the Figure 1 download link");
  }
  const window = markup.slice(marker, marker + 2000);
  const match = window.match(
    /href="([^"]*\/generator\?uri=[^"]*&(?:amp;)?format=csv)"/i
  );
  if (!match) {
    throw new Error("ONS house price index bulletin did not expose the Figure 1 CSV download link");
  }
  return new URL(decodeHtml(match[1]).replace(/&amp;/gi, "&"), bulletinUrl).toString();
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

function parseHpiHistoryCsv(text) {
  const rows = String(text).trim().split(/\r?\n/);
  const headerIndex = rows.findIndex(
    (row) => parseCsvColumns(row)[0]?.replace(/^"|"$/g, "").trim() === "Date"
  );
  if (headerIndex === -1) {
    throw new Error("ONS house price index history CSV did not expose a Date header row");
  }
  const headings = parseCsvColumns(rows[headerIndex]).map((heading) =>
    heading.replace(/^"|"$/g, "").trim()
  );
  const index = Object.fromEntries(headings.map((heading, position) => [heading, position]));
  const required = ["Date", "PIPR", "UK HPI"];
  if (!required.every((heading) => Number.isInteger(index[heading]))) {
    throw new Error("ONS house price index history CSV did not expose the required columns");
  }

  const history = [];
  const seen = new Set();
  for (const row of rows.slice(headerIndex + 1)) {
    const columns = parseCsvColumns(row).map((value) => value.replace(/^"|"$/g, "").trim());
    const rawPeriod = columns[index.Date];
    if (!rawPeriod || !/^[A-Za-z]+\s+\d{4}$/.test(rawPeriod)) continue;
    // UK HPI lags PIPR by one to two months and is blank for the most recent
    // rows; skip those rather than treat the last CSV row as the latest HPI.
    const rawHpi = columns[index["UK HPI"]];
    if (!rawHpi) continue;
    const hpiChangePercent = Number.parseFloat(rawHpi);
    if (!Number.isFinite(hpiChangePercent)) continue;
    const period = normalizeMonthlyPeriod(rawPeriod);
    if (seen.has(period)) {
      throw new Error(`ONS house price index history contains duplicate period '${period}'`);
    }
    seen.add(period);
    history.push({
      period,
      observedAt: monthlyPeriodEnd(period),
      hpiChangePercent,
    });
  }
  if (history.length < 2) {
    throw new Error("ONS house price index history did not expose comparable observations");
  }
  history.sort((left, right) => left.observedAt - right.observedAt);
  return history.slice(-120);
}

function parseHpiBulletin(html, edition) {
  const text = decodeHtml(html);
  const releaseDate = matchRequired(
    text,
    /Release date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    "release date"
  )[1];
  const headlineMatch = matchRequired(
    text,
    /Average UK house prices increased by\s+([\d.]+)%,\s+to\s+£([\d,]+),\s+in the 12 months to\s+([A-Za-z]+\s+\d{4})/i,
    "house price headline"
  );
  // Anchor the "previous period" sentence to the text AFTER the house-price
  // headline match, not a bare global search — the bulletin's private-rent
  // headline a paragraph earlier also reads "...annual growth rate is up/down
  // from X% in the 12 months to <month>", and an unanchored match picks up
  // that unrelated rent figure instead of the house-price one that follows it.
  const afterHeadline = text.slice(text.indexOf(headlineMatch[0]) + headlineMatch[0].length);
  const previousMatch = matchRequired(
    afterHeadline,
    /^(?:\s*\([^)]*\))?\s*;?\s*this annual growth rate is (?:up|down) from\s+([\d.]+)%\s+in the 12 months to\s+([A-Za-z]+\s+\d{4})/i,
    "previous house price annual growth"
  );

  const period = normalizeMonthlyPeriod(headlineMatch[3]);
  const changePercent = numeric(headlineMatch[1], "house price annual change");
  const avgPriceGbp = Number.parseInt(headlineMatch[2].replace(/,/g, ""), 10);
  if (!Number.isFinite(avgPriceGbp)) {
    throw new Error("Unable to parse house price index average price");
  }
  const previousPeriod = normalizeMonthlyPeriod(previousMatch[2]);
  const previousChangePercent = numeric(previousMatch[1], "previous house price annual change");

  return {
    headline: {
      period,
      observedAt: monthlyPeriodEnd(period),
      releaseDate: isoDate(releaseDate, "house price index release date"),
      avgPriceGbp,
      changePercent,
      previousPeriod,
      previousChangePercent,
    },
    methodology: {
      measure: "UK House Price Index (HPI), average house price annual percentage change",
      status: "Official statistics",
      revisionNote:
        "UK HPI first estimates are provisional and subject to revision as later transaction data is incorporated; price levels are headline-only and are not carried into the %-change history.",
    },
    source: {
      edition,
      bulletinUrl: `${BULLETIN_BASE_URL}/${edition}`,
    },
  };
}

async function buildHousePriceIndex(fetchImpl = fetch) {
  const bulletin = await fetchLatestHousePriceIndexBulletin(fetchImpl);
  const parsed = parseHpiBulletin(bulletin.html, bulletin.edition);
  const chartUrl = discoverHousePriceIndexChartUrl(bulletin.html, bulletin.finalUrl);
  const historyText = await fetchOfficialText(chartUrl, {
    accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
    fetchImpl,
    sourceName: "ONS",
  });
  const history = parseHpiHistoryCsv(historyText);
  const latest = history.at(-1);
  if (
    latest.period !== parsed.headline.period ||
    latest.hpiChangePercent !== parsed.headline.changePercent
  ) {
    throw new Error("ONS house price index history does not reconcile with the current bulletin headline");
  }

  return {
    ...parsed,
    history,
    source: {
      ...parsed.source,
      historyUrl: chartUrl,
    },
  };
}

export {
  BULLETIN_BASE_URL,
  BULLETIN_LATEST_URL,
  buildHousePriceIndex,
  discoverHousePriceIndexChartUrl,
  discoverLatestEdition,
  fetchLatestHousePriceIndexBulletin,
  parseHpiBulletin,
  parseHpiHistoryCsv,
};
