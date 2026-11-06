import { parseOnsNextReleaseDate } from "../../worker/ons-release-date.js";
import { onsBulletinCollect } from "../_kit/ons-bulletin.js";
import {
  ONS_ORIGIN,
  alignedPeriods,
  assertClose,
  assertLatestPeriod,
  decodeHtml,
  displayMonthlyPeriod,
  fetchLatestOnsBulletin,
  fetchOnsSeries,
  monthlyPeriodEnd,
  parseReleaseDate,
  pointMap,
  requiredMatch,
  signedChange,
} from "../_kit/ons-economy.js";

const GDP_BULLETIN_URL =
  `${ONS_ORIGIN}/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk/latest`;

const GDP_SERIES = Object.freeze({
  index: Object.freeze({
    id: "ECY2",
    path: "/economy/grossdomesticproductgdp/timeseries/ecy2/mgdp",
  }),
  monthlyGrowth: Object.freeze({
    id: "ECYX",
    path: "/economy/grossdomesticproductgdp/timeseries/ecyx/mgdp",
  }),
  annualGrowth: Object.freeze({
    id: "ED2R",
    path: "/economy/grossdomesticproductgdp/timeseries/ed2r/mgdp",
  }),
  threeMonthGrowth: Object.freeze({
    id: "ED3H",
    path: "/economy/grossdomesticproductgdp/timeseries/ed3h/mgdp",
  }),
});

function parseGdpBulletin(html, finalUrl = GDP_BULLETIN_URL) {
  const text = decodeHtml(html);
  const nextReleaseDate = parseOnsNextReleaseDate(text);
  const period = requiredMatch(
    text,
    /GDP monthly estimate, UK:\s*([A-Za-z]+\s+\d{4})/i,
    "GDP period"
  )[1];
  const monthlyGrowth = signedChange(
    text,
    /Monthly real GDP is estimated to have shown no growth/i,
    /Monthly real GDP is estimated to have\s+(grown|increased|fallen|decreased|contracted)\s+by\s+([\d.]+)%/i,
    "monthly GDP growth"
  );
  const threeMonthGrowth = signedChange(
    text,
    /(?:Real gross domestic product \(GDP\)|GDP) is estimated to have shown no growth in the three months to/i,
    /(?:Real gross domestic product \(GDP\)|GDP) is estimated to have\s+(grown|increased|fallen|decreased|contracted)\s+by\s+([\d.]+)%\s+in the three months to/i,
    "three-month GDP growth"
  );

  return {
    available: true,
    headline: {
      period,
      observedAt: monthlyPeriodEnd(period),
      releaseDate: parseReleaseDate(text),
      ...(nextReleaseDate ? { nextReleaseDate } : {}),
      monthlyGrowth,
      threeMonthGrowth,
    },
    methodology: {
      measure: "Real gross domestic product, seasonally adjusted",
      status: "Official statistics",
      revisionNote:
        "Monthly GDP is an early estimate and is revised as fuller source data become available.",
    },
    source: {
      bulletinUrl: finalUrl,
      landingUrl: GDP_BULLETIN_URL,
    },
  };
}

async function buildGdpTracker(fetchImpl = fetch) {
  const response = await fetchLatestOnsBulletin(GDP_BULLETIN_URL, fetchImpl);
  const parsed = parseGdpBulletin(response.html, response.finalUrl);
  const index = await fetchOnsSeries(GDP_SERIES.index, fetchImpl);
  const monthlyGrowth = await fetchOnsSeries(GDP_SERIES.monthlyGrowth, fetchImpl);
  const annualGrowth = await fetchOnsSeries(GDP_SERIES.annualGrowth, fetchImpl);
  const threeMonthGrowth = await fetchOnsSeries(GDP_SERIES.threeMonthGrowth, fetchImpl);
  const periods = alignedPeriods(
    [index, monthlyGrowth, annualGrowth, threeMonthGrowth],
    "ONS GDP"
  );
  const indexByPeriod = pointMap(index);
  const monthlyByPeriod = pointMap(monthlyGrowth);
  const annualByPeriod = pointMap(annualGrowth);
  const threeMonthByPeriod = pointMap(threeMonthGrowth);
  assertLatestPeriod(periods, parsed.headline.observedAt, "ONS GDP");
  assertClose(monthlyByPeriod.get(periods.at(-1).period).value, parsed.headline.monthlyGrowth, "Monthly GDP");
  assertClose(
    threeMonthByPeriod.get(periods.at(-1).period).value,
    parsed.headline.threeMonthGrowth,
    "Three-month GDP"
  );

  return {
    ...parsed,
    headline: {
      ...parsed.headline,
      annualGrowth: annualByPeriod.get(periods.at(-1).period).value,
    },
    history: periods.map((point) => ({
      period: displayMonthlyPeriod(point.period),
      observedAt: point.observedAt,
      index: indexByPeriod.get(point.period).value,
      monthlyGrowth: monthlyByPeriod.get(point.period).value,
      annualGrowth: annualByPeriod.get(point.period).value,
      threeMonthGrowth: threeMonthByPeriod.get(point.period).value,
    })),
    series: Object.fromEntries(
      Object.entries(GDP_SERIES).map(([key, definition]) => [
        key,
        {
          id: definition.id,
          url: `${ONS_ORIGIN}${definition.path}`,
        },
      ])
    ),
  };
}

/** Feed interface (target design 2.3); see onsBulletinCollect. */
const collect = onsBulletinCollect(buildGdpTracker);

export {
  GDP_BULLETIN_URL,
  buildGdpTracker,
  collect,
  parseGdpBulletin,
};
