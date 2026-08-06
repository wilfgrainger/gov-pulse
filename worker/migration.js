import { fetchOfficialText as fetchSourceText } from "./official-source-fetch.js";

const DATASET_URL =
  "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional";
const BULLETIN_BASE_URL =
  "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/longterminternationalmigrationprovisional";

const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
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

function integer(value, label) {
  const parsed = Number.parseInt(String(value).replace(/,/g, ""), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse ${label}`);
  }
  return parsed;
}

function matchRequired(text, expression, label) {
  const match = text.match(expression);
  if (!match) {
    throw new Error(`ONS migration bulletin did not expose ${label}`);
  }
  return match;
}

function periodEnd(period) {
  const match = String(period).trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`Unable to parse migration period '${period}'`);
  }
  return Date.UTC(Number(match[2]), month + 1, 0);
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

function editionSlug(period) {
  return `yearending${String(period).toLowerCase().replace(/\s+/g, "")}`;
}

function discoverMigrationHistoryUrl(html, bulletinUrl) {
  const match = String(html).match(
    /(?:Total\s+)?long-term (?:immigration,\s*emigration and net migration|net migration,\s*immigration and emigration)[\s\S]{0,2000}?data-url=["']([^"']*\/visualisations\/[^"']+\/fig\d+\/index\.html)["']/i
  );
  if (!match) {
    throw new Error("ONS migration bulletin did not expose the comparable total-migration series");
  }
  return new URL(match[1].replace(/index\.html(?:[?#].*)?$/i, "data.csv"), bulletinUrl).toString();
}

function optionalInteger(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? integer(trimmed, "migration history value") : null;
}

function parseMigrationHistoryCsv(text) {
  const rows = String(text).trim().split(/\r?\n/);
  const headings = rows.shift()?.split(",").map((heading) => heading.trim()) ?? [];
  const index = Object.fromEntries(headings.map((heading, position) => [heading, position]));
  const required = [
    "date",
    "Net migration",
    "Immigration",
    "Emigration",
    "Net_estimate",
    "Immigration_estimate",
    "Emigration_estimate",
  ];
  if (!required.every((heading) => Number.isInteger(index[heading]))) {
    throw new Error("ONS migration history CSV did not expose the required total-flow columns");
  }

  const history = [];
  for (const row of rows) {
    const columns = row.split(",");
    const period = columns[index.date]?.trim();
    if (!/^YE Dec \d{2}$/i.test(period ?? "")) continue;
    const netMigration =
      optionalInteger(columns[index.Net_estimate]) ??
      optionalInteger(columns[index["Net migration"]]);
    const immigration =
      optionalInteger(columns[index.Immigration_estimate]) ??
      optionalInteger(columns[index.Immigration]);
    const emigration =
      optionalInteger(columns[index.Emigration_estimate]) ??
      optionalInteger(columns[index.Emigration]);
    if (![netMigration, immigration, emigration].every(Number.isFinite)) continue;
    if (Math.abs(immigration - emigration - netMigration) > 1_000) {
      throw new Error(`ONS migration history exceeds the published rounding tolerance for ${period}`);
    }
    const year = 2000 + Number(period.slice(-2));
    history.push({
      period: `YE December ${year}`,
      observedAt: Date.UTC(year + 1, 0, 0),
      immigration,
      emigration,
      netMigration,
    });
  }
  if (history.length < 2) {
    throw new Error("ONS migration history did not expose comparable annual observations");
  }
  return history.slice(-10);
}

function discoverLatestEdition(datasetHtml) {
  const raw = String(datasetHtml);
  const decoded = raw.replace(/%2F/gi, "/").replace(/%3A/gi, ":");
  const linkedEdition = decoded.match(
    /longterminternationalimmigrationemigrationandnetmigrationflowsprovisional\/(yearending[a-z0-9]+)/i
  );
  if (linkedEdition) {
    return linkedEdition[1].toLowerCase();
  }

  const visibleText = decodeHtml(raw);
  const headingEdition = visibleText.match(
    /Year ending\s+([A-Za-z]+\s+\d{4})\s+edition of this dataset/i
  );
  if (headingEdition) {
    return editionSlug(headingEdition[1]);
  }

  throw new Error("ONS migration dataset page did not expose a latest edition");
}

async function fetchOfficialText(url, fetchImpl = fetch) {
  return fetchSourceText(url, {
    accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
    fetchImpl,
    sourceName: "ONS",
  });
}

function parseMigrationBulletin(html, edition) {
  const text = decodeHtml(html);
  const releaseDate = matchRequired(
    text,
    /Release date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    "release date"
  )[1];
  const netMatch = matchRequired(
    text,
    /At\s+([\d,]+),\s+long-term international net migration for year ending \(YE\)\s+([A-Za-z]+\s+\d{4})/i,
    "latest net migration"
  );
  const previousMatch = matchRequired(
    text,
    /from YE\s+([A-Za-z]+\s+\d{4})\s+\(updated to\s+([\d,]+)\)/i,
    "previous net migration"
  );
  const immigrationMatch = matchRequired(
    text,
    /total long-term immigration YE\s+([A-Za-z]+\s+\d{4})\s+is\s+([\d,]+)/i,
    "latest immigration"
  );
  const emigrationMatch = matchRequired(
    text,
    /total long-term emigration in the most recent period is\s+([\d,]+)/i,
    "latest emigration"
  );

  const period = netMatch[2];
  const netMigration = integer(netMatch[1], "net migration");
  const immigration = integer(immigrationMatch[2], "immigration");
  const emigration = integer(emigrationMatch[1], "emigration");
  const previousNetMigration = integer(previousMatch[2], "previous net migration");

  if (immigrationMatch[1] !== period) {
    throw new Error(
      `ONS migration headline periods do not align: net ${period}, immigration ${immigrationMatch[1]}`
    );
  }
  if (immigration - emigration !== netMigration) {
    throw new Error(
      `ONS migration arithmetic does not reconcile: ${immigration} - ${emigration} != ${netMigration}`
    );
  }
  if (previousNetMigration === 0) {
    throw new Error("ONS migration previous-period estimate is zero; percentage change is undefined");
  }

  return {
    headline: {
      period: `YE ${period}`,
      observedAt: periodEnd(period),
      releaseDate: isoDate(releaseDate, "migration release date"),
      netMigration,
      immigration,
      emigration,
      previousPeriod: `YE ${previousMatch[1]}`,
      previousNetMigration,
      changePercent: Math.round(
        ((netMigration - previousNetMigration) / previousNetMigration) * 100
      ),
      provisional: true,
    },
    comparison: [
      { period: `YE ${previousMatch[1]}`, netMigration: previousNetMigration },
      { period: `YE ${period}`, netMigration },
    ],
    methodology: {
      definition: "People moving to or from the UK for 12 months or more",
      status: "Official statistics in development",
      revisionNote:
        "The newest estimates are provisional for a year and earlier periods may be revised when methods or source data improve.",
    },
    source: {
      edition,
      bulletinUrl: `${BULLETIN_BASE_URL}/${edition}`,
      datasetUrl: DATASET_URL,
    },
  };
}

async function buildMigrationStats(fetchImpl = fetch) {
  const datasetHtml = await fetchOfficialText(DATASET_URL, fetchImpl);
  const edition = discoverLatestEdition(datasetHtml);
  const bulletinUrl = `${BULLETIN_BASE_URL}/${edition}`;
  const bulletinHtml = await fetchOfficialText(bulletinUrl, fetchImpl);
  const parsed = parseMigrationBulletin(bulletinHtml, edition);
  const historyUrl = discoverMigrationHistoryUrl(bulletinHtml, bulletinUrl);
  const historyText = await fetchOfficialText(historyUrl, fetchImpl);
  const history = parseMigrationHistoryCsv(historyText);
  const latest = history.at(-1);
  if (
    latest.period !== parsed.headline.period ||
    latest.immigration !== parsed.headline.immigration ||
    latest.emigration !== parsed.headline.emigration ||
    latest.netMigration !== parsed.headline.netMigration
  ) {
    throw new Error("ONS migration history does not reconcile with the current bulletin headline");
  }
  const previous = history.at(-2);
  return {
    ...parsed,
    history,
    annualDelta: {
      immigration: latest.immigration - previous.immigration,
      emigration: latest.emigration - previous.emigration,
      netMigration: latest.netMigration - previous.netMigration,
    },
    source: {
      ...parsed.source,
      historyUrl,
    },
  };
}

export {
  BULLETIN_BASE_URL,
  DATASET_URL,
  buildMigrationStats,
  discoverLatestEdition,
  discoverMigrationHistoryUrl,
  fetchOfficialText,
  parseMigrationBulletin,
  parseMigrationHistoryCsv,
};
