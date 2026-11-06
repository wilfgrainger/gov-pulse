import { parseOnsNextReleaseDate } from "./ons-release-date.js";
import {
  ONS_ORIGIN,
  TEN_YEARS_MONTHLY,
  alignedPeriods,
  annualDelta,
  assertClose,
  assertLatestPeriod,
  decodeHtml,
  discoverLatestBulletinUrl,
  displayMonthlyPeriod,
  fetchLatestOnsBulletin,
  fetchOnsSeries,
  includeCurrentBulletinPoint,
  integer,
  monthlyPeriodEnd,
  numeric,
  parseMonthlyOnsCsv,
  parseReleaseDate,
  parseRollingThreeMonthOnsCsv,
  pointMap,
  requiredMatch,
  rollingPeriodEnd,
} from "../feeds/_kit/ons-economy.js";

const LABOUR_BULLETIN_URL =
  `${ONS_ORIGIN}/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest`;

const FINANCES_BULLETIN_URL =
  `${ONS_ORIGIN}/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/latest`;

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

function parseLabourBulletin(html, finalUrl = LABOUR_BULLETIN_URL) {
  const text = decodeHtml(html);
  const nextReleaseDate = parseOnsNextReleaseDate(text);
  const periodPattern = "([A-Za-z]+(?:\\s+\\d{4})?\\s+to\\s+[A-Za-z]+\\s+\\d{4})";
  function rateMatch(subject, label) {
    const current = text.match(
      new RegExp(`${subject}[^.]*?was estimated at\\s+([\\d.]+)%\\s+(?:in|for)\\s+${periodPattern}`, "i")
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
      ...(nextReleaseDate ? { nextReleaseDate } : {}),
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

async function buildEmploymentStats(fetchImpl = fetch) {
  const response = await fetchLatestOnsBulletin(LABOUR_BULLETIN_URL, fetchImpl);
  const parsed = parseLabourBulletin(response.html, response.finalUrl);
  const employment = includeCurrentBulletinPoint(
    await fetchOnsSeries(
      LABOUR_SERIES.employmentRate,
      fetchImpl,
      parseRollingThreeMonthOnsCsv
    ),
    parsed.headline.observedAt,
    parsed.headline.employmentRate,
    "Employment rate"
  );
  const unemployment = includeCurrentBulletinPoint(
    await fetchOnsSeries(
      LABOUR_SERIES.unemploymentRate,
      fetchImpl,
      parseRollingThreeMonthOnsCsv
    ),
    parsed.headline.observedAt,
    parsed.headline.unemploymentRate,
    "Unemployment rate"
  );
  const inactivity = includeCurrentBulletinPoint(
    await fetchOnsSeries(
      LABOUR_SERIES.inactivityRate,
      fetchImpl,
      parseRollingThreeMonthOnsCsv
    ),
    parsed.headline.observedAt,
    parsed.headline.inactivityRate,
    "Inactivity rate"
  );
  const vacanciesObservedAt = rollingPeriodEnd(parsed.headline.vacanciesPeriod);
  const vacancies = includeCurrentBulletinPoint(
    (
      await fetchOnsSeries(
        LABOUR_SERIES.vacancies,
        fetchImpl,
        parseRollingThreeMonthOnsCsv
      )
    ).map((point) => ({
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
  LABOUR_BULLETIN_URL,
  buildEmploymentStats,
  buildTaxRevenue,
  discoverLatestBulletinUrl,
  fetchLatestOnsBulletin,
  parseFinancesBulletin,
  parseLabourBulletin,
  parseMonthlyOnsCsv,
};
