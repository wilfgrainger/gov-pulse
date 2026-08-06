const PRIMARY_POLL_MAX_AGE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const ALLOWED_SOURCE_HOSTS = new Set([
  "yougov.com",
  "www.yougov.com",
  "yougov.co.uk",
  "www.yougov.co.uk",
  "ygo-assets-websites-editorial-emea.yougov.net",
  "d3nkl3psvxxpe9.cloudfront.net",
]);

const PARTY_LABELS = Object.freeze({
  conservative: "Conservative",
  labour: "Labour",
  liberalDemocrats: "Liberal Democrats",
  reformUK: "Reform UK",
  green: "Green",
  snp: "SNP",
  plaidCymru: "Plaid Cymru",
  yourParty: "Your Party",
  restoreBritain: "Restore Britain",
  other: "Other",
});

function parseDateOnly(value, label) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) {
    throw new Error(`${label} must be an ISO date`);
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`${label} is not a valid calendar date`);
  }
  return date;
}

function requiredText(value, label, maximum = 500) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`${label} is required`);
  }
  if (text.length > maximum) {
    throw new Error(`${label} is too long`);
  }
  return text;
}

function requiredUrl(value, label) {
  const text = requiredText(value, label, 1000);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
  if (!ALLOWED_SOURCE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`${label} host '${url.hostname}' is not an approved primary publisher`);
  }
  return url.toString();
}

function normalizeParties(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Poll parties must be an object");
  }

  const parties = {};
  for (const [key, label] of Object.entries(PARTY_LABELS)) {
    if (!(key in value)) {
      continue;
    }
    const share = value[key];
    if (typeof share !== "number" || !Number.isFinite(share) || share < 0 || share > 100) {
      throw new Error(`${label} share must be a number between 0 and 100`);
    }
    parties[key] = Number(share.toFixed(1));
  }

  for (const required of ["conservative", "labour", "liberalDemocrats", "reformUK", "green"]) {
    if (!(required in parties)) {
      throw new Error(`Poll is missing ${PARTY_LABELS[required]}`);
    }
  }

  const total = Object.values(parties).reduce((sum, share) => sum + share, 0);
  if (total < 95 || total > 105) {
    throw new Error(`Published party shares must total approximately 100, received ${total}`);
  }

  return parties;
}

function normalizePoll(value, nowMs) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Each poll must be an object");
  }

  const publicationDate = parseDateOnly(value.publicationDate, "Publication date");
  const fieldworkStart = parseDateOnly(value.fieldworkStart, "Fieldwork start");
  const fieldworkEnd = parseDateOnly(value.fieldworkEnd, "Fieldwork end");
  if (fieldworkStart.getTime() > fieldworkEnd.getTime()) {
    throw new Error("Fieldwork start must not be after fieldwork end");
  }
  if (publicationDate.getTime() < fieldworkEnd.getTime()) {
    throw new Error("Publication date must not precede fieldwork end");
  }
  if (publicationDate.getTime() > nowMs + DAY_MS) {
    throw new Error("Publication date cannot be in the future");
  }

  const sampleSize = value.sampleSize;
  if (
    typeof sampleSize !== "number" ||
    !Number.isInteger(sampleSize) ||
    sampleSize < 500 ||
    sampleSize > 100000
  ) {
    throw new Error("Sample size must be an integer between 500 and 100000");
  }

  const sourceUrl = requiredUrl(value.sourceUrl, "Primary source URL");
  const methodologyUrl = requiredUrl(value.methodologyUrl, "Methodology URL");

  if (value.bpcMember !== true) {
    throw new Error("Only British Polling Council member publications are accepted");
  }

  return {
    id: requiredText(value.id, "Poll id", 160),
    pollster: requiredText(value.pollster, "Pollster", 100),
    commissioner: requiredText(value.commissioner, "Commissioner", 160),
    title: requiredText(value.title, "Poll title", 300),
    questionText: requiredText(value.questionText, "Question wording", 600),
    publicationDate: publicationDate.toISOString().slice(0, 10),
    fieldworkStart: fieldworkStart.toISOString().slice(0, 10),
    fieldworkEnd: fieldworkEnd.toISOString().slice(0, 10),
    sampleSize,
    geography: requiredText(value.geography, "Geography", 100),
    population: requiredText(value.population, "Population", 160),
    mode: requiredText(value.mode, "Mode", 160),
    headlineMethod: requiredText(value.headlineMethod, "Headline method", 500),
    parties: normalizeParties(value.parties),
    sourceUrl,
    methodologyUrl,
    bpcMember: true,
    uncertainty: requiredText(value.uncertainty, "Uncertainty statement", 600),
  };
}

function normalizePrimaryPollPayload(data, now = new Date()) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Missing primary election poll payload");
  }
  if (!Array.isArray(data.polls) || data.polls.length === 0 || data.polls.length > 20) {
    throw new Error("Primary election poll payload must contain between 1 and 20 polls");
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error("Validation time is invalid");
  }

  const polls = data.polls.map((poll) => normalizePoll(poll, nowMs));
  const sourceUrls = new Set();
  const ids = new Set();
  for (const poll of polls) {
    if (sourceUrls.has(poll.sourceUrl) || ids.has(poll.id)) {
      throw new Error("Primary poll publications must be unique");
    }
    sourceUrls.add(poll.sourceUrl);
    ids.add(poll.id);
  }

  polls.sort((left, right) => {
    const byFieldwork = right.fieldworkEnd.localeCompare(left.fieldworkEnd);
    return byFieldwork || right.publicationDate.localeCompare(left.publicationDate);
  });

  const latestPublicationDate = polls.reduce(
    (latest, poll) => (poll.publicationDate > latest ? poll.publicationDate : latest),
    polls[0].publicationDate
  );
  const latestDate = parseDateOnly(latestPublicationDate, "Latest publication date");
  const expiresAt = new Date(latestDate.getTime() + PRIMARY_POLL_MAX_AGE_DAYS * DAY_MS);
  if (nowMs > expiresAt.getTime()) {
    throw new Error(
      `Latest primary poll publication '${latestPublicationDate}' is older than ${PRIMARY_POLL_MAX_AGE_DAYS} days`
    );
  }

  return {
    available: true,
    latestPublicationDate,
    expiresAt: expiresAt.toISOString(),
    polls,
    aggregation: {
      method: "none",
      explanation:
        "public-data.org shows each verified primary poll publication separately and does not calculate an average.",
    },
    evidencePolicy: {
      sourceClass: "primary-pollster-publication",
      bpcDisclosureRequired: true,
      secondaryAggregatorsUsedAsData: false,
    },
    __observation: {
      status: "current",
      period:
        polls[0].fieldworkStart === polls[0].fieldworkEnd
          ? polls[0].fieldworkEnd
          : `${polls[0].fieldworkStart}/${polls[0].fieldworkEnd}`,
      observedAt: `${polls[0].fieldworkEnd}T00:00:00.000Z`,
      checkedAt: now.toISOString(),
      maxAgeDays: PRIMARY_POLL_MAX_AGE_DAYS,
    },
  };
}

function isCurrentPrimaryPollPayload(data, now = new Date()) {
  try {
    const normalized = normalizePrimaryPollPayload(data, now);
    return normalized.expiresAt === data.expiresAt;
  } catch {
    return false;
  }
}

export {
  ALLOWED_SOURCE_HOSTS,
  PARTY_LABELS,
  PRIMARY_POLL_MAX_AGE_DAYS,
  isCurrentPrimaryPollPayload,
  normalizePrimaryPollPayload,
};
