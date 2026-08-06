import {
  FINANCES_BULLETIN_URL,
  fetchLatestOnsBulletin,
  parseMonthlyOnsCsv,
} from "./economy-evidence.js";
import { fetchOfficialResponse } from "./official-source-fetch.js";
import { readResponseText } from "./response-limits.js";
import { sectionRecord } from "./live-feed-common.js";

const ONS_ORIGIN = "https://www.ons.gov.uk";
const RECEIPTS_SERIES = Object.freeze({
  id: "ANBV",
  path: "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/anbv/pusf",
});
const ONS_GENERATOR = `${ONS_ORIGIN}/generator?format=csv&uri=`;
const TEN_YEARS_MONTHLY = 120;
const MAX_AGE_DAYS = 70;
const MONTHS = Object.freeze({
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
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
});

function decodeHtml(value) {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&pound;|&#163;/gi, "£")
    .replace(/&minus;|&#8722;/gi, "-")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, "-")
    .replace(/&rsquo;|&#8217;|&#39;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function number(value, label) {
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) throw new Error(`Unable to parse ${label}`);
  return Number(parsed.toFixed(1));
}

function requiredMatch(text, expression, label) {
  const match = text.match(expression);
  if (!match) throw new Error(`ONS public-finances bulletin did not expose ${label}`);
  return match;
}

function isoDate(value, label) {
  const match = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || month === undefined) throw new Error(`Unable to parse ${label}`);
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  if (
    date.getUTCFullYear() !== Number(match[3]) ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== Number(match[1])
  ) {
    throw new Error(`Unable to parse ${label}`);
  }
  return date.toISOString().slice(0, 10);
}

function monthlyPeriodEnd(period) {
  const match = String(period).trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse monthly period '${period}'`);
  }
  return Date.UTC(Number(match[2]), month + 1, 0);
}

function currentTableReceipts(text, titlePeriod) {
  const start = text.search(/Table 2:\s*Central government receipts monthly summary/i);
  if (start < 0) return null;
  const segment = text.slice(start, start + 5_000);
  const comparison = requiredMatch(
    segment,
    /([A-Za-z]+\s+\d{4})\s+compared with\s+([A-Za-z]+\s+\d{4})/i,
    "monthly receipts comparison periods"
  );
  if (comparison[1] !== titlePeriod) {
    throw new Error("ONS public-finances receipt period does not match the bulletin period");
  }
  const row = requiredMatch(
    segment,
    /Total current central government receipts\s+(-?[\d,.]+)\s+(-?[\d,.]+)\s+(-?[\d,.]+)\s+(-?[\d,.]+)/i,
    "monthly total current central government receipts row"
  );
  const current = number(row[1], "central government receipts");
  const previous = number(row[2], "previous central government receipts");
  const difference = number(row[3], "annual receipts change");
  if (Math.abs(current - previous - difference) > 0.2) {
    throw new Error("ONS public-finances receipts row does not reconcile within rounding tolerance");
  }
  return { current, difference };
}

function legacyReceipts(text, titlePeriod) {
  const match = text.match(
    /Central government(?:'s)? receipts were(?: estimated to be)?\s+£([\d.]+)\s+billion in\s+([A-Za-z]+\s+\d{4}),\s+(?:which was\s+)?£([\d.]+)\s+billion(?:\s+\([\d.]+%\))?\s+(more|less)\s+than/i
  );
  if (!match) return null;
  if (match[2] !== titlePeriod) {
    throw new Error("ONS public-finances receipt period does not match the bulletin period");
  }
  const change = number(match[3], "annual receipts change");
  return {
    current: number(match[1], "central government receipts"),
    difference: match[4].toLowerCase() === "less" ? -change : change,
  };
}

function parseTaxRevenueBulletin(html, finalUrl = FINANCES_BULLETIN_URL) {
  const text = decodeHtml(html);
  const titlePeriod = requiredMatch(
    text,
    /Public sector finances, UK:\s*([A-Za-z]+\s+\d{4})/i,
    "bulletin period"
  )[1];
  const receipts =
    currentTableReceipts(text, titlePeriod) ?? legacyReceipts(text, titlePeriod);
  if (!receipts) {
    throw new Error("ONS public-finances bulletin did not expose central government receipts");
  }
  const releaseDate = isoDate(
    requiredMatch(
      text,
      /Release date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      "release date"
    )[1],
    "release date"
  );

  return {
    available: true,
    headline: {
      period: titlePeriod,
      observedAt: monthlyPeriodEnd(titlePeriod),
      releaseDate,
      receiptsBillion: receipts.current,
      yearChangeBillion: receipts.difference,
    },
    methodology: {
      measure: "Total current central government receipts",
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

function displayMonthlyPeriod(period) {
  const match = String(period).match(/^(\d{4})\s+([A-Z]{3})$/);
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || month === undefined) return period;
  return new Date(Date.UTC(Number(match[1]), month, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function collectTaxRevenue(fetchImpl = fetch, now = new Date()) {
  const bulletin = await fetchLatestOnsBulletin(FINANCES_BULLETIN_URL, fetchImpl);
  const parsed = parseTaxRevenueBulletin(bulletin.html, bulletin.finalUrl);
  const response = await fetchOfficialResponse(
    `${ONS_GENERATOR}${RECEIPTS_SERIES.path}`,
    {
      accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
      fetchImpl,
      sourceName: `ONS ${RECEIPTS_SERIES.id}`,
    }
  );
  const receipts = parseMonthlyOnsCsv(await readResponseText(response, { label: "ONS receipts CSV" }));
  const latest = receipts.at(-1);
  if (!latest || latest.observedAt !== parsed.headline.observedAt) {
    throw new Error("ONS receipts time series does not align with the current bulletin period");
  }
  if (Math.abs(latest.value / 1_000 - parsed.headline.receiptsBillion) > 0.11) {
    throw new Error("ONS receipts time series does not reconcile with the bulletin total");
  }

  const data = {
    ...parsed,
    history: receipts.slice(-TEN_YEARS_MONTHLY).map((point) => ({
      period: displayMonthlyPeriod(point.period),
      observedAt: point.observedAt,
      receiptsBillion: Number((point.value / 1_000).toFixed(1)),
    })),
    series: {
      receipts: RECEIPTS_SERIES.id,
      url: `${ONS_ORIGIN}${RECEIPTS_SERIES.path}`,
    },
    __observation: {
      status: "current",
      period: parsed.headline.period,
      observedAt: new Date(parsed.headline.observedAt).toISOString(),
      checkedAt: now.toISOString(),
      maxAgeDays: MAX_AGE_DAYS,
    },
  };

  return sectionRecord(
    "taxRevenue",
    data,
    now,
    "ONS Public sector finances bulletin and ANBV receipts series",
    "cloudflare-official-publication"
  );
}

export {
  RECEIPTS_SERIES,
  collectTaxRevenue,
  currentTableReceipts,
  parseTaxRevenueBulletin,
};
