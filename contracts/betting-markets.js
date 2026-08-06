const BETTING_SNAPSHOT_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const BETTING_SNAPSHOT_KEY = "v1:strict:bettingOdds";
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const BETTING_OBSERVATION_MAX_AGE_DAYS = 1;

const MARKET_DEFINITIONS = Object.freeze({
  nextPrimeMinister: Object.freeze({
    id: "nextPrimeMinister",
    title: "Next Prime Minister after Andy Burnham",
    sourceUrl:
      "https://www.oddschecker.com/politics/british-politics/next-prime-minister-after-andy-burnham",
    minimumRunners: 5,
  }),
  mostSeats: Object.freeze({
    id: "mostSeats",
    title: "Most seats at the next UK general election",
    sourceUrl:
      "https://www.oddschecker.com/politics/british-politics/next-uk-general-election/most-seats",
    minimumRunners: 3,
  }),
  electionYear: Object.freeze({
    id: "electionYear",
    title: "Year of the next UK general election",
    sourceUrl:
      "https://www.oddschecker.com/politics/british-politics/next-uk-general-election/year-of-next-general-election",
    minimumRunners: 2,
  }),
});

const EVIDENCE_POLICY = Object.freeze({
  sourceClass: "commercial-market-snapshot",
  priceType: "best available decimal odds shown by Oddschecker",
  probabilityMethod: "raw reciprocal decimal odds; no normalization to 100%",
  predictiveClaim: false,
  secondaryFallbackAllowed: false,
});

function requiredText(value, label, maximum = 300) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required`);
  if (text.length > maximum) throw new Error(`${label} is too long`);
  return text;
}

function parseTimestamp(value, label) {
  const text = requiredText(value, label, 80);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} must be an ISO timestamp`);
  return { text: new Date(timestamp).toISOString(), timestamp };
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeRunners(value, definition) {
  if (!Array.isArray(value) || value.length < definition.minimumRunners || value.length > 100) {
    throw new Error(
      `${definition.title} must contain between ${definition.minimumRunners} and 100 runners`
    );
  }

  const seen = new Set();
  const runners = value.map((runner, index) => {
    if (!runner || typeof runner !== "object" || Array.isArray(runner)) {
      throw new Error(`${definition.title} runner ${index + 1} must be an object`);
    }

    const name = requiredText(runner.name, `${definition.title} runner name`, 160);
    const identity = name.toLocaleLowerCase("en-GB");
    if (seen.has(identity)) {
      throw new Error(`${definition.title} contains duplicate runner '${name}'`);
    }
    seen.add(identity);

    const decimalOdds = runner.decimalOdds;
    if (
      typeof decimalOdds !== "number" ||
      !Number.isFinite(decimalOdds) ||
      decimalOdds <= 1 ||
      decimalOdds > 10000
    ) {
      throw new Error(`${definition.title} runner '${name}' has invalid decimal odds`);
    }

    return {
      name,
      decimalOdds: round(decimalOdds, 3),
      impliedProbability: round(100 / decimalOdds, 2),
    };
  });

  runners.sort((left, right) => {
    const byOdds = left.decimalOdds - right.decimalOdds;
    return byOdds || left.name.localeCompare(right.name, "en-GB");
  });
  return runners;
}

function normalizeMarket(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Each betting market must be an object");
  }

  const id = requiredText(value.id, "Market id", 80);
  const definition = MARKET_DEFINITIONS[id];
  if (!definition) throw new Error(`Unsupported betting market '${id}'`);
  if (value.title !== undefined && value.title !== definition.title) {
    throw new Error(`${definition.title} title does not match its approved market`);
  }
  if (value.sourceUrl !== definition.sourceUrl) {
    throw new Error(`${definition.title} source URL does not match its approved market`);
  }

  const runners = normalizeRunners(value.runners, definition);
  return {
    id,
    title: definition.title,
    sourceUrl: definition.sourceUrl,
    runnerCount: runners.length,
    marketBookPercent: round(
      runners.reduce((sum, runner) => sum + runner.impliedProbability, 0),
      2
    ),
    runners,
  };
}

function normalizeBettingMarketPayload(data, now = new Date()) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Missing betting market snapshot");
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Validation time is invalid");

  const provider = requiredText(data.provider, "Provider", 100);
  if (provider !== "Oddschecker") {
    throw new Error("Only Oddschecker public market snapshots are accepted");
  }

  const observed = parseTimestamp(data.observedAt, "Observed at");
  if (observed.timestamp > nowMs + FUTURE_TOLERANCE_MS) {
    throw new Error("Betting snapshot observation time cannot be in the future");
  }
  if (nowMs - observed.timestamp > BETTING_SNAPSHOT_MAX_AGE_MS) {
    throw new Error("Betting snapshot is older than four hours");
  }

  if (!Array.isArray(data.markets) || data.markets.length !== 3) {
    throw new Error("Betting snapshot must contain exactly three approved markets");
  }

  const markets = data.markets.map(normalizeMarket);
  const marketIds = markets.map((market) => market.id);
  const expectedIds = Object.keys(MARKET_DEFINITIONS);
  if (
    new Set(marketIds).size !== expectedIds.length ||
    expectedIds.some((id) => !marketIds.includes(id))
  ) {
    throw new Error("Betting snapshot must contain each approved market exactly once");
  }
  markets.sort((left, right) => expectedIds.indexOf(left.id) - expectedIds.indexOf(right.id));

  const expiresAt = new Date(observed.timestamp + BETTING_SNAPSHOT_MAX_AGE_MS).toISOString();
  return {
    available: true,
    provider,
    observedAt: observed.text,
    expiresAt,
    markets,
    evidencePolicy: { ...EVIDENCE_POLICY },
    __observation: {
      status: "current",
      period: observed.text,
      observedAt: observed.text,
      checkedAt: now.toISOString(),
      maxAgeDays: BETTING_OBSERVATION_MAX_AGE_DAYS,
    },
  };
}

function sameRunner(value, canonical) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.name === canonical.name &&
    value.decimalOdds === canonical.decimalOdds &&
    value.impliedProbability === canonical.impliedProbability
  );
}

function sameMarket(value, canonical) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.id === canonical.id &&
    value.title === canonical.title &&
    value.sourceUrl === canonical.sourceUrl &&
    value.runnerCount === canonical.runnerCount &&
    value.marketBookPercent === canonical.marketBookPercent &&
    Array.isArray(value.runners) &&
    value.runners.length === canonical.runners.length &&
    value.runners.every((runner, index) => sameRunner(runner, canonical.runners[index]))
  );
}

function sameEvidencePolicy(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.sourceClass === EVIDENCE_POLICY.sourceClass &&
    value.priceType === EVIDENCE_POLICY.priceType &&
    value.probabilityMethod === EVIDENCE_POLICY.probabilityMethod &&
    value.predictiveClaim === EVIDENCE_POLICY.predictiveClaim &&
    value.secondaryFallbackAllowed === EVIDENCE_POLICY.secondaryFallbackAllowed
  );
}

function validObservationMetadata(value, canonical, nowMs) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const checkedAt = Date.parse(value.checkedAt);
  const observedAt = Date.parse(canonical.observedAt);
  return (
    value.status === "current" &&
    value.period === canonical.observedAt &&
    value.observedAt === canonical.observedAt &&
    value.maxAgeDays === BETTING_OBSERVATION_MAX_AGE_DAYS &&
    Number.isFinite(checkedAt) &&
    checkedAt >= observedAt &&
    checkedAt <= nowMs + FUTURE_TOLERANCE_MS
  );
}

function isCurrentBettingMarketPayload(data, now = new Date()) {
  try {
    const nowMs = now.getTime();
    const canonical = normalizeBettingMarketPayload(data, now);
    return (
      data.available === canonical.available &&
      data.provider === canonical.provider &&
      data.observedAt === canonical.observedAt &&
      data.expiresAt === canonical.expiresAt &&
      Array.isArray(data.markets) &&
      data.markets.length === canonical.markets.length &&
      data.markets.every((market, index) => sameMarket(market, canonical.markets[index])) &&
      sameEvidencePolicy(data.evidencePolicy) &&
      validObservationMetadata(data.__observation, canonical, nowMs)
    );
  } catch {
    return false;
  }
}

export {
  BETTING_OBSERVATION_MAX_AGE_DAYS,
  BETTING_SNAPSHOT_KEY,
  BETTING_SNAPSHOT_MAX_AGE_MS,
  EVIDENCE_POLICY,
  MARKET_DEFINITIONS,
  isCurrentBettingMarketPayload,
  normalizeBettingMarketPayload,
};
