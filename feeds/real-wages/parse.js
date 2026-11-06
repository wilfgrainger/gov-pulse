import { parseOnsNextReleaseDate } from "../../worker/ons-release-date.js";
import { parseCsvColumns, parseStrictNumber as numeric } from "../_kit/csv.js";
import { MONTHS, SHORT_MONTHS, isoDateFromDayMonthYear as isoDate } from "../_kit/dates.js";
import { fetchOfficialText } from "../_kit/fetch.js";
import { decodeHtml } from "../_kit/html.js";
import { editionFromUrl, onsBulletinCollect } from "../_kit/ons-bulletin.js";

const BULLETIN_BASE_URL =
  "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain";
const BULLETIN_LATEST_URL = `${BULLETIN_BASE_URL}/latest`;

function matchRequired(text, expression, label) {
  const match = text.match(expression);
  if (!match) {
    throw new Error(`ONS real wages bulletin did not expose ${label}`);
  }
  return match;
}

function rollingPeriodEnd(period) {
  const match = String(period).trim().match(/to\s+([A-Za-z]+)\s+(\d{4})$/i);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse rolling period '${period}'`);
  }
  return Date.UTC(Number(match[2]), month + 1, 0);
}

function normalizeRollingPeriod(period) {
  // ONS mostly abbreviates both months ("May to Jul 2026") but the newest row
  // in the Figure 3 history CSV has been observed with the end month spelled
  // out in full ("May to July 2026"). Normalize to the three-letter form used
  // everywhere else so periods compare equal across the bulletin and the CSV.
  const match = String(period)
    .trim()
    .match(/^([A-Za-z]+)\s+to\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return String(period).trim();
  const shorten = (name) => {
    const month = MONTHS[name.toLowerCase()];
    if (month === undefined) return name;
    return SHORT_MONTHS[month];
  };
  return `${shorten(match[1])} to ${shorten(match[2])} ${match[3]}`;
}

async function fetchOfficialPage(url, fetchImpl = fetch) {
  const { text, finalUrl } = await fetchOfficialText(url, {
    accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
    label: "ONS real wages bulletin",
    fetchImpl,
  });
  return { html: text, finalUrl };
}

function discoverLatestEdition(html) {
  // ONS serves the current edition's content directly at the /latest alias
  // without an HTTP redirect, so the dated edition slug must be read from the
  // page itself (the canonical link, duplicated in the page's data layer).
  const canonical = String(html).match(
    /rel="canonical"\s+href="[^"]*\/averageweeklyearningsingreatbritain\/([a-z0-9]+)"/i
  );
  if (canonical) {
    return canonical[1].toLowerCase();
  }

  const visibleText = decodeHtml(html);
  const titleEdition = visibleText.match(
    /Average weekly earnings in Great Britain:\s*([A-Za-z]+\s+\d{4})/i
  );
  if (titleEdition) {
    const match = titleEdition[1].trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (match && MONTHS[match[1].toLowerCase()] !== undefined) {
      return `${match[1].toLowerCase()}${match[2]}`;
    }
  }

  throw new Error("ONS real wages bulletin did not expose a latest edition");
}

async function fetchLatestRealWagesBulletin(fetchImpl = fetch) {
  const landing = await fetchOfficialPage(BULLETIN_LATEST_URL, fetchImpl);
  const landingEdition = editionFromUrl(landing.finalUrl);
  if (landingEdition && landingEdition !== "latest") {
    return { html: landing.html, finalUrl: landing.finalUrl, edition: landingEdition };
  }

  // ONS serves the current edition's content directly at /latest without an
  // HTTP redirect: reuse the already-fetched page instead of refetching the
  // identical content at its dated URL.
  const edition = discoverLatestEdition(landing.html);
  return {
    html: landing.html,
    finalUrl: `${BULLETIN_BASE_URL}/${edition}`,
    edition,
  };
}

function discoverRealWagesHistoryUrl(html, bulletinUrl) {
  const marker = String(html).search(
    /Figure 3[\s\S]{0,400}?Real regular earnings growth/i
  );
  if (marker === -1) {
    throw new Error("ONS real wages bulletin did not expose the Figure 3 real-earnings chart");
  }
  const window = String(html).slice(marker, marker + 4000);
  const match = window.match(
    /href="([^"]*\/generator\?uri=[^"]*&(?:amp;)?format=csv)"/i
  );
  if (!match) {
    throw new Error("ONS real wages bulletin did not expose the Figure 3 CSV download link");
  }
  const resolved = new URL(decodeHtml(match[1]).replace(/&amp;/gi, "&"), bulletinUrl);
  if (resolved.protocol !== "https:" || resolved.origin !== new URL(bulletinUrl).origin) {
    throw new Error("ONS real wages bulletin CSV link left the bulletin's HTTPS origin");
  }
  return resolved.toString();
}

function parseRealWagesHistoryCsv(text) {
  const rows = String(text).trim().split(/\r?\n/);
  const headerIndex = rows.findIndex(
    (row) => parseCsvColumns(row)[0]?.replace(/^"|"$/g, "").trim() === "Period"
  );
  if (headerIndex === -1) {
    throw new Error("ONS real wages history CSV did not expose a Period header row");
  }
  const headings = parseCsvColumns(rows[headerIndex]).map((heading) =>
    heading.replace(/^"|"$/g, "").trim()
  );
  const index = Object.fromEntries(headings.map((heading, position) => [heading, position]));
  const required = ["Period", "Total pay (real)", "Regular pay (real)", "CPIH"];
  if (!required.every((heading) => Number.isInteger(index[heading]))) {
    throw new Error("ONS real wages history CSV did not expose the required columns");
  }

  const history = [];
  const seen = new Set();
  for (const row of rows.slice(headerIndex + 1)) {
    const columns = parseCsvColumns(row).map((value) => value.replace(/^"|"$/g, "").trim());
    const rawPeriod = columns[index.Period];
    if (!rawPeriod || !/^[A-Za-z]+\s+to\s+[A-Za-z]+\s+\d{4}$/.test(rawPeriod)) continue;
    const period = normalizeRollingPeriod(rawPeriod);
    let totalPayReal;
    let regularPayReal;
    let cpih;
    try {
      totalPayReal = numeric(columns[index["Total pay (real)"]], "total pay real growth");
      regularPayReal = numeric(columns[index["Regular pay (real)"]], "regular pay real growth");
      cpih = numeric(columns[index.CPIH], "CPIH annual rate");
    } catch {
      continue;
    }
    if (seen.has(period)) {
      throw new Error(`ONS real wages history contains duplicate period '${period}'`);
    }
    seen.add(period);
    history.push({
      period,
      observedAt: rollingPeriodEnd(period),
      totalPayRealGrowthPercent: totalPayReal,
      regularPayRealGrowthPercent: regularPayReal,
      cpihAnnualRatePercent: cpih,
    });
  }
  if (history.length < 2) {
    throw new Error("ONS real wages history did not expose comparable observations");
  }
  history.sort((left, right) => left.observedAt - right.observedAt);
  return history.slice(-120);
}

function parseRealWagesBulletin(html, edition) {
  const text = decodeHtml(html);
  const nextReleaseDate = parseOnsNextReleaseDate(text);
  const releaseDate = matchRequired(
    text,
    /Release date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    "release date"
  )[1];
  const periodMatch = matchRequired(
    text,
    /following information is for the period from\s+([A-Za-z]+(?:\s+\d{4})?\s+to\s+[A-Za-z]+\s+\d{4})/i,
    "reference period"
  );
  const realGrowthMatch = matchRequired(
    text,
    /annual growth in real terms[\s\S]{0,160}?\(CPIH\),?\s*was\s+([+\-\u2212]?(?:\d+(?:\.\d*)?|\.\d+))%\s+for regular pay and\s+([+\-\u2212]?(?:\d+(?:\.\d*)?|\.\d+))%\s+for total pay/i,
    "CPIH real-terms annual growth"
  );

  const period = normalizeRollingPeriod(periodMatch[1]);
  const regularPayRealGrowthPercent = numeric(realGrowthMatch[1], "regular pay real growth");
  const totalPayRealGrowthPercent = numeric(realGrowthMatch[2], "total pay real growth");

  return {
    headline: {
      period,
      observedAt: rollingPeriodEnd(period),
      releaseDate: isoDate(releaseDate, "real wages release date"),
      ...(nextReleaseDate ? { nextReleaseDate } : {}),
      regularPayRealGrowthPercent,
      totalPayRealGrowthPercent,
      deflator: "CPIH",
    },
    methodology: {
      measure:
        "Average weekly earnings growth, adjusted for inflation using the Consumer Prices Index including owner occupiers' housing costs (CPIH)",
      status: "Accredited official statistics",
      revisionNote:
        "Average weekly earnings are published on a provisional basis and are subject to revision as later source data and seasonal-adjustment reviews are incorporated.",
    },
    source: {
      edition,
      bulletinUrl: `${BULLETIN_BASE_URL}/${edition}`,
    },
  };
}

async function buildRealWagesStats(fetchImpl = fetch) {
  const bulletin = await fetchLatestRealWagesBulletin(fetchImpl);
  const parsed = parseRealWagesBulletin(bulletin.html, bulletin.edition);
  const historyUrl = discoverRealWagesHistoryUrl(bulletin.html, bulletin.finalUrl);
  const { text: historyText } = await fetchOfficialText(historyUrl, {
    accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
    label: "ONS real wages history CSV",
    fetchImpl,
  });
  const history = parseRealWagesHistoryCsv(historyText);
  const latest = history.at(-1);
  if (
    latest.period !== parsed.headline.period ||
    latest.regularPayRealGrowthPercent !== parsed.headline.regularPayRealGrowthPercent ||
    latest.totalPayRealGrowthPercent !== parsed.headline.totalPayRealGrowthPercent
  ) {
    throw new Error("ONS real wages history does not reconcile with the current bulletin headline");
  }

  return {
    ...parsed,
    history,
    source: {
      ...parsed.source,
      historyUrl,
    },
  };
}

/** Feed interface (target design 2.3); see onsBulletinCollect. */
const collect = onsBulletinCollect(buildRealWagesStats);

export {
  BULLETIN_BASE_URL,
  BULLETIN_LATEST_URL,
  buildRealWagesStats,
  collect,
  discoverLatestEdition,
  discoverRealWagesHistoryUrl,
  fetchLatestRealWagesBulletin,
  parseRealWagesBulletin,
  parseRealWagesHistoryCsv,
};
