const DAY_MS = 24 * 60 * 60 * 1000;
const CRIME_RELEASE_MAX_AGE_DAYS = 120;
const CRIME_RELEASE_MAX_AGE_MS = CRIME_RELEASE_MAX_AGE_DAYS * DAY_MS;
const CRIME_OBSERVATION_MAX_AGE_DAYS = 220;
const JUSTICE_PUBLICATION_MAX_AGE_DAYS = 180;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const ONS_PUBLICATION_LANDING_URL =
  "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/latest";
const ONS_PUBLICATION_PATH =
  /^\/peoplepopulationandcommunity\/crimeandjustice\/bulletins\/crimeinenglandandwales\/yearending[a-z]+20\d{2}\/?$/i;
const MOJ_PUBLICATION_URL =
  "https://www.gov.uk/government/statistics/criminal-court-statistics-quarterly-january-to-march-2026/criminal-court-statistics-quarterly-january-to-march-2026";
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

const REQUIRED_CSEW_IDS = Object.freeze([
  "headlineCrime",
  "theft",
  "otherHouseholdTheft",
  "fraud",
  "computerMisuse",
  "violence",
  "criminalDamage",
]);
const REQUIRED_POLICE_IDS = Object.freeze([
  "recordedCrime",
  "homicide",
  "knife",
  "firearms",
  "personalRobbery",
  "shoplifting",
]);
const REQUIRED_JUSTICE_IDS = Object.freeze([
  "magistratesChargeToCompletion",
  "crownChargeToCompletion",
  "crownOffenceToCompletion",
]);

function requiredText(value, label, maximum = 500) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  if (text.length > maximum) throw new Error(`${label} is too long`);
  return text;
}

function dateOnly(value, label) {
  const text = requiredText(value, label, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`${label} must be an ISO date`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`${label} must be a valid calendar date`);
  }
  return text;
}

function approvedOnsPublicationUrl(value) {
  const text = requiredText(value, "Crime publication URL", 1000);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Crime publication URL must be valid");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "www.ons.gov.uk" ||
    !ONS_PUBLICATION_PATH.test(url.pathname)
  ) {
    throw new Error("Crime publication URL is not an approved ONS edition");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function periodParts(period) {
  const match = String(period).trim().match(/^Year ending ([A-Za-z]+) (20\d{2})$/i);
  const monthName = match?.[1]?.toLowerCase();
  const month = monthName ? MONTHS[monthName] : undefined;
  if (!match || month === undefined) {
    throw new Error("Crime publication period must be a named year-ending month");
  }
  return { month, monthName, year: Number(match[2]) };
}

function periodEnd(period) {
  const { month, year } = periodParts(period);
  return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
}

function publicationSlugForPeriod(period) {
  const { monthName, year } = periodParts(period);
  return `yearending${monthName}${year}`;
}

function validatePublicationIdentity(publicationUrl, period) {
  const url = new URL(publicationUrl);
  const slug = url.pathname.replace(/\/$/, "").split("/").at(-1)?.toLowerCase();
  const expected = publicationSlugForPeriod(period);
  if (slug !== expected) {
    throw new Error(
      `Crime publication URL edition '${slug ?? "missing"}' does not match period '${period}'`
    );
  }
}

function normalizeMeasure(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  if (typeof value.value !== "number" || !Number.isFinite(value.value) || value.value < 0) {
    throw new Error(`${label} value must be a non-negative number`);
  }
  return {
    id: requiredText(value.id, `${label} id`, 80),
    label: requiredText(value.label, `${label} label`, 160),
    value: value.value,
    displayValue: requiredText(value.displayValue, `${label} display value`, 80),
    unit: requiredText(value.unit, `${label} unit`, 80),
    changeLabel: requiredText(value.changeLabel, `${label} change`, 240),
  };
}

function normalizeMeasures(values, expectedIds, label) {
  if (!Array.isArray(values) || values.length !== expectedIds.length) {
    throw new Error(`${label} must contain exactly ${expectedIds.length} measures`);
  }
  const normalized = values.map((value, index) =>
    normalizeMeasure(value, `${label} measure ${index + 1}`)
  );
  const ids = normalized.map((measure) => measure.id);
  if (new Set(ids).size !== expectedIds.length || expectedIds.some((id) => !ids.includes(id))) {
    throw new Error(`${label} must contain each approved measure exactly once`);
  }
  normalized.sort((left, right) => expectedIds.indexOf(left.id) - expectedIds.indexOf(right.id));
  return normalized;
}

function normalizeOfficialModule(value, expectedIds, label, sourceUrl = null) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.status !== "available") {
    throw new Error(`${label} must be available`);
  }
  const result = {
    status: "available",
    title: requiredText(value.title, `${label} title`, 160),
    sourceLabel: requiredText(value.sourceLabel, `${label} source label`, 200),
    summary: requiredText(value.summary, `${label} summary`, 600),
    caveat: requiredText(value.caveat, `${label} caveat`, 1200),
    measures: normalizeMeasures(value.measures, expectedIds, label),
  };
  if (value.sourceClass !== undefined) {
    result.sourceClass = requiredText(value.sourceClass, `${label} source class`, 80);
  }
  if (value.dataSnapshotDate !== undefined) {
    result.dataSnapshotDate = dateOnly(value.dataSnapshotDate, `${label} data snapshot date`);
  }
  if (sourceUrl) {
    if (value.sourceUrl !== sourceUrl) throw new Error(`${label} source URL is not approved`);
    result.sourceUrl = sourceUrl;
    result.period = requiredText(value.period, `${label} period`, 100);
    result.releaseDate = dateOnly(value.releaseDate, `${label} release date`);
  }
  return result;
}

function normalizeCrimeStatisticsPayload(data, now = new Date()) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Missing crime publication payload");
  }
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Validation time is invalid");

  const headline = data.headline;
  if (!headline || typeof headline !== "object" || Array.isArray(headline)) {
    throw new Error("Crime publication headline is required");
  }
  if (headline.publisher !== "Office for National Statistics") {
    throw new Error("Crime publication publisher must be the Office for National Statistics");
  }
  const publicationUrl = approvedOnsPublicationUrl(headline.publicationUrl);
  const period = requiredText(headline.period, "Crime publication period", 100);
  validatePublicationIdentity(publicationUrl, period);
  const observedAt = dateOnly(headline.observedAt, "Crime observation date");
  if (observedAt !== periodEnd(period)) {
    throw new Error("Crime observation date must match the named year-ending period");
  }
  const releaseDate = dateOnly(headline.releaseDate, "Crime release date");
  const nextReleaseDate = dateOnly(headline.nextReleaseDate, "Next crime release date");
  const releaseMs = Date.parse(`${releaseDate}T00:00:00Z`);
  const nextReleaseMs = Date.parse(`${nextReleaseDate}T00:00:00Z`);
  if (releaseMs > nowMs + FUTURE_TOLERANCE_MS) {
    throw new Error("Crime publication cannot be future dated");
  }
  if (nextReleaseMs <= releaseMs) {
    throw new Error("Next crime release must follow the current release");
  }
  if (nowMs >= nextReleaseMs) {
    throw new Error("Crime publication has reached its scheduled replacement date");
  }
  if (nowMs - releaseMs > CRIME_RELEASE_MAX_AGE_MS) {
    throw new Error("Crime publication is outside the release currentness window");
  }
  if (headline.geography !== "England and Wales") {
    throw new Error("Crime geography must be England and Wales");
  }

  const regional = data.regional;
  if (!regional || regional.status !== "unavailable") {
    throw new Error("Regional crime comparisons must remain unavailable until reproducible");
  }
  if (
    data.evidencePolicy?.combinedTotalAllowed !== false ||
    data.evidencePolicy?.modulesValidatedIndependently !== true ||
    data.evidencePolicy?.regionalRankingPublished !== false
  ) {
    throw new Error("Crime evidence policy must prohibit combined totals and regional rankings");
  }

  const justice = normalizeOfficialModule(
    data.justice,
    REQUIRED_JUSTICE_IDS,
    "Justice module",
    MOJ_PUBLICATION_URL
  );
  const justiceReleaseMs = Date.parse(`${justice.releaseDate}T00:00:00Z`);
  if (
    justiceReleaseMs > nowMs + FUTURE_TOLERANCE_MS ||
    nowMs - justiceReleaseMs > JUSTICE_PUBLICATION_MAX_AGE_DAYS * DAY_MS
  ) {
    throw new Error("Justice publication is outside its currentness window");
  }

  return {
    available: data.available === true,
    expiresAt: `${nextReleaseDate}T00:00:00.000Z`,
    headline: {
      publisher: headline.publisher,
      publicationTitle: requiredText(headline.publicationTitle, "Crime publication title", 200),
      publicationUrl,
      period,
      observedAt,
      releaseDate,
      nextReleaseDate,
      geography: headline.geography,
    },
    crimeSurvey: normalizeOfficialModule(
      data.crimeSurvey,
      REQUIRED_CSEW_IDS,
      "Crime Survey module"
    ),
    policeRecorded: normalizeOfficialModule(
      data.policeRecorded,
      REQUIRED_POLICE_IDS,
      "Police-recorded module"
    ),
    justice,
    regional: {
      status: "unavailable",
      title: requiredText(regional.title, "Regional module title", 160),
      reason: requiredText(regional.reason, "Regional module reason", 600),
    },
    evidencePolicy: {
      combinedTotalAllowed: false,
      modulesValidatedIndependently: true,
      regionalRankingPublished: false,
    },
  };
}

function observationFor(data, checkedAt = new Date()) {
  return {
    status: "current",
    period: data.headline.period,
    observedAt: `${data.headline.observedAt}T00:00:00.000Z`,
    checkedAt: checkedAt.toISOString(),
    maxAgeDays: CRIME_OBSERVATION_MAX_AGE_DAYS,
  };
}

function buildCurrentCrimeStatisticsPayload(data, now = new Date()) {
  const normalized = normalizeCrimeStatisticsPayload(data, now);
  return { ...normalized, __observation: observationFor(normalized, now) };
}

function isCurrentCrimeStatisticsPayload(data, now = new Date()) {
  try {
    const canonical = normalizeCrimeStatisticsPayload(data, now);
    const observation = data.__observation;
    const checkedAt = Date.parse(observation?.checkedAt ?? "");
    return (
      canonical.available === true &&
      data.expiresAt === canonical.expiresAt &&
      observation?.status === "current" &&
      observation?.period === canonical.headline.period &&
      observation?.observedAt === `${canonical.headline.observedAt}T00:00:00.000Z` &&
      observation?.maxAgeDays === CRIME_OBSERVATION_MAX_AGE_DAYS &&
      Number.isFinite(checkedAt) &&
      checkedAt <= now.getTime() + FUTURE_TOLERANCE_MS
    );
  } catch {
    return false;
  }
}

export {
  CRIME_OBSERVATION_MAX_AGE_DAYS,
  CRIME_RELEASE_MAX_AGE_DAYS,
  CRIME_RELEASE_MAX_AGE_MS,
  JUSTICE_PUBLICATION_MAX_AGE_DAYS,
  MOJ_PUBLICATION_URL,
  ONS_PUBLICATION_LANDING_URL,
  ONS_PUBLICATION_PATH,
  approvedOnsPublicationUrl,
  buildCurrentCrimeStatisticsPayload,
  isCurrentCrimeStatisticsPayload,
  normalizeCrimeStatisticsPayload,
  periodEnd,
  publicationSlugForPeriod,
  validatePublicationIdentity,
};
