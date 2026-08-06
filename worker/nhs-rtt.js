const NHS_RTT_MAX_AGE_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;
const NHS_HOSTS = new Set(["www.england.nhs.uk", "england.nhs.uk"]);

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

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requiredText(value, label, maximum = 1000) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  if (text.length > maximum) throw new Error(`${label} is too long`);
  return text;
}

function finiteNumber(
  value,
  label,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${label} must be a finite number between ${minimum} and ${maximum}`);
  }
  return value;
}

function safeInteger(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function signedSafeInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    Math.abs(value) > maximum
  ) {
    throw new Error(`${label} must be an integer between -${maximum} and ${maximum}`);
  }
  return value;
}

function parseIsoDate(value, label) {
  const match =
    typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) throw new Error(`${label} must be an ISO date`);
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`${label} is not a valid calendar date`);
  }
  return date;
}

function periodEnd(period) {
  const match = String(period).match(/^([A-Za-z]+)\s+(\d{4})$/);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  if (!match || month === undefined) {
    throw new Error(`NHS RTT period '${period}' is invalid`);
  }
  return Date.UTC(Number(match[2]), month + 1, 0);
}

function requiredNhsUrl(value, label) {
  const text = requiredText(value, label);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== "https:" || !NHS_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`${label} must be an approved NHS England HTTPS URL`);
  }
  return url.toString();
}

function normalizeSpecialties(value) {
  if (!Array.isArray(value) || value.length < 5 || value.length > 12) {
    throw new Error("NHS RTT specialties must contain between 5 and 12 rows");
  }

  const seen = new Set();
  const specialties = value.map((entry, index) => {
    const row = requiredObject(entry, `Specialty row ${index + 1}`);
    const name = requiredText(row.name, `Specialty row ${index + 1} name`, 160);
    if (seen.has(name)) throw new Error(`Duplicate NHS RTT specialty '${name}'`);
    seen.add(name);
    return {
      name,
      incompletePathways: safeInteger(
        row.incompletePathways,
        `${name} incomplete pathways`,
        1,
        5_000_000
      ),
      within18WeeksPercent: finiteNumber(
        row.within18WeeksPercent,
        `${name} within-18-weeks percentage`,
        0,
        100
      ),
    };
  });

  return specialties.sort(
    (left, right) => right.incompletePathways - left.incompletePathways
  );
}

function normalizeMissingTrusts(value) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error(
      "NHS RTT missing-trust disclosure must be an array of at most 20 trusts"
    );
  }
  const codes = new Set();
  return value.map((entry, index) => {
    const trust = requiredObject(entry, `Missing trust ${index + 1}`);
    const code = requiredText(
      trust.code,
      `Missing trust ${index + 1} code`,
      10
    ).toUpperCase();
    if (!/^[A-Z0-9]{3,5}$/.test(code)) {
      throw new Error(`Missing trust code '${code}' is invalid`);
    }
    if (codes.has(code)) throw new Error(`Duplicate missing trust code '${code}'`);
    codes.add(code);
    return {
      name: requiredText(trust.name, `Missing trust ${index + 1} name`, 240),
      code,
    };
  });
}

const NHS_HISTORY_FIELDS = Object.freeze([
  "medianWaitWeeks",
  "percentile92WaitWeeks",
  "within18WeeksPercent",
  "over52Weeks",
  "over65Weeks",
  "over78Weeks",
  "over104Weeks",
  "waitingPathwaysEstimate",
  "uniquePatientsEstimate",
  "admittedCompleted",
  "nonAdmittedCompleted",
  "newPathways",
]);

function normalizeHistory(value) {
  if (!Array.isArray(value) || value.length < 13 || value.length > 120) {
    throw new Error("NHS RTT history must contain between 13 and 120 monthly observations");
  }
  let previousObservedAt = -1;
  return value.map((entry, index) => {
    const point = requiredObject(entry, `NHS RTT history row ${index + 1}`);
    const observedAt = safeInteger(
      point.observedAt,
      `NHS RTT history row ${index + 1} observedAt`,
      0
    );
    if (observedAt <= previousObservedAt) {
      throw new Error("NHS RTT history must be in chronological order");
    }
    previousObservedAt = observedAt;
    const normalized = {
      period: requiredText(point.period, `NHS RTT history row ${index + 1} period`, 40),
      observedAt,
    };
    for (const field of NHS_HISTORY_FIELDS) {
      const raw = point[field];
      normalized[field] =
        raw === null
          ? null
          : finiteNumber(raw, `NHS RTT history row ${index + 1} ${field}`, 0);
    }
    return normalized;
  });
}

function normalizeAnnualDelta(value) {
  const delta = requiredObject(value, "NHS RTT annual delta");
  return Object.fromEntries(
    NHS_HISTORY_FIELDS.map((field) => [
      field,
      delta[field] === null
        ? null
        : finiteNumber(delta[field], `NHS RTT annual delta ${field}`),
    ])
  );
}

function normalizeNhsRttPayload(data, now = new Date()) {
  const root = requiredObject(data, "NHS RTT payload");
  const headline = requiredObject(root.headline, "NHS RTT headline");
  const source = requiredObject(root.source, "NHS RTT source");

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Validation time is invalid");

  const period = requiredText(headline.period, "NHS RTT period", 40);
  const expectedObservedAt = periodEnd(period);
  const observedAt = safeInteger(headline.observedAt, "NHS RTT observedAt", 0);
  if (observedAt !== expectedObservedAt) {
    throw new Error("NHS RTT observedAt does not match the stated monthly period");
  }

  const publicationDate = parseIsoDate(
    headline.publicationDate,
    "NHS RTT publication date"
  );
  if (publicationDate.getTime() < observedAt) {
    throw new Error("NHS RTT publication date cannot precede the observation month end");
  }
  if (publicationDate.getTime() > nowMs + DAY_MS) {
    throw new Error("NHS RTT publication date cannot be in the future");
  }

  const waitingPathwaysEstimate = safeInteger(
    headline.waitingPathwaysEstimate,
    "NHS RTT waiting-pathway estimate",
    1_000_000,
    20_000_000
  );
  const uniquePatientsEstimate = safeInteger(
    headline.uniquePatientsEstimate,
    "NHS RTT unique-patient estimate",
    1,
    waitingPathwaysEstimate
  );
  const over52Weeks = safeInteger(
    headline.over52Weeks,
    "NHS RTT over-52-weeks count"
  );
  const over65Weeks = safeInteger(
    headline.over65Weeks,
    "NHS RTT over-65-weeks count"
  );
  const over78Weeks = safeInteger(
    headline.over78Weeks,
    "NHS RTT over-78-weeks count"
  );
  const over104Weeks = safeInteger(
    headline.over104Weeks,
    "NHS RTT over-104-weeks count"
  );
  if (
    !(
      over52Weeks >= over65Weeks &&
      over65Weeks >= over78Weeks &&
      over78Weeks >= over104Weeks
    )
  ) {
    throw new Error("NHS RTT long-wait thresholds are not monotonic");
  }

  const medianWaitWeeks = finiteNumber(
    headline.medianWaitWeeks,
    "NHS RTT median wait",
    0,
    200
  );
  const percentile92WaitWeeks = finiteNumber(
    headline.percentile92WaitWeeks,
    "NHS RTT 92nd-percentile wait",
    medianWaitWeeks,
    300
  );
  const yearChangePercent = finiteNumber(
    headline.yearChangePercent,
    "NHS RTT year change percentage",
    -100,
    100
  );
  const yearChangePathways = signedSafeInteger(
    headline.yearChangePathways,
    "NHS RTT year change pathways",
    10_000_000
  );
  if (
    (yearChangePercent < 0 && yearChangePathways > 0) ||
    (yearChangePercent > 0 && yearChangePathways < 0)
  ) {
    throw new Error(
      "NHS RTT year-change percentage and pathway count have different directions"
    );
  }

  const history = normalizeHistory(root.history);
  const annualDelta = normalizeAnnualDelta(root.annualDelta);
  const latestHistory = history.at(-1);
  if (
    latestHistory.observedAt !== observedAt ||
    Math.abs(latestHistory.waitingPathwaysEstimate - waitingPathwaysEstimate) > 100_000 ||
    Math.abs(latestHistory.uniquePatientsEstimate - uniquePatientsEstimate) > 100_000 ||
    latestHistory.within18WeeksPercent !== headline.within18WeeksPercent ||
    latestHistory.medianWaitWeeks !== medianWaitWeeks ||
    latestHistory.over52Weeks !== over52Weeks ||
    latestHistory.over65Weeks !== over65Weeks ||
    latestHistory.over78Weeks !== over78Weeks ||
    latestHistory.over104Weeks !== over104Weeks
  ) {
    throw new Error("NHS RTT time series does not reconcile with the current press notice");
  }
  if (
    annualDelta.waitingPathwaysEstimate !== yearChangePathways ||
    Math.abs(
      (annualDelta.waitingPathwaysEstimate /
        (latestHistory.waitingPathwaysEstimate - annualDelta.waitingPathwaysEstimate)) *
        100 -
        yearChangePercent
    ) > 0.15
  ) {
    throw new Error("NHS RTT annual delta does not reconcile with the press notice");
  }

  const normalized = {
    available: true,
    headline: {
      period,
      observedAt,
      publicationDate: publicationDate.toISOString().slice(0, 10),
      waitingPathwaysEstimate,
      waitingPathwaysDisplay: `${(waitingPathwaysEstimate / 1_000_000).toFixed(1)} million`,
      uniquePatientsEstimate,
      within18WeeksPercent: finiteNumber(
        headline.within18WeeksPercent,
        "NHS RTT within-18-weeks percentage",
        0,
        100
      ),
      standardPercent: finiteNumber(
        headline.standardPercent,
        "NHS RTT standard percentage",
        0,
        100
      ),
      medianWaitWeeks,
      percentile92WaitWeeks,
      over52Weeks,
      over65Weeks,
      over78Weeks,
      over104Weeks,
      yearChangePercent,
      yearChangePathways,
      newPathways: safeInteger(
        headline.newPathways,
        "NHS RTT new pathways",
        1,
        10_000_000
      ),
      admittedCompleted: safeInteger(
        headline.admittedCompleted,
        "NHS RTT admitted completions",
        1,
        10_000_000
      ),
      nonAdmittedCompleted: safeInteger(
        headline.nonAdmittedCompleted,
        "NHS RTT non-admitted completions",
        1,
        10_000_000
      ),
    },
    specialties: normalizeSpecialties(root.specialties),
    missingTrusts: normalizeMissingTrusts(root.missingTrusts),
    history,
    annualDelta,
    methodology: {
      geography: "England",
      measure: "Incomplete consultant-led referral-to-treatment pathways",
      waitingListUnit: "pathways",
      peopleCaveat:
        "Some patients are on more than one pathway, so the pathway total is not a count of unique people.",
      estimatesCaveat:
        "National headline figures include NHS England estimates for acute trusts that did not submit data. Treatment-function rows do not include those estimates.",
      revisionNote:
        "NHS England publishes periodic revisions, usually every six months, when providers submit corrections.",
    },
    source: {
      publisher: "NHS England",
      landingUrl: requiredNhsUrl(source.landingUrl, "NHS RTT landing URL"),
      dataPageUrl: requiredNhsUrl(source.dataPageUrl, "NHS RTT data-page URL"),
      pressNoticeUrl: requiredNhsUrl(
        source.pressNoticeUrl,
        "NHS RTT press-notice URL"
      ),
      timeseriesUrl: requiredNhsUrl(
        source.timeseriesUrl,
        "NHS RTT time-series URL"
      ),
    },
    evidencePolicy: {
      sourceClass: "official-primary",
      headlineIncludesMissingTrustEstimates: true,
      specialtiesIncludeMissingTrustEstimates: false,
      withdrawnSeries: [
        "A&E performance",
        "GP wait",
        "NHS workforce",
        "life expectancy",
      ],
    },
    __observation: {
      status: "current",
      period,
      observedAt: new Date(observedAt).toISOString(),
      checkedAt: now.toISOString(),
      maxAgeDays: NHS_RTT_MAX_AGE_DAYS,
    },
  };

  const expiresAt = new Date(
    publicationDate.getTime() + NHS_RTT_MAX_AGE_DAYS * DAY_MS
  );
  if (nowMs > expiresAt.getTime()) {
    throw new Error(
      `NHS RTT publication '${normalized.headline.publicationDate}' is older than ${NHS_RTT_MAX_AGE_DAYS} days`
    );
  }
  normalized.expiresAt = expiresAt.toISOString();

  return normalized;
}

function isCurrentNhsRttPayload(data, now = new Date()) {
  try {
    const normalized = normalizeNhsRttPayload(data, now);
    return normalized.expiresAt === data.expiresAt;
  } catch {
    return false;
  }
}

export {
  NHS_HOSTS,
  NHS_RTT_MAX_AGE_DAYS,
  isCurrentNhsRttPayload,
  normalizeNhsRttPayload,
};
