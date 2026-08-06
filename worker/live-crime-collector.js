import { MOJ_COURT_PUBLICATION } from "../data/crime/moj-court-publication.js";
import {
  ONS_PUBLICATION_LANDING_URL,
  approvedOnsPublicationUrl,
  buildCurrentCrimeStatisticsPayload,
  periodEnd,
  validatePublicationIdentity,
} from "../contracts/crime-statistics.js";
import { fetchLatestOnsBulletin } from "./economy-evidence.js";
import { decodeHtml } from "./live-feed-common.js";

const MONTHS = Object.freeze({
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
});

function requiredMatch(text, expression, label) {
  const match = text.match(expression);
  if (!match) throw new Error(`ONS crime bulletin did not expose ${label}`);
  return match;
}

function integer(value, label) {
  const parsed = Number.parseInt(String(value).replace(/,/g, ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`ONS crime bulletin exposed an invalid ${label}`);
  }
  return parsed;
}

function million(value, label) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`ONS crime bulletin exposed an invalid ${label}`);
  }
  return Math.round(parsed * 1_000_000);
}

function display(value) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)} million`;
  }
  return new Intl.NumberFormat("en-GB").format(value);
}

function measure(id, label, value, unit, changeLabel) {
  return { id, label, value, displayValue: display(value), unit, changeLabel };
}

function isoDate(value, label) {
  const match = String(value)
    .trim()
    .match(/^(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})$/);
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

function canonicalPeriod(value) {
  const match = String(value)
    .trim()
    .match(/^year ending ([A-Za-z]+) (20\d{2})$/i);
  const month = match?.[1]?.toLowerCase();
  if (!match || MONTHS[month] === undefined) {
    throw new Error("ONS crime bulletin exposed an invalid year-ending period");
  }
  return `Year ending ${month.charAt(0).toUpperCase()}${month.slice(1)} ${match[2]}`;
}

function noSignificantChange() {
  return "No statistically significant change from the previous survey";
}

function decrease(percent, comparison = "the previous year") {
  return `${percent}% lower than ${comparison}`;
}

function increase(percent, comparison = "the previous survey") {
  return `${percent}% higher than ${comparison}`;
}

function publisherStatements(html) {
  const statements = [];
  for (const match of String(html).matchAll(
    /<(?:p|li)\b[^>]*>([\s\S]*?)<\/(?:p|li)>/gi
  )) {
    const statement = decodeHtml(match[1]);
    if (statement) statements.push(statement);
  }
  return statements;
}

function statementFor(statements, expression, label) {
  const statement = statements.find((candidate) => expression.test(candidate));
  if (!statement) throw new Error(`ONS crime bulletin did not expose ${label}`);
  return statement;
}

function noSignificantMillion(statements, identity, valueExpression, label) {
  const statement = statementFor(statements, identity, label);
  if (!/no statistically significant change/i.test(statement)) {
    throw new Error(`ONS crime bulletin did not expose ${label} and comparison`);
  }
  return million(requiredMatch(statement, valueExpression, label)[1], label);
}

function noSignificantInteger(statements, identity, valueExpression, label) {
  const statement = statementFor(statements, identity, label);
  if (!/no statistically significant change/i.test(statement)) {
    throw new Error(`ONS crime bulletin did not expose ${label} and comparison`);
  }
  return integer(requiredMatch(statement, valueExpression, label)[1], label);
}

function parseOtherHouseholdTheft(text) {
  const match = text.match(
    /other household theft increased by (\d+)% \(to around ([\d,]+) incidents\)|(?:there was\s+)?a\s+(\d+)% increase in other household theft \(to around ([\d,]+) incidents\)/i
  );
  if (!match) {
    throw new Error("ONS crime bulletin did not expose other household theft");
  }
  return {
    percent: integer(match[1] ?? match[3], "other household theft percentage"),
    incidents: integer(match[2] ?? match[4], "other household theft"),
  };
}

function parseOnsCrimeBulletin(html, finalUrl) {
  const text = decodeHtml(html);
  const statements = publisherStatements(html);
  const period = canonicalPeriod(
    requiredMatch(
      text,
      /Crime in England and Wales:\s*(year ending [A-Za-z]+ 20\d{2})/i,
      "the publication period"
    )[1]
  );
  const publicationUrl = approvedOnsPublicationUrl(finalUrl);
  validatePublicationIdentity(publicationUrl, period);
  const releaseDate = isoDate(
    requiredMatch(
      text,
      /Release date:\s*(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i,
      "the release date"
    )[1],
    "crime release date"
  );
  const nextReleaseDate = isoDate(
    requiredMatch(
      text,
      /Next release:\s*(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i,
      "the next release date"
    )[1],
    "next crime release date"
  );
  if (!/England and Wales/i.test(text)) {
    throw new Error("ONS crime bulletin did not expose the England and Wales geography");
  }

  const headlineCrime = noSignificantMillion(
    statements,
    /million incidents of CSEW headline crime/i,
    /(\d+(?:\.\d+)?) million incidents of CSEW headline crime/i,
    "CSEW headline crime"
  );
  const theft = noSignificantMillion(
    statements,
    /million theft incidents/i,
    /(\d+(?:\.\d+)?) million theft incidents/i,
    "CSEW theft"
  );
  const otherHousehold = parseOtherHouseholdTheft(
    statementFor(statements, /other household theft/i, "other household theft")
  );
  const fraud = noSignificantMillion(
    statements,
    /million fraud incidents/i,
    /(\d+(?:\.\d+)?) million fraud incidents/i,
    "CSEW fraud"
  );
  const computerMisuse = noSignificantInteger(
    statements,
    /incidents of computer misuse/i,
    /estimated ([\d,]+) incidents of computer misuse/i,
    "computer misuse"
  );
  const violence = noSignificantInteger(
    statements,
    /incidents of violence with or without injury/i,
    /estimated ([\d,]+) incidents of violence with or without injury/i,
    "violence with or without injury"
  );
  const criminalDamage = noSignificantInteger(
    statements,
    /incidents of criminal damage/i,
    /estimated around ([\d,]+) incidents of criminal damage/i,
    "criminal damage"
  );

  const recordedCrime = requiredMatch(
    text,
    /police recorded around (\d+(?:\.\d+)?) million crimes \(excluding fraud and computer misuse\), a (\d+)% decrease/i,
    "police-recorded crime excluding fraud and computer misuse"
  );
  const homicideSummary = requiredMatch(
    text,
    /recorded ([\d,]+) homicide offences[^.]*?a (\d+)% decrease/i,
    "homicide count and annual change"
  );
  const homicideRate = requiredMatch(
    text,
    /homicide rate was ([\d.]+) per 1 million people/i,
    "homicide rate"
  );
  const knife = requiredMatch(
    text,
    /Knife-enabled crime recorded by the police decreased by (\d+)%[^.]*?\(to ([\d,]+) offences\)/i,
    "knife-enabled crime"
  );
  const firearms = requiredMatch(
    text,
    /(?:Offences involving firearms|Firearms offences)[\s\S]{0,700}?Police recorded ([\d,]+) offences in year ending[^.]*?an? (\d+)% decrease/i,
    "firearms offences"
  );
  const personalRobbery = requiredMatch(
    text,
    /robbery of personal property decreased by (\d+)% \(to ([\d,]+) offences\)/i,
    "robbery of personal property"
  );
  const shoplifting = requiredMatch(
    text,
    /(\d+)% decrease \(to ([\d,]+) offences\) in YE [A-Za-z]+ 20\d{2}[^.]*?previous year/i,
    "shoplifting"
  );

  return {
    available: true,
    headline: {
      publisher: "Office for National Statistics",
      publicationTitle: `Crime in England and Wales: ${period.replace(/^Year/, "year")}`,
      publicationUrl,
      period,
      observedAt: periodEnd(period),
      releaseDate,
      nextReleaseDate,
      geography: "England and Wales",
    },
    crimeSurvey: {
      status: "available",
      title: "Crime experienced by households and individuals",
      sourceLabel: "Crime Survey for England and Wales (CSEW)",
      sourceClass: "accredited-official-statistics",
      summary: `${display(headlineCrime)} CSEW headline crime incidents were estimated in the latest survey, with no statistically significant annual change.`,
      caveat:
        "The CSEW is the preferred measure for long-term trends in common crimes. Estimates cover people aged 16 and over, exclude some populations and are subject to sampling uncertainty.",
      measures: [
        measure(
          "headlineCrime",
          "Headline crime",
          headlineCrime,
          "estimated incidents",
          noSignificantChange()
        ),
        measure("theft", "Theft", theft, "estimated incidents", noSignificantChange()),
        measure(
          "otherHouseholdTheft",
          "Other household theft",
          otherHousehold.incidents,
          "estimated incidents",
          increase(otherHousehold.percent)
        ),
        measure("fraud", "Fraud", fraud, "estimated incidents", noSignificantChange()),
        measure(
          "computerMisuse",
          "Computer misuse",
          computerMisuse,
          "estimated incidents",
          noSignificantChange()
        ),
        measure(
          "violence",
          "Violence with or without injury",
          violence,
          "estimated incidents",
          noSignificantChange()
        ),
        measure(
          "criminalDamage",
          "Criminal damage",
          criminalDamage,
          "estimated incidents",
          noSignificantChange()
        ),
      ],
    },
    policeRecorded: {
      status: "available",
      title: "Crimes recorded by the police",
      sourceLabel: "Home Office police recorded crime, published by ONS",
      sourceClass: "official-statistics",
      summary: `Police recorded around ${recordedCrime[1]} million crimes excluding fraud and computer misuse, ${recordedCrime[2]}% fewer than the previous year.`,
      caveat:
        "Police-recorded crime is not the preferred measure for general crime trends because reporting, recording practices and police activity change. It is more useful for lower-volume, higher-harm offences. Recorded fraud and computer misuse are excluded while the new Report Fraud system is being introduced.",
      measures: [
        measure(
          "recordedCrime",
          "Recorded crime excluding fraud and computer misuse",
          million(recordedCrime[1], "police-recorded crime"),
          "recorded offences",
          decrease(integer(recordedCrime[2], "police-recorded crime percentage"))
        ),
        measure(
          "homicide",
          "Homicide",
          integer(homicideSummary[1], "homicide"),
          "recorded offences",
          `${decrease(integer(homicideSummary[2], "homicide percentage"))} · ${homicideRate[1]} per million people`
        ),
        measure(
          "knife",
          "Knife or sharp instrument offences",
          integer(knife[2], "knife-enabled crime"),
          "recorded offences",
          decrease(integer(knife[1], "knife-enabled crime percentage"))
        ),
        measure(
          "firearms",
          "Firearms offences",
          integer(firearms[1], "firearms offences"),
          "recorded offences",
          decrease(integer(firearms[2], "firearms percentage"))
        ),
        measure(
          "personalRobbery",
          "Robbery of personal property",
          integer(personalRobbery[2], "personal robbery"),
          "recorded offences",
          decrease(integer(personalRobbery[1], "personal robbery percentage"))
        ),
        measure(
          "shoplifting",
          "Shoplifting",
          integer(shoplifting[2], "shoplifting"),
          "recorded offences",
          decrease(integer(shoplifting[1], "shoplifting percentage"))
        ),
      ],
    },
    justice: structuredClone(MOJ_COURT_PUBLICATION),
    regional: {
      status: "unavailable",
      title: "Regional comparisons",
      reason:
        "No regional ranking is published until one versioned Police Force Area table is joined to official geography and population inputs with reproducible rate calculations.",
    },
    evidencePolicy: {
      combinedTotalAllowed: false,
      modulesValidatedIndependently: true,
      regionalRankingPublished: false,
    },
  };
}

async function collectCrimeStatistics(fetchImpl = fetch, now = new Date()) {
  const bulletin = await fetchLatestOnsBulletin(
    ONS_PUBLICATION_LANDING_URL,
    fetchImpl
  );
  return buildCurrentCrimeStatisticsPayload(
    parseOnsCrimeBulletin(bulletin.html, bulletin.finalUrl),
    now
  );
}

export {
  canonicalPeriod,
  collectCrimeStatistics,
  display,
  parseOnsCrimeBulletin,
  publisherStatements,
};
