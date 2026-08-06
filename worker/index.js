/**
 * Cloudflare Worker backend for public-data.org metrics.
 *
 * This worker is the primary backend:
 * - fetches live public-source data
 * - caches section payloads in KV when configured
 * - refreshes on schedule via cron triggers
 * - serves cached data to the frontend at /metrics and /all
 *
 * If KV is not configured, the worker falls back to isolate memory.
 * That is acceptable for local dev, but not for production scale.
 */

const ONS_CSV_BASE = "https://www.ons.gov.uk/generator?format=csv&uri=";
const WIKI_POLLING_URL =
  "https://en.wikipedia.org/wiki/Opinion_polling_for_the_next_United_Kingdom_general_election";
const NHS_RTT_URL =
  "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2024-25/";
const BOE_BANK_RATE_URL = "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp";

const CACHE_VERSION = "v10";
const HOT_CACHE_TTL_MS = 60 * 1000;
const DEFAULT_FRESH_TTL_SECONDS = 4 * 60 * 60;
const DEFAULT_STALE_TTL_SECONDS = 24 * 60 * 60;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "gov-pulse-source-checker/4.0";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Refresh-Secret",
};

const monthMap = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const ONS_SERIES = {
  cpi: "/economy/inflationandpriceindices/timeseries/d7g7/mm23",
  unemployment:
    "/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
  employment:
    "/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/timeseries/lf24/lms",
  gdp_growth: "/economy/grossdomesticproductgdp/timeseries/ihyq/pn2",
  gdp_level: "/economy/grossdomesticproductgdp/timeseries/abmi/pn2",
  psnd:
    "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf",
  psnb:
    "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/j5ii/pusf",
  debt_gdp:
    "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf",
  tax_receipts:
    "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/mf73/pusf",
  net_migration:
    "/peoplepopulationandcommunity/populationandmigration/internationalmigration/timeseries/cimu/mig",
  immigration:
    "/peoplepopulationandcommunity/populationandmigration/internationalmigration/timeseries/ciml/mig",
  emigration:
    "/peoplepopulationandcommunity/populationandmigration/internationalmigration/timeseries/cimm/mig",
};

const inMemoryStore = new Map();
const hotCache = new Map();
const upstreamTextCache = new Map();

const SENTIMENT_METRIC_CONFIG = {
  inflation: { label: "CPI INFLATION", unit: "%", color: "#FF3B00", current: "3.0%", target: "2.0% target" },
  bankRate: { label: "BANK OF ENGLAND RATE", unit: "%", color: "#000000", current: "3.75%", target: "Monetary policy" },
  unemployment: { label: "UNEMPLOYMENT RATE", unit: "%", color: "#666666", current: "5.2%", target: "ONS LFS (Oct-Dec 2025)" },
};

const NATIONAL_DEBT_CONTEXT = {
  population: 67_960_000,
  gdp: 2_950_000_000_000,
  milestones: [
    { year: "2008", amount: "GBP0.53T", event: "Financial Crisis" },
    { year: "2015", amount: "GBP1.60T", event: "Austerity Era" },
    { year: "2020", amount: "GBP2.02T", event: "COVID-19 Pandemic" },
    { year: "2024", amount: "GBP2.70T", event: "Post-COVID Recovery" },
  ],
};

const TAX_CATEGORIES = [
  { name: "Income Tax", amount: 269, pct: 31.9, change: 4.2 },
  { name: "National Insurance", amount: 180, pct: 21.4, change: 3.1 },
  { name: "VAT", amount: 172, pct: 20.4, change: 2.8 },
  { name: "Corporation Tax", amount: 89, pct: 10.6, change: 21.5 },
  { name: "Council Tax", amount: 46, pct: 5.5, change: 5.0 },
  { name: "Fuel Duty", amount: 25, pct: 3.0, change: -1.2 },
  { name: "Stamp Duty", amount: 15, pct: 1.8, change: -8.3 },
  { name: "Other", amount: 47, pct: 5.4, change: 1.5 },
];

const TAX_BURDEN_HISTORY = [
  { year: "2010", pct: 32.3 },
  { year: "2012", pct: 32.9 },
  { year: "2014", pct: 32.4 },
  { year: "2016", pct: 33.2 },
  { year: "2018", pct: 33.5 },
  { year: "2020", pct: 33.0 },
  { year: "2022", pct: 35.3 },
  { year: "2024", pct: 37.0 },
  { year: "2025F", pct: 37.7 },
];

const TAX_REVENUE_FALLBACK = {
  totalReceipts: 843,
  taxBurdenHistory: TAX_BURDEN_HISTORY,
  taxCategories: TAX_CATEGORIES,
};

const ELECTION_POLLING_FALLBACK = {
  pollingData: [
    { party: "REF", name: "Reform UK", pct: 28, color: "#12B6CF", change: 14 },
    { party: "LAB", name: "Labour", pct: 21, color: "#E4003B", change: -13 },
    { party: "CON", name: "Conservative", pct: 18, color: "#0087DC", change: -6 },
    { party: "GRN", name: "Green", pct: 12, color: "#6AB023", change: 5 },
    { party: "LD", name: "Liberal Democrats", pct: 12, color: "#FAA61A", change: 1 },
    { party: "SNP", name: "SNP", pct: 3, color: "#FFF95D", change: -1 },
    { party: "OTH", name: "Others", pct: 6, color: "#999999", change: 0 },
  ],
  recentPolls: [
    { pollster: "More in Common", date: "Mar 2026", lab: 22, con: 19, ref: 30, ld: 13 },
    { pollster: "YouGov", date: "Mar 2026", lab: 20, con: 18, ref: 28, ld: 12 },
    { pollster: "Savanta", date: "Feb 2026", lab: 21, con: 19, ref: 27, ld: 12 },
    { pollster: "Ipsos", date: "Feb 2026", lab: 22, con: 17, ref: 27, ld: 13 },
    { pollster: "R&W", date: "Feb 2026", lab: 19, con: 18, ref: 29, ld: 12 },
  ],
};

const PARTY_COLOR_MAP = {
  Labour: "#E4003B",
  "Reform UK": "#12B6CF",
  Conservative: "#0087DC",
  Green: "#6AB023",
  "Liberal Democrats": "#FAA61A",
  "Restore Britain": "#666666",
  "Workers Party": "#8B1E3F",
  Various: "#999999",
};

const GDP_FALLBACK = {
  gdpHistory: [
    { year: "2018", total: 2.174, perCapita: 32720, growth: 1.4 },
    { year: "2019", total: 2.255, perCapita: 33794, growth: 1.6 },
    { year: "2020", total: 2.037, perCapita: 30423, growth: -10.4 },
    { year: "2021", total: 2.202, perCapita: 32857, growth: 8.7 },
    { year: "2022", total: 2.236, perCapita: 33270, growth: 4.3 },
    { year: "2023", total: 2.253, perCapita: 33312, growth: 0.3 },
    { year: "2024", total: 2.274, perCapita: 33486, growth: 0.9 },
    { year: "2025F", total: 2.299, perCapita: 33760, growth: 1.1 },
  ],
  g7Comparison: [
    { country: "United States", perCapita: 85370, color: "#3b82f6" },
    { country: "Germany", perCapita: 52820, color: "#333" },
    { country: "Canada", perCapita: 52090, color: "#ef4444" },
    { country: "France", perCapita: 44410, color: "#333" },
    { country: "United Kingdom", perCapita: 48910, color: "#FF3B00" },
    { country: "Japan", perCapita: 33140, color: "#333" },
    { country: "Italy", perCapita: 37560, color: "#22c55e" },
  ],
  sectorBreakdown: [
    { sector: "Services", pct: 80.2, value: "GBP1.82T" },
    { sector: "Manufacturing", pct: 9.7, value: "GBP221B" },
    { sector: "Construction", pct: 6.3, value: "GBP143B" },
    { sector: "Agriculture", pct: 0.6, value: "GBP14B" },
    { sector: "Other", pct: 3.2, value: "GBP73B" },
  ],
};

const EMPLOYMENT_FALLBACK = {
  headline: {
    employmentRate: 74.9,
    totalEmployed: 33.1,
    unemploymentRate: 4.4,
    totalUnemployed: 1.5,
    inactivityRate: 21.6,
    totalInactive: 9.3,
    vacancies: 819,
    vacancyChange: -7.2,
  },
  publicVsPrivate: [
    { sector: "Private Sector", count: 27.5, pct: 82.3, change: -0.4, color: "#000" },
    { sector: "Public Sector", count: 5.94, pct: 17.7, change: 2.1, color: "#FF3B00" },
  ],
  publicBreakdown: [
    { category: "NHS", count: 1.55, pct: 26.1 },
    { category: "Education", count: 1.42, pct: 23.9 },
    { category: "Civil Service", count: 0.53, pct: 8.9 },
    { category: "Police", count: 0.21, pct: 3.5 },
    { category: "Armed Forces", count: 0.19, pct: 3.2 },
    { category: "Local Government", count: 1.18, pct: 19.9 },
    { category: "Other Public", count: 0.86, pct: 14.5 },
  ],
  employmentTrend: [
    { date: "2019", rate: 76.4, public: 5.38, private: 27.1 },
    { date: "2020", rate: 74.8, public: 5.61, private: 25.9 },
    { date: "2021", rate: 75.1, public: 5.72, private: 26.4 },
    { date: "2022", rate: 75.6, public: 5.76, private: 27.3 },
    { date: "2023", rate: 75.5, public: 5.85, private: 27.4 },
    { date: "2024", rate: 75.0, public: 5.91, private: 27.5 },
    { date: "2025", rate: 74.9, public: 5.94, private: 27.5 },
  ],
};

const MIGRATION_FALLBACK = {
  migrationHistory: [
    { year: "2015", net: 332, immigration: 631, emigration: 299 },
    { year: "2016", net: 233, immigration: 588, emigration: 355 },
    { year: "2017", net: 262, immigration: 602, emigration: 340 },
    { year: "2018", net: 271, immigration: 612, emigration: 341 },
    { year: "2019", net: 271, immigration: 641, emigration: 370 },
    { year: "2020", net: 92, immigration: 325, emigration: 233 },
    { year: "2021", net: 488, immigration: 740, emigration: 252 },
    { year: "2022", net: 764, immigration: 1095, emigration: 331 },
    { year: "2023", net: 906, immigration: 1218, emigration: 312 },
    { year: "2024", net: 728, immigration: 1106, emigration: 378 },
  ],
  visaTypes: [
    { type: "Work Visas", count: 337, pct: 30.5, change: -18 },
    { type: "Study Visas", count: 418, pct: 37.8, change: -15 },
    { type: "Family Visas", count: 120, pct: 10.9, change: 4 },
    { type: "Humanitarian", count: 82, pct: 7.4, change: -22 },
    { type: "Other", count: 149, pct: 13.4, change: -5 },
  ],
  topNationalities: [
    { country: "India", count: 253, color: "#FF3B00" },
    { country: "Nigeria", count: 141, color: "#333" },
    { country: "China", count: 92, color: "#333" },
    { country: "Pakistan", count: 73, color: "#333" },
    { country: "Philippines", count: 41, color: "#333" },
    { country: "Zimbabwe", count: 36, color: "#666" },
    { country: "Ukraine", count: 35, color: "#666" },
    { country: "Bangladesh", count: 32, color: "#666" },
  ],
};

const NHS_FALLBACK = {
  headline: {
    waitingList: 7.48,
    waitingListChange: -2.1,
    aePerformance: 71.4,
    aeTarget: 95,
    gpWait: 14.8,
    lifeExpMale: 79.0,
    lifeExpFemale: 82.9,
    nhsWorkforce: 1.55,
  },
  waitingTrend: [
    { date: "2019", list: 4.41 },
    { date: "2020", list: 4.95 },
    { date: "2021", list: 5.83 },
    { date: "2022", list: 7.21 },
    { date: "2023", list: 7.61 },
    { date: "2024", list: 7.54 },
    { date: "2025", list: 7.48 },
  ],
  waitingBySpecialty: [
    { specialty: "Orthopaedics", weeks: 24, patients: 821 },
    { specialty: "Ophthalmology", weeks: 18, patients: 654 },
    { specialty: "ENT", weeks: 20, patients: 512 },
    { specialty: "General Surgery", weeks: 19, patients: 498 },
    { specialty: "Dermatology", weeks: 16, patients: 423 },
    { specialty: "Cardiology", weeks: 15, patients: 312 },
    { specialty: "Gynaecology", weeks: 17, patients: 298 },
    { specialty: "Urology", weeks: 16, patients: 276 },
  ],
  lifeExpectancyTrend: [
    { year: "2010", male: 78.6, female: 82.6 },
    { year: "2012", male: 79.0, female: 82.8 },
    { year: "2014", male: 79.3, female: 83.0 },
    { year: "2016", male: 79.2, female: 82.9 },
    { year: "2018", male: 79.3, female: 83.0 },
    { year: "2020", male: 78.7, female: 82.7 },
    { year: "2022", male: 78.8, female: 82.8 },
    { year: "2024", male: 79.0, female: 82.9 },
  ],
};

function sectionCacheKey(section) {
  return `${CACHE_VERSION}:section:${section}`;
}

function datasetCacheKey() {
  return `${CACHE_VERSION}:dataset`;
}

function manifestCacheKey() {
  return `${CACHE_VERSION}:manifest`;
}

function nowIso() {
  return new Date().toISOString();
}

function getFreshTtlMs(env, overrideSeconds = null) {
  if (Number.isFinite(overrideSeconds) && overrideSeconds > 0) {
    return overrideSeconds * 1000;
  }
  const raw = Number.parseInt(env.DATA_REFRESH_TTL_SECONDS ?? "", 10);
  return (Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_FRESH_TTL_SECONDS) * 1000;
}

function getStaleTtlMs(env) {
  const raw = Number.parseInt(env.DATA_STALE_TTL_SECONDS ?? "", 10);
  return (Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STALE_TTL_SECONDS) * 1000;
}

function withCors(headers = {}) {
  return {
    ...CORS_HEADERS,
    ...headers,
  };
}

function jsonResponse(payload, init = {}) {
  const headers = withCors(init.headers);
  return Response.json(payload, { ...init, headers });
}

function errorResponse(message, status = 500, details) {
  return jsonResponse(
    {
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getHotValue(key) {
  const entry = hotCache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.timestamp > HOT_CACHE_TTL_MS) {
    hotCache.delete(key);
    return null;
  }
  return cloneJson(entry.value);
}

function setHotValue(key, value) {
  hotCache.set(key, { value: cloneJson(value), timestamp: Date.now() });
}

async function cacheGet(env, key) {
  const hot = getHotValue(key);
  if (hot !== null) {
    return hot;
  }

  if (env.METRICS_CACHE) {
    const value = await env.METRICS_CACHE.get(key, "json");
    if (value !== null) {
      setHotValue(key, value);
      return cloneJson(value);
    }
    return null;
  }

  if (!inMemoryStore.has(key)) {
    return null;
  }
  const value = inMemoryStore.get(key);
  setHotValue(key, value);
  return cloneJson(value);
}

async function cachePut(env, key, value) {
  setHotValue(key, value);

  if (env.METRICS_CACHE) {
    await env.METRICS_CACHE.put(key, JSON.stringify(value));
    return;
  }

  inMemoryStore.set(key, cloneJson(value));
}

function classifyRecord(record, env, descriptor = null) {
  if (!record?.fetchedAt) {
    return "missing";
  }

  const ageMs = Date.now() - new Date(record.fetchedAt).getTime();
  if (!Number.isFinite(ageMs)) {
    return "missing";
  }
  if (ageMs <= getFreshTtlMs(env, descriptor?.freshTtlSeconds ?? null)) {
    return "fresh";
  }
  if (ageMs <= getStaleTtlMs(env)) {
    return "stale";
  }
  return "expired";
}

async function fetchText(url, timeoutMs = REQUEST_TIMEOUT_MS, options = {}) {
  const cached = upstreamTextCache.get(url);
  if (cached && Date.now() - cached.timestamp < HOT_CACHE_TTL_MS) {
    return cached.text;
  }

  const attempts = [0, 600, 1500];
  let lastError = null;
  const browserLike = options.browserLike === true;
  const accept =
    options.accept ??
    "text/plain,text/csv,text/html,application/json;q=0.9,*/*;q=0.8";

  for (const delayMs of attempts) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": browserLike ? BROWSER_USER_AGENT : USER_AGENT,
          Accept: accept,
          ...(browserLike ? { "Accept-Language": "en-GB,en;q=0.9" } : {}),
        },
        cf: {
          cacheEverything: true,
          cacheTtl: 300,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        lastError = new Error(`Upstream ${response.status} for ${url}`);
        if (response.status === 429 || response.status >= 500) {
          continue;
        }
        throw lastError;
      }

      const text = await response.text();
      upstreamTextCache.set(url, { text, timestamp: Date.now() });
      return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Upstream request failed for ${url}`);
}

function safeParseFloat(value) {
  if (value == null) {
    return null;
  }
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .trim();
}

function extractNumber(text) {
  const match = text.match(/(\d+(?:[,\d]*)?(?:\.\d+)?)/);
  return match ? safeParseFloat(match[1]) : null;
}

function bettingColor(name, fallback = "#666666") {
  return PARTY_COLOR_MAP[name] ?? fallback;
}

function normalizeBettingOddsPayload(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Missing betting odds payload");
  }

  const nextPmOdds = Array.isArray(data.nextPmOdds)
    ? data.nextPmOdds
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const name = String(entry.name ?? "").trim();
          const party = String(entry.party ?? "Various").trim() || "Various";
          const probability = safeParseFloat(entry.probability);
          if (!name || probability === null || probability < 0) {
            return null;
          }
          return {
            name,
            party,
            probability: Math.round(probability),
            color: String(entry.color ?? bettingColor(party, "#999999")),
            ...(entry.role ? { role: String(entry.role).trim() } : {}),
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.probability - left.probability)
    : [];

  const mostSeats = Array.isArray(data.mostSeats)
    ? data.mostSeats
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const party = String(entry.party ?? "").trim();
          const probability = safeParseFloat(entry.probability);
          if (!party || probability === null || probability < 0) {
            return null;
          }
          return {
            party,
            probability: Math.round(probability),
            color: String(entry.color ?? bettingColor(party, "#666666")),
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.probability - left.probability)
    : [];

  const yearOdds = Array.isArray(data.yearOdds)
    ? data.yearOdds
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const year = String(entry.year ?? "").trim();
          const probability = safeParseFloat(entry.probability);
          const sortKey = year === "2029+" ? 2029 : Number.parseInt(year, 10);
          if (!year || probability === null || probability < 0 || Number.isNaN(sortKey)) {
            return null;
          }
          return {
            year,
            probability: Math.round(probability),
            sortKey,
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.sortKey - right.sortKey)
        .map((entry) => ({
          year: entry.year,
          probability: entry.probability,
        }))
    : [];

  if (nextPmOdds.length === 0 || mostSeats.length === 0 || yearOdds.length === 0) {
    throw new Error("Betting odds payload is incomplete");
  }

  return {
    nextPmOdds,
    mostSeats,
    yearOdds,
  };
}

async function fetchOnsCsv(topicPath, limit = 36) {
  const text = await fetchText(`${ONS_CSV_BASE}${topicPath}`);
  const lines = text.trim().split(/\r?\n/);
  const result = [];

  for (const line of lines) {
    const stripped = line.trim().replace(/^"/, "");
    if (!stripped || !/^\d/.test(stripped)) {
      continue;
    }

    const parts = line.split(",").map((part) => part.trim().replace(/"/g, ""));
    if (parts.length < 2) {
      continue;
    }

    const value = safeParseFloat(parts[1]);
    if (value === null || parts[1] === "..") {
      continue;
    }

    result.push({ date: parts[0], value: Number(value.toFixed(2)) });
  }

  return result.slice(-limit);
}

async function fetchBoeRate(limit = 60) {
  const text = await fetchText(BOE_BANK_RATE_URL);
  const result = [];
  const bodyMatch = text.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const rows = [...(bodyMatch?.[1] ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      stripHtml(cell[1])
    );
    if (cells.length < 2) {
      continue;
    }

    const value = safeParseFloat(cells[1]);
    if (value === null) {
      continue;
    }

    result.push({ date: cells[0], value: Number(value.toFixed(4)) });
  }

  return result.reverse().slice(-limit);
}

function onsDateShort(dateString) {
  const parts = dateString.trim().split(/\s+/);
  if (parts.length < 2) {
    return dateString;
  }
  const month = parts[1].slice(0, 3).toLowerCase();
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${parts[0].slice(-2)}`;
}

function onsDateToEpochMs(dateString) {
  const parts = dateString.trim().split(/\s+/);
  if (parts.length < 2) {
    return null;
  }
  const year = Number(parts[0]);
  const month = monthMap[parts[1].slice(0, 3).toUpperCase()];
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }
  return Date.UTC(year, month, 1);
}

function parseEconomicDate(raw) {
  const value = raw.trim();

  const onsMonthly = value.match(/^(\d{4})\s+([A-Za-z]{3})$/);
  if (onsMonthly) {
    return new Date(
      Date.UTC(Number(onsMonthly[1]), monthMap[onsMonthly[2].toUpperCase()], 1)
    );
  }

  const onsQuarterly = value.match(/^(\d{4})\s+Q([1-4])$/i);
  if (onsQuarterly) {
    return new Date(Date.UTC(Number(onsQuarterly[1]), (Number(onsQuarterly[2]) - 1) * 3, 1));
  }

  const boeDaily = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (boeDaily) {
    return new Date(
      Date.UTC(
        Number(boeDaily[3]),
        monthMap[boeDaily[2].toUpperCase()],
        Number(boeDaily[1])
      )
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function findLatestAtOrBefore(date, series) {
  if (!date) {
    return null;
  }

  let latestValue = null;
  let latestTime = -Infinity;
  for (const point of series) {
    const pointDate = parseEconomicDate(point.date);
    if (!pointDate) {
      continue;
    }
    const pointTime = pointDate.getTime();
    if (pointTime <= date.getTime() && pointTime > latestTime) {
      latestTime = pointTime;
      latestValue = point.value;
    }
  }

  return latestValue;
}

async function safeFetch(task) {
  try {
    return await task();
  } catch {
    return null;
  }
}

async function fetchWikipediaPolling() {
  const text = await fetchText(WIKI_POLLING_URL);
  const tables = [...text.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi)];
  if (tables.length === 0) {
    return null;
  }

  const recentPolls = [];
  for (const tableMatch of tables.slice(0, 3)) {
    const rows = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (rows.length < 3) {
      continue;
    }

    const headerCells = [...rows[0][1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)];
    const headerTexts = headerCells.map((cell) => stripHtml(cell[1]).toLowerCase());

    const columnMap = {};
    headerTexts.forEach((header, index) => {
      if (header.includes("con")) {
        columnMap.con = index;
      } else if (header.includes("lab") && !header.includes("lib")) {
        columnMap.lab = index;
      } else if (header.includes("lib") || header.includes("ld")) {
        columnMap.ld = index;
      } else if (header.includes("reform") || header.includes("ref")) {
        columnMap.ref = index;
      }
    });

    if (Object.keys(columnMap).length < 3) {
      continue;
    }

    for (const row of rows.slice(1)) {
      const cells = [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)];
      if (cells.length < Math.max(...Object.values(columnMap)) + 1) {
        continue;
      }

      const cellTexts = cells.map((cell) => stripHtml(cell[1]));
      const dateIndex = headerTexts.findIndex((header) => header.includes("date"));
      const pollsterIndex = headerTexts.findIndex(
        (header) => header.includes("pollster") || header.includes("client")
      );

      const poll = {
        pollster: (pollsterIndex >= 0 ? cellTexts[pollsterIndex] : cellTexts[1] ?? "").replace(/\[\d+\]/g, "").trim(),
        date: (dateIndex >= 0 ? cellTexts[dateIndex] : cellTexts[0] ?? "").replace(/\[\d+\]/g, "").trim(),
      };

      let valid = true;
      for (const [party, index] of Object.entries(columnMap)) {
        const value = extractNumber(cellTexts[index] ?? "");
        if (value === null || value > 70) {
          valid = false;
          break;
        }
        poll[party] = value;
      }

      if (valid && poll.con != null && poll.lab != null) {
        recentPolls.push(poll);
      }
      if (recentPolls.length >= 8) {
        break;
      }
    }

    if (recentPolls.length > 0) {
      break;
    }
  }

  if (recentPolls.length === 0) {
    return null;
  }

  const parties = {
    REF: { name: "Reform UK", color: "#12B6CF", key: "ref", ge2024: 14 },
    LAB: { name: "Labour", color: "#E4003B", key: "lab", ge2024: 34 },
    CON: { name: "Conservative", color: "#0087DC", key: "con", ge2024: 24 },
    LD: { name: "Liberal Democrats", color: "#FAA61A", key: "ld", ge2024: 12 },
  };

  const pollingData = Object.entries(parties)
    .map(([party, info]) => {
      const values = recentPolls
        .map((poll) => poll[info.key])
        .filter((value) => typeof value === "number");
      if (values.length === 0) {
        return null;
      }

      const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      return {
        party,
        name: info.name,
        pct: average,
        color: info.color,
        change: average - info.ge2024,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.pct - left.pct);

  return {
    pollingData,
    recentPolls: recentPolls.slice(0, 5).map((poll) => ({
      pollster: poll.pollster || "Unknown",
      date: poll.date || "",
      lab: poll.lab ?? 0,
      con: poll.con ?? 0,
      ref: poll.ref ?? 0,
      ld: poll.ld ?? 0,
    })),
  };
}

async function fetchNhsWaitingList() {
  const text = await fetchText(NHS_RTT_URL);

  let match = text.match(/(\d+(?:\.\d+)?)\s*million\s*(?:patient|people|waiting)/i);
  if (!match) {
    match = text.match(/waiting list.*?(\d+(?:\.\d+)?)\s*million/i);
  }
  if (!match) {
    return null;
  }

  return {
    headline: {
      waitingList: Number.parseFloat(match[1]),
    },
  };
}

async function buildSentimentPulse() {
  const cpi = await fetchOnsCsv(ONS_SERIES.cpi, 24);
  if (cpi.length === 0) {
    throw new Error("CPI series unavailable");
  }

  const bankRates = await safeFetch(() => fetchBoeRate(120));
  const unemployment = await safeFetch(() => fetchOnsCsv(ONS_SERIES.unemployment, 24));
  const fallbackUnemploymentByDisplay = {
    "Feb 24": 4.3,
    "Mar 24": 4.4,
    "Apr 24": 4.4,
    "May 24": 4.2,
    "Jun 24": 4.2,
    "Jul 24": 4.1,
    "Aug 24": 4.3,
    "Sep 24": 4.3,
    "Oct 24": 4.4,
    "Nov 24": 4.4,
    "Dec 24": 4.4,
    "Jan 25": 4.4,
    "Feb 25": 4.5,
    "Mar 25": 4.6,
    "Apr 25": 4.7,
    "May 25": 4.7,
    "Jun 25": 4.7,
    "Jul 25": 4.8,
    "Aug 25": 5.0,
    "Sep 25": 5.1,
    "Oct 25": 5.1,
    "Nov 25": 5.2,
    "Dec 25": 5.2,
    "Jan 26": 5.2,
  };

  return {
    economicData: cpi.map((point) => {
      const pointDate = parseEconomicDate(point.date);
      const displayDate = onsDateShort(point.date);

      return {
        date: displayDate,
        inflation: point.value,
        bankRate: bankRates ? findLatestAtOrBefore(pointDate, bankRates) : null,
        unemployment:
          (unemployment ? findLatestAtOrBefore(pointDate, unemployment) : null) ??
          fallbackUnemploymentByDisplay[displayDate] ??
          null,
      };
    }),
    metricConfig: SENTIMENT_METRIC_CONFIG,
  };
}

async function buildGdpTracker() {
  const growth = await safeFetch(() => fetchOnsCsv(ONS_SERIES.gdp_growth, 40));
  if (!growth || growth.length === 0) {
    return GDP_FALLBACK;
  }

  const level = await safeFetch(() => fetchOnsCsv(ONS_SERIES.gdp_level, 40));
  const levelMap = {};
  if (level) {
    for (const point of level) {
      levelMap[point.date] = Number((point.value / 1_000_000).toFixed(3));
    }
  }

  return {
    gdpHistory: growth.map((point) => {
      const entry = {
        year: point.date,
        growth: point.value,
      };

      if (levelMap[point.date] != null) {
        entry.total = levelMap[point.date];
      }

      return entry;
    }),
    g7Comparison: GDP_FALLBACK.g7Comparison,
    sectorBreakdown: GDP_FALLBACK.sectorBreakdown,
  };
}

async function buildEmploymentStats() {
  const [employment, unemployment] = await Promise.all([
    safeFetch(() => fetchOnsCsv(ONS_SERIES.employment, 24)),
    safeFetch(() => fetchOnsCsv(ONS_SERIES.unemployment, 24)),
  ]);

  if (!employment && !unemployment) {
    return EMPLOYMENT_FALLBACK;
  }

  const payload = {
    ...EMPLOYMENT_FALLBACK,
    headline: { ...EMPLOYMENT_FALLBACK.headline },
  };
  if (employment) {
    payload.employmentRate = employment.map((point) => ({
      date: point.date,
      value: point.value,
    }));
    payload.headline.employmentRate = employment[employment.length - 1]?.value ?? payload.headline.employmentRate;
  }
  if (unemployment) {
    payload.unemploymentRate = unemployment.map((point) => ({
      date: point.date,
      value: point.value,
    }));
    payload.headline.unemploymentRate =
      unemployment[unemployment.length - 1]?.value ?? payload.headline.unemploymentRate;
  }
  return payload;
}

async function buildNationalDebt() {
  const debtSeries = await safeFetch(() => fetchOnsCsv(ONS_SERIES.psnd, 36));
  if (!debtSeries || debtSeries.length === 0) {
    return {
      baseDebt: 2_814_000_000_000,
      baseDate: new Date("2025-03-31T00:00:00Z").getTime(),
      debtPerSecond: 4_820,
      ...NATIONAL_DEBT_CONTEXT,
      debtToGdp: 95.5,
    };
  }

  const borrowingSeries = await safeFetch(() => fetchOnsCsv(ONS_SERIES.psnb, 36));
  const debtGdpSeries = await safeFetch(() => fetchOnsCsv(ONS_SERIES.debt_gdp, 12));
  const latest = debtSeries[debtSeries.length - 1];
  const baseDate = onsDateToEpochMs(latest.date);

  if (baseDate == null) {
    throw new Error("Unable to parse national debt date");
  }

  let debtPerSecond = 0;
  if (borrowingSeries && borrowingSeries.length > 0) {
    const trailingBorrowing = borrowingSeries.slice(-12);
    const multiplier = trailingBorrowing.length >= 12 ? 1 : 12 / trailingBorrowing.length;
    const annualBorrowing =
      trailingBorrowing.reduce((sum, point) => sum + point.value, 0) * 1_000_000 * multiplier;
    debtPerSecond = Math.round(
      annualBorrowing > 0 ? annualBorrowing / (365.25 * 24 * 3600) : 4_820
    );
  }

  const payload = {
    baseDebt: Math.round(latest.value * 1_000_000_000),
    baseDate,
    debtPerSecond,
    ...NATIONAL_DEBT_CONTEXT,
  };

  payload.debtToGdp =
    debtGdpSeries && debtGdpSeries.length > 0
      ? debtGdpSeries[debtGdpSeries.length - 1].value
      : Number(((payload.baseDebt / NATIONAL_DEBT_CONTEXT.gdp) * 100).toFixed(1));

  return payload;
}

async function buildTaxRevenue() {
  const receipts = await safeFetch(() => fetchOnsCsv(ONS_SERIES.tax_receipts, 36));
  if (!receipts || receipts.length === 0) {
    return TAX_REVENUE_FALLBACK;
  }

  const totalAnnual =
    receipts.length >= 12
      ? receipts.slice(-12).reduce((sum, point) => sum + point.value, 0)
      : receipts.reduce((sum, point) => sum + point.value, 0) * (12 / receipts.length);

  return {
    totalReceipts: Math.round(totalAnnual / 1000),
    taxBurdenHistory: TAX_BURDEN_HISTORY,
    taxCategories: TAX_CATEGORIES,
  };
}

async function buildMigrationStats() {
  const [net, immigration, emigration] = await Promise.all([
    safeFetch(() => fetchOnsCsv(ONS_SERIES.net_migration, 20)),
    safeFetch(() => fetchOnsCsv(ONS_SERIES.immigration, 20)),
    safeFetch(() => fetchOnsCsv(ONS_SERIES.emigration, 20)),
  ]);

  if (!net && !immigration) {
    return MIGRATION_FALLBACK;
  }

  const netByYear = Object.fromEntries((net ?? []).map((point) => [point.date.trim(), point.value]));
  const immigrationByYear = Object.fromEntries(
    (immigration ?? []).map((point) => [point.date.trim(), point.value])
  );
  const emigrationByYear = Object.fromEntries(
    (emigration ?? []).map((point) => [point.date.trim(), point.value])
  );

  const years = [...new Set([...Object.keys(netByYear), ...Object.keys(immigrationByYear)])]
    .sort()
    .slice(-10);

  return {
    migrationHistory: years.map((year) => {
      const entry = { year };
      if (netByYear[year] != null) {
        entry.net = Math.round(netByYear[year]);
      }
      if (immigrationByYear[year] != null) {
        entry.immigration = Math.round(immigrationByYear[year]);
      }
      if (emigrationByYear[year] != null) {
        entry.emigration = Math.round(emigrationByYear[year]);
      }
      return entry;
    }),
    visaTypes: MIGRATION_FALLBACK.visaTypes,
    topNationalities: MIGRATION_FALLBACK.topNationalities,
  };
}

async function buildElectionPolling() {
  const polling = await safeFetch(() => fetchWikipediaPolling());
  if (!polling) {
    return ELECTION_POLLING_FALLBACK;
  }
  return polling;
}

async function buildNhsStats() {
  const stats = await safeFetch(() => fetchNhsWaitingList());
  if (!stats) {
    return NHS_FALLBACK;
  }
  return {
    ...NHS_FALLBACK,
    headline: {
      ...NHS_FALLBACK.headline,
      ...stats.headline,
    },
  };
}

const sectionDescriptors = {
  bettingOdds: {
    source: "Oddschecker politics markets (scheduled browser snapshot)",
    freshTtlSeconds: 2 * 60 * 60,
    ingestOnly: true,
  },
  sentimentPulse: {
    source: "ONS CPI (D7G7) + BoE Bank Rate + ONS Unemployment (MGSX)",
    build: buildSentimentPulse,
  },
  gdpTracker: {
    source: "ONS GDP Growth (IHYQ) + Level (ABMI)",
    build: buildGdpTracker,
  },
  employmentStats: {
    source: "ONS Employment (LF24) + Unemployment (MGSX)",
    build: buildEmploymentStats,
  },
  nationalDebt: {
    source: "ONS Net Debt (HF6W) + Net Borrowing (J5II)",
    build: buildNationalDebt,
  },
  taxRevenue: {
    source: "ONS Tax Receipts (MF73)",
    build: buildTaxRevenue,
  },
  migrationStats: {
    source: "ONS Migration Estimates (CIMU/CIML/CIMM)",
    build: buildMigrationStats,
  },
  electionPolling: {
    source: "Wikipedia UK Opinion Polling",
    build: buildElectionPolling,
  },
  nhsStats: {
    source: "NHS England RTT Waiting Times",
    build: buildNhsStats,
  },
  crimeStatistics: {
    source: "ONS CSEW + Home Office PRC + MoJ Court Timelines",
  },
};

function createManifestEntry(status, descriptor, fetchedAt, error, cacheState = "fresh") {
  return {
    status,
    source: descriptor.source,
    fetchedAt,
    cacheState,
    ...(error ? { error } : {}),
  };
}

async function syncSectionIntoDatasetCache(section, descriptor, record, env) {
  const manifest = await cacheGet(env, manifestCacheKey());
  if (manifest?.sources) {
    manifest.sources[section] = createManifestEntry("ok", descriptor, record.fetchedAt);
    await cachePut(env, manifestCacheKey(), manifest);
  }

  const dataset = await cacheGet(env, datasetCacheKey());
  if (dataset?.meta?.sources) {
    dataset[section] = record.data;
    dataset.meta.sources[section] = createManifestEntry("ok", descriptor, record.fetchedAt);
    await cachePut(env, datasetCacheKey(), dataset);
  }
}

async function refreshSection(section, env, options = {}) {
  const descriptor = sectionDescriptors[section];
  if (!descriptor) {
    throw new Error(`Unknown section '${section}'`);
  }
  if (descriptor.ingestOnly) {
    throw new Error(`Section '${section}' is ingest-only; use POST /ingest`);
  }

  const data = await descriptor.build();
  const record = {
    section,
    data,
    fetchedAt: nowIso(),
    sourceLabel: descriptor.source,
    backend: "verified-data-service",
  };

  await cachePut(env, sectionCacheKey(section), record);
  if (options.syncDataset !== false) {
    await syncSectionIntoDatasetCache(section, descriptor, record, env);
  }
  return record;
}

async function buildDatasetFromCache(env) {
  const manifest = (await cacheGet(env, manifestCacheKey())) ?? null;
  if (!manifest) {
    return null;
  }

  const dataset = {
    meta: manifest,
  };

  for (const section of Object.keys(sectionDescriptors)) {
    const record = await cacheGet(env, sectionCacheKey(section));
    if (record?.data != null) {
      dataset[section] = record.data;
    }
  }

  return dataset;
}

async function refreshAllSections(env) {
  const generatedAt = nowIso();
  const dataset = {
    meta: {
      generatedAt,
      fetchedAt: generatedAt,
      generator: "verified-data-service",
      version: CACHE_VERSION,
      backend: "verified-data-service",
      sources: {},
    },
  };

  for (const [section, descriptor] of Object.entries(sectionDescriptors)) {
    if (descriptor.ingestOnly) {
      const record = await cacheGet(env, sectionCacheKey(section));
      const recordState = classifyRecord(record, env, descriptor);
      if (record?.data != null) {
        const normalizedState = recordState === "expired" ? "stale" : recordState;
        dataset[section] = record.data;
        dataset.meta.sources[section] = createManifestEntry(
          normalizedState === "fresh" ? "ok" : "stale",
          descriptor,
          record.fetchedAt,
          normalizedState === "fresh" ? undefined : "Awaiting next scheduled ingest",
          normalizedState
        );
      } else {
        dataset.meta.sources[section] = createManifestEntry(
          "error",
          descriptor,
          generatedAt,
          "No ingested snapshot available",
          "missing"
        );
      }
      continue;
    }

    try {
      const record = await refreshSection(section, env, { syncDataset: false });
      dataset[section] = record.data;
      dataset.meta.sources[section] = createManifestEntry(
        "ok",
        descriptor,
        record.fetchedAt,
        undefined,
        "fresh"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const staleRecord = await cacheGet(env, sectionCacheKey(section));

      if (staleRecord?.data != null) {
        dataset[section] = staleRecord.data;
        dataset.meta.sources[section] = createManifestEntry(
          "stale",
          descriptor,
          staleRecord.fetchedAt,
          message,
          classifyRecord(staleRecord, env, descriptor)
        );
      } else {
        dataset.meta.sources[section] = createManifestEntry(
          "error",
          descriptor,
          generatedAt,
          message,
          "missing"
        );
      }
    }
  }

  await cachePut(env, manifestCacheKey(), dataset.meta);
  await cachePut(env, datasetCacheKey(), dataset);
  return dataset;
}

async function ensureSectionRecord(section, env, ctx) {
  const descriptor = sectionDescriptors[section];
  const cached = await cacheGet(env, sectionCacheKey(section));
  const cacheState = classifyRecord(cached, env, descriptor);

  if (descriptor.ingestOnly) {
    if (cached) {
      return {
        record: cached,
        cacheState: cacheState === "expired" ? "stale" : cacheState,
      };
    }
    throw new Error(`Section '${section}' has no ingested snapshot yet`);
  }

  if (cacheState === "fresh") {
    return { record: cached, cacheState };
  }

  if (cacheState === "stale" && cached) {
    ctx.waitUntil(refreshSection(section, env).catch(() => null));
    return { record: cached, cacheState };
  }

  try {
    const record = await refreshSection(section, env);
    return { record, cacheState: "fresh" };
  } catch (error) {
    if (cached) {
      return { record: cached, cacheState: cacheState === "missing" ? "stale" : cacheState };
    }
    throw error;
  }
}

function constantTimeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function refreshAuthorized(request, env) {
  const configured = env.REFRESH_SECRET?.trim();
  if (!configured) {
    return false;
  }
  const headerValue = request.headers.get("X-Refresh-Secret") || "";
  const queryValue = new URL(request.url).searchParams.get("secret") || "";
  return constantTimeCompare(headerValue, configured) || constantTimeCompare(queryValue, configured);
}

const worker = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: withCors() });
    }

    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>public-data.org data service</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:Arial,sans-serif;padding:32px;max-width:720px;margin:0 auto;line-height:1.5"><h1>public-data.org data service</h1><p>Service available.</p></body></html>`,
        {
          headers: withCors({
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60",
          }),
        }
      );
    }

    if (url.pathname === "/health") {
      const manifest = await cacheGet(env, manifestCacheKey());
      return jsonResponse({
        status: "ok",
        service: "public-data-service",
        cache: env.METRICS_CACHE ? "persistent" : "memory",
        lastRefresh: manifest?.generatedAt ?? null,
        sections: Object.keys(sectionDescriptors),
      });
    }

    if (url.pathname === "/refresh") {
      if (!refreshAuthorized(request, env)) {
        return errorResponse("Refresh secret required", 401);
      }

      const section = url.searchParams.get("section");

      try {
        if (section && section !== "all") {
          const record = await refreshSection(section, env);
          return jsonResponse({
            status: "ok",
            section,
            fetchedAt: record.fetchedAt,
            cache: env.METRICS_CACHE ? "persistent" : "memory",
          });
        }

        const dataset = await refreshAllSections(env);
        return jsonResponse({
          status: "ok",
          generatedAt: dataset.meta.generatedAt,
          sources: dataset.meta.sources,
        });
      } catch (error) {
        return errorResponse(
          "Refresh failed",
          502,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    if (url.pathname === "/ingest") {
      if (!refreshAuthorized(request, env)) {
        return errorResponse("Refresh secret required", 401);
      }

      if (request.method !== "POST") {
        return errorResponse("Use POST for /ingest", 405);
      }

      try {
        const payload = await request.json();
        const section = String(payload?.section ?? "").trim();
        const descriptor = sectionDescriptors[section];

        if (!descriptor) {
          return errorResponse(`Unknown section '${section}'`, 404);
        }

        if (!descriptor.ingestOnly) {
          return errorResponse(`Section '${section}' does not support ingest`, 400);
        }

        const data =
          section === "bettingOdds" ? normalizeBettingOddsPayload(payload?.data) : payload?.data;
        const fetchedAt =
          typeof payload?.fetchedAt === "string" && !Number.isNaN(Date.parse(payload.fetchedAt))
            ? new Date(payload.fetchedAt).toISOString()
            : nowIso();

        const record = {
          section,
          data,
          fetchedAt,
          sourceLabel:
            typeof payload?.sourceLabel === "string" && payload.sourceLabel.trim()
              ? payload.sourceLabel.trim()
              : descriptor.source,
          backend:
            typeof payload?.backend === "string" && payload.backend.trim()
              ? payload.backend.trim()
              : "scheduled-ingest",
        };

        await cachePut(env, sectionCacheKey(section), record);
        await syncSectionIntoDatasetCache(section, descriptor, record, env);

        return jsonResponse({
          status: "ok",
          section,
          fetchedAt: record.fetchedAt,
          cache: env.METRICS_CACHE ? "persistent" : "memory",
          backend: record.backend,
        });
      } catch (error) {
        return errorResponse(
          "Ingest failed",
          400,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    if (url.pathname === "/metrics") {
      const section = url.searchParams.get("section");
      if (!section) {
        return errorResponse("Missing ?section= parameter", 400);
      }

      if (!sectionDescriptors[section]) {
        return errorResponse(`Unknown section '${section}'`, 404);
      }

      try {
        const { record, cacheState } = await ensureSectionRecord(section, env, ctx);
        return jsonResponse(
          {
            section,
            data: record.data,
            source: "worker",
            timestamp: record.fetchedAt,
            cacheState,
            backend: record.backend,
          },
          {
            headers: {
              "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            },
          }
        );
      } catch (error) {
        return errorResponse(
          `Unable to fetch section '${section}'`,
          502,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    if (url.pathname === "/all") {
      const cachedDataset = await cacheGet(env, datasetCacheKey());
      const cacheState = classifyRecord(cachedDataset?.meta, env);

      if (cacheState === "fresh" && cachedDataset) {
        return jsonResponse(cachedDataset, {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
          },
        });
      }

      if (cacheState === "stale" && cachedDataset) {
        ctx.waitUntil(refreshAllSections(env).catch(() => null));
        return jsonResponse(cachedDataset, {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
          },
        });
      }

      try {
        const dataset = await refreshAllSections(env);
        return jsonResponse(dataset, {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
          },
        });
      } catch (error) {
        const fallbackDataset = cachedDataset ?? (await buildDatasetFromCache(env));
        if (fallbackDataset) {
          return jsonResponse(fallbackDataset, {
            headers: {
              "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            },
          });
        }

        return errorResponse(
          "Unable to build dataset",
          502,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    return errorResponse(
      "Not found",
      404,
      "Available endpoints: /health, /metrics, /all, /refresh, /ingest"
    );
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      refreshAllSections(env).catch((error) => {
        console.error("Scheduled refresh failed", controller.cron, error);
      })
    );
  },
};

export {
  normalizeBettingOddsPayload,
  refreshAuthorized,
  sectionDescriptors,
};

export default worker;
