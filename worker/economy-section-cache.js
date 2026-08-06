import { isEconomicIndicatorsPayload } from "./economic-indicators.js";

const MANAGED_SECTIONS = new Set([
  "sentimentPulse",
  "gdpTracker",
  "employmentStats",
  "taxRevenue",
]);
const inMemoryRecords = new Map();

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function onsSource(data) {
  return (
    typeof data?.source?.bulletinUrl === "string" &&
    data.source.bulletinUrl.startsWith("https://www.ons.gov.uk/")
  );
}

function isOfficialEconomyRecord(section, record, nowMs = Date.now()) {
  const data = record?.data;

  if (section === "sentimentPulse") {
    return isEconomicIndicatorsPayload(data, new Date(nowMs));
  }

  const headline = data?.headline;
  if (data?.available !== true || !onsSource(data) || typeof headline?.releaseDate !== "string") {
    return false;
  }

  if (section === "gdpTracker") {
    return (
      finite(headline.observedAt) &&
      finite(headline.monthlyGrowth) &&
      finite(headline.threeMonthGrowth) &&
      finite(headline.annualGrowth) &&
      Array.isArray(data.history) &&
      data.history.length >= 13 &&
      data.history.every(
        (point) =>
          finite(point?.observedAt) &&
          finite(point?.index) &&
          finite(point?.monthlyGrowth) &&
          finite(point?.annualGrowth) &&
          finite(point?.threeMonthGrowth)
      ) &&
      !("gdpHistory" in data) &&
      !("g7Comparison" in data) &&
      !("sectorBreakdown" in data)
    );
  }

  if (section === "employmentStats") {
    return (
      finite(headline.observedAt) &&
      finite(headline.employmentRate) &&
      finite(headline.unemploymentRate) &&
      finite(headline.inactivityRate) &&
      finite(headline.vacancies) &&
      Array.isArray(data.history?.labourForce) &&
      data.history.labourForce.length >= 13 &&
      Array.isArray(data.history?.vacancies) &&
      data.history.vacancies.length >= 13 &&
      data.history.labourForce.every(
        (point) =>
          finite(point?.observedAt) &&
          finite(point?.employmentRate) &&
          finite(point?.unemploymentRate) &&
          finite(point?.inactivityRate)
      ) &&
      data.history.vacancies.every(
        (point) => finite(point?.observedAt) && finite(point?.vacancies)
      ) &&
      Object.values(data.annualDelta ?? {}).every(finite) &&
      !("publicVsPrivate" in data) &&
      !("publicBreakdown" in data) &&
      !("employmentTrend" in data)
    );
  }

  if (section === "taxRevenue") {
    return (
      finite(headline.observedAt) &&
      finite(headline.receiptsBillion) &&
      finite(headline.yearChangeBillion) &&
      Array.isArray(data.history) &&
      data.history.length >= 13 &&
      data.history.every(
        (point) => finite(point?.observedAt) && finite(point?.receiptsBillion)
      ) &&
      !("taxCategories" in data) &&
      !("taxBurdenHistory" in data) &&
      !("totalReceipts" in data)
    );
  }

  return false;
}

function isFreshEconomyRecord(section, record, descriptors, nowMs = Date.now()) {
  if (!isOfficialEconomyRecord(section, record, nowMs)) {
    return false;
  }

  const fetchedAt = Date.parse(record?.fetchedAt ?? "");
  const freshTtlSeconds = descriptors[section]?.freshTtlSeconds;
  return (
    Number.isFinite(fetchedAt) &&
    Number.isFinite(freshTtlSeconds) &&
    Math.max(0, nowMs - fetchedAt) <= freshTtlSeconds * 1000
  );
}

async function readRecord(env, section) {
  const key = `v10:section:${section}`;
  if (env?.METRICS_CACHE?.get) {
    try {
      return await env.METRICS_CACHE.get(key, "json");
    } catch (error) {
      console.warn(`public-data.org could not read ${section} during cache migration`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
  return inMemoryRecords.get(section) ?? null;
}

async function writeRecord(env, section, record) {
  const key = `v10:section:${section}`;
  if (env?.METRICS_CACHE?.put) {
    await env.METRICS_CACHE.put(key, JSON.stringify(record));
  } else {
    inMemoryRecords.set(section, record);
  }
}

function createEconomySectionCache(descriptors) {
  return {
    async ensure(section, env) {
      if (!MANAGED_SECTIONS.has(section) || typeof descriptors[section]?.build !== "function") {
        throw new Error(`Unsupported managed economy section '${section}'`);
      }

      const cached = await readRecord(env, section);
      if (isFreshEconomyRecord(section, cached, descriptors)) {
        return cached;
      }

      const data = await descriptors[section].build();
      const record = {
        section,
        data,
        fetchedAt: new Date().toISOString(),
        sourceLabel: descriptors[section].source,
        backend: "verified-data-service",
      };
      await writeRecord(env, section, record);
      return record;
    },
  };
}

export {
  MANAGED_SECTIONS,
  createEconomySectionCache,
  isFreshEconomyRecord,
  isOfficialEconomyRecord,
};
