import { parseOnsNextReleaseDate } from "./ons-release-date.js";
import {
  ONS_ORIGIN,
  TEN_YEARS_MONTHLY,
  assertClose,
  assertLatestPeriod,
  decodeHtml,
  discoverLatestBulletinUrl,
  displayMonthlyPeriod,
  fetchLatestOnsBulletin,
  fetchOnsSeries,
  monthlyPeriodEnd,
  numeric,
  parseMonthlyOnsCsv,
  parseReleaseDate,
  requiredMatch,
} from "../feeds/_kit/ons-economy.js";

const FINANCES_BULLETIN_URL =
  `${ONS_ORIGIN}/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/latest`;

const RECEIPTS_SERIES = Object.freeze({
  id: "ANBV",
  path: "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/anbv/pusf",
});

function parseFinancesBulletin(html, finalUrl = FINANCES_BULLETIN_URL) {
  const text = decodeHtml(html);
  const nextReleaseDate = parseOnsNextReleaseDate(text);
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
      ...(nextReleaseDate ? { nextReleaseDate } : {}),
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
  buildTaxRevenue,
  discoverLatestBulletinUrl,
  fetchLatestOnsBulletin,
  parseFinancesBulletin,
  parseMonthlyOnsCsv,
};
