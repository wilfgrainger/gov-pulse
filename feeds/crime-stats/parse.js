import {
  ONS_PUBLICATION_LANDING_URL,
  approvedOnsPublicationUrl,
  buildCurrentCrimeStatisticsPayload,
  periodEnd,
  validatePublicationIdentity,
} from "../../contracts/crime-statistics.js";
import { fetchLatestOnsBulletin } from "../../worker/economy-evidence.js";
import { decodeHtml } from "../../worker/live-feed-common.js";

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

const NO_SIGNIFICANT_CHANGE = /no statistically significant change/i;
const SURVEY_CHANGE =
  /\ban? (\d+(?:\.\d+)?)% (increase|decrease) compared with (?:last year['\u2019]s|the previous year['\u2019]s|the YE [A-Za-z]+ 20\d{2}) survey/i;
// Any wording that states a change. If one of these appears before a
// recognised comparison, the measure's own comparison is in wording this
// parser does not understand, and it must fail closed rather than fall
// through to a later "no statistically significant change" clause.
const CHANGE_WORDING =
  /\d+(?:\.\d+)?%|\b(?:increas(?:e|ed|es|ing)|decreas(?:e|ed|es|ing)|ris(?:e|es|en|ing)|rose|fall(?:s|en|ing)?|fell|higher|lower|grew|growth|declin(?:e|ed|es|ing)|drop(?:s|ped)?|statistically significant)\b/i;

function firstIndex(text, expression) {
  const match = text.match(expression);
  return match ? { index: match.index, match } : null;
}

function surveyComparison(statement, valueIndex, label) {
  // A CSEW estimate is compared with the previous survey in the clause that
  // follows it. ONS reports either "no statistically significant change" or
  // a statistically significant "N% increase/decrease compared with last
  // year's survey". Take whichever comparison comes first after the estimate,
  // so a later clause about a sub-measure cannot relabel it. A change stated
  // in any other wording before that point fails closed: a stated change is
  // never defaulted to "no significant change".
  const after = statement.slice(valueIndex);
  const noChange = firstIndex(after, NO_SIGNIFICANT_CHANGE);
  const change = firstIndex(after, SURVEY_CHANGE);
  const wording = firstIndex(after, CHANGE_WORDING);
  const candidates = [noChange, change].filter(Boolean);
  const first = candidates.sort((left, right) => left.index - right.index)[0];
  if (!first || (wording && wording.index < first.index)) {
    throw new Error(`ONS crime bulletin did not expose ${label} and comparison`);
  }
  if (first === noChange) return noSignificantChange();
  const percent = Number.parseFloat(change.match[1]);
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error(`ONS crime bulletin exposed an invalid ${label} percentage`);
  }
  return change.match[2].toLowerCase() === "increase"
    ? increase(change.match[1])
    : decrease(change.match[1], "the previous survey");
}

function surveyMeasure(id, label, estimate) {
  return measure(id, label, estimate.value, "estimated incidents", estimate.changeLabel);
}

function surveyEstimate(statements, identity, valueExpression, label, parse) {
  const statement = statementFor(statements, identity, label);
  const match = requiredMatch(statement, valueExpression, label);
  return {
    value: parse(match[1], label),
    changeLabel: surveyComparison(statement, statement.indexOf(match[0]), label),
  };
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

  const headlineCrime = surveyEstimate(
    statements,
    /million incidents of CSEW headline crime/i,
    /(\d+(?:\.\d+)?) million incidents of CSEW headline crime/i,
    "CSEW headline crime",
    million
  );
  const theft = surveyEstimate(
    statements,
    /million theft incidents/i,
    /(\d+(?:\.\d+)?) million theft incidents/i,
    "CSEW theft",
    million
  );
  const otherHousehold = parseOtherHouseholdTheft(
    statementFor(statements, /other household theft/i, "other household theft")
  );
  const fraud = surveyEstimate(
    statements,
    /million fraud incidents/i,
    /(\d+(?:\.\d+)?) million fraud incidents/i,
    "CSEW fraud",
    million
  );
  const computerMisuse = surveyEstimate(
    statements,
    /incidents of computer misuse/i,
    /estimated ([\d,]+) incidents of computer misuse/i,
    "computer misuse",
    integer
  );
  const violence = surveyEstimate(
    statements,
    /incidents of violence with or without injury/i,
    /estimated ([\d,]+) incidents of violence with or without injury/i,
    "violence with or without injury",
    integer
  );
  const criminalDamage = surveyEstimate(
    statements,
    /incidents of criminal damage/i,
    /estimated around ([\d,]+) incidents of criminal damage/i,
    "criminal damage",
    integer
  );

  // Some editions (first seen: year ending June 2026) do not state a total
  // for police-recorded crime excluding fraud and computer misuse. That total
  // is then unavailable for the edition: it is omitted, never carried over
  // from an earlier bulletin or derived from the offence-level figures.
  const recordedCrime = text.match(
    /police recorded around (\d+(?:\.\d+)?) million crimes \(excluding fraud and computer misuse\), a (\d+)% decrease/i
  );
  if (!recordedCrime && /million crimes \(excluding fraud and computer misuse\)/i.test(text)) {
    // The edition states the total in wording this parser does not
    // recognise: fail closed rather than silently dropping it.
    throw new Error(
      "ONS crime bulletin did not expose police-recorded crime excluding fraud and computer misuse"
    );
  }
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
      summary:
        headlineCrime.changeLabel === noSignificantChange()
          ? `${display(headlineCrime.value)} CSEW headline crime incidents were estimated in the latest survey, with no statistically significant annual change.`
          : `${display(headlineCrime.value)} CSEW headline crime incidents were estimated in the latest survey, ${headlineCrime.changeLabel}.`,
      caveat:
        "The CSEW is the preferred measure for long-term trends in common crimes. Estimates cover people aged 16 and over, exclude some populations and are subject to sampling uncertainty.",
      measures: [
        surveyMeasure("headlineCrime", "Headline crime", headlineCrime),
        surveyMeasure("theft", "Theft", theft),
        measure(
          "otherHouseholdTheft",
          "Other household theft",
          otherHousehold.incidents,
          "estimated incidents",
          increase(otherHousehold.percent)
        ),
        surveyMeasure("fraud", "Fraud", fraud),
        surveyMeasure("computerMisuse", "Computer misuse", computerMisuse),
        surveyMeasure("violence", "Violence with or without injury", violence),
        surveyMeasure("criminalDamage", "Criminal damage", criminalDamage),
      ],
    },
    policeRecorded: {
      status: "available",
      title: "Crimes recorded by the police",
      sourceLabel: "Home Office police recorded crime, published by ONS",
      sourceClass: "official-statistics",
      summary: recordedCrime
        ? `Police recorded around ${recordedCrime[1]} million crimes excluding fraud and computer misuse, ${recordedCrime[2]}% fewer than the previous year.`
        : "This edition reports police-recorded figures for lower-volume, higher-harm offences; it does not state a total for police-recorded crime excluding fraud and computer misuse, so no total is shown.",
      caveat:
        "Police-recorded crime is not the preferred measure for general crime trends because reporting, recording practices and police activity change. It is more useful for lower-volume, higher-harm offences. Recorded fraud and computer misuse are excluded while the new Report Fraud system is being introduced.",
      measures: [
        ...(recordedCrime
          ? [
              measure(
                "recordedCrime",
                "Recorded crime excluding fraud and computer misuse",
                million(recordedCrime[1], "police-recorded crime"),
                "recorded offences",
                decrease(integer(recordedCrime[2], "police-recorded crime percentage"))
              ),
            ]
          : []),
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
    justice: {
      status: "unavailable",
      title: "Criminal court timeliness",
      reason: "No Ministry of Justice release has been collected and validated with this edition. The earlier checked-in figures are not presented as current evidence.",
    },
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

async function buildCrimeStatistics(now = new Date(), fetchImpl = fetch) {
  return collectCrimeStatistics(fetchImpl, now);
}

/**
 * Feed interface (target design 2.3). Wraps the existing collector without
 * changing what it fetches or returns.
 *
 * @param {{fetch: typeof fetch, now: Date}} ctx
 */
async function collect(ctx) {
  return { data: await buildCrimeStatistics(ctx.now, ctx.fetch) };
}

export {
  buildCrimeStatistics,
  canonicalPeriod,
  collect,
  collectCrimeStatistics,
  display,
  parseOnsCrimeBulletin,
  publisherStatements,
};
