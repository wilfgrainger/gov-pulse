const DAY_MS = 24 * 60 * 60 * 1000;

const monthMap = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function validDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}

function parsePeriod(value, now) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return validDate(new Date(value));
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const text = value.trim();

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return validDate(
      new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    );
  }

  const onsMonthly = text.match(/^(\d{4})\s+([A-Za-z]{3})$/);
  if (onsMonthly) {
    const month = monthMap[onsMonthly[2].toLowerCase()];
    if (month !== undefined) {
      return validDate(new Date(Date.UTC(Number(onsMonthly[1]), month, 1)));
    }
  }

  const shortMonthly = text.match(/^([A-Za-z]{3})\s+(\d{2})$/);
  if (shortMonthly) {
    const month = monthMap[shortMonthly[1].toLowerCase()];
    if (month !== undefined) {
      return validDate(
        new Date(Date.UTC(2000 + Number(shortMonthly[2]), month, 1))
      );
    }
  }

  const quarter = text.match(/^(\d{4})\s+Q([1-4])$/i);
  if (quarter) {
    return validDate(
      new Date(Date.UTC(Number(quarter[1]), Number(quarter[2]) * 3 - 1, 1))
    );
  }

  const year = text.match(/^(\d{4})$/);
  if (year) {
    return validDate(new Date(Date.UTC(Number(year[1]), 11, 31)));
  }

  const pollMonth = text.match(/([A-Za-z]{3})(?:\s+(\d{4}))?$/);
  if (pollMonth) {
    const month = monthMap[pollMonth[1].toLowerCase()];
    if (month !== undefined) {
      let yearValue = pollMonth[2] ? Number(pollMonth[2]) : now.getUTCFullYear();
      let date = new Date(Date.UTC(yearValue, month, 1));
      if (!pollMonth[2] && date.getTime() - now.getTime() > 31 * DAY_MS) {
        yearValue -= 1;
        date = new Date(Date.UTC(yearValue, month, 1));
      }
      return validDate(date);
    }
  }

  return null;
}

function latestBy(values, selector, now) {
  if (!Array.isArray(values)) {
    return null;
  }

  let latest = null;
  for (const value of values) {
    const raw = selector(value);
    const date = parsePeriod(raw, now);
    if (date && (!latest || date.getTime() > latest.date.getTime())) {
      latest = { raw: String(raw), date };
    }
  }
  return latest;
}

function publishedObservation(data, now) {
  const releaseDate = parsePeriod(data?.headline?.releaseDate, now);
  const observedAt = parsePeriod(data?.headline?.observedAt, now);
  const period = data?.headline?.period;
  return releaseDate && observedAt && typeof period === "string" && period.trim()
    ? { raw: period.trim(), date: releaseDate, observedAt }
    : null;
}

function nhsPublishedObservation(data, now) {
  const publicationDate = parsePeriod(data?.headline?.publicationDate, now);
  const observedAt = parsePeriod(data?.headline?.observedAt, now);
  const period = data?.headline?.period;
  return publicationDate && observedAt && typeof period === "string" && period.trim()
    ? { raw: period.trim(), date: publicationDate, observedAt }
    : null;
}

const contracts = {
  electionPolling: {
    maxAgeDays: 45,
    extract(data, now) {
      return latestBy(data?.recentPolls, (entry) => entry?.date, now);
    },
  },
  sentimentPulse: {
    maxAgeDays: 75,
    extract(data, now) {
      return latestBy(data?.economicData, (entry) => entry?.date, now);
    },
  },
  gdpTracker: {
    maxAgeDays: 70,
    extract: publishedObservation,
  },
  employmentStats: {
    maxAgeDays: 70,
    extract: publishedObservation,
  },
  nationalDebt: {
    maxAgeDays: 70,
    extract(data, now) {
      const date = parsePeriod(data?.baseDate, now);
      return date ? { raw: date.toISOString().slice(0, 10), date } : null;
    },
  },
  taxRevenue: {
    maxAgeDays: 70,
    extract: publishedObservation,
  },
  migrationStats: {
    maxAgeDays: 220,
    extract: publishedObservation,
  },
  nhsStats: {
    maxAgeDays: 45,
    extract: nhsPublishedObservation,
  },
  crimeStatistics: {
    maxAgeDays: 450,
    extract: publishedObservation,
  },
};

export function applyObservationContracts(descriptors, nowProvider = () => new Date()) {
  for (const [section, contract] of Object.entries(contracts)) {
    const descriptor = descriptors[section];
    if (!descriptor?.build) {
      throw new Error(`Observation contract references missing build section '${section}'`);
    }

    const originalBuild = descriptor.build;
    descriptor.build = async () => {
      const data = await originalBuild();
      const now = nowProvider();
      const observation = contract.extract(data, now);

      if (!observation) {
        throw new Error(`Feed '${section}' did not expose a verifiable observation period`);
      }

      const ageMs = Math.max(0, now.getTime() - observation.date.getTime());
      if (ageMs > contract.maxAgeDays * DAY_MS) {
        throw new Error(
          `Feed '${section}' observation '${observation.raw}' is outside its ${contract.maxAgeDays}-day currentness contract`
        );
      }

      return {
        ...data,
        __observation: {
          status: "current",
          period: observation.raw,
          observedAt: (observation.observedAt ?? observation.date).toISOString(),
          checkedAt: now.toISOString(),
          maxAgeDays: contract.maxAgeDays,
        },
      };
    };
  }

  return descriptors;
}

export { contracts as OBSERVATION_CONTRACTS, parsePeriod };
