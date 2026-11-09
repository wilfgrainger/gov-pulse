#!/usr/bin/env node
// INDICATIVE ONLY. Offline estimate of per-feed collector CPU, measured in Node
// against checked-in fixtures. Node CPU is NOT Workers CPU (different engine
// build, no isolate limits, different JIT/GC behaviour, no network I/O wait).
// Use it to rank feeds and spot outliers, never as evidence of Free-tier
// headroom. Real Workers CPU needs `wrangler tail` (Task 8 Step 2, owner-run).
//
// Method
//   CPU: process.cpuUsage() deltas (user + system) around each collect() call,
//   after one discarded warm-up call, reported as the median of RUNS calls. A
//   per-process `node --cpu-prof` cannot attribute CPU to one feed when feeds
//   share a process, so --cpu-prof is not used for the table; to profile one
//   feed run `node --cpu-prof scripts/measure-collector-cost.mjs <feedId>`.
//   bytes: UTF-8 bytes of the fixture bodies the collector actually read.
//   fetches: calls the collector made to the injected fetch (counted by the
//   fixture stub; exact for the measured path). Feeds without a fixture show
//   the static count derived by reading the collector (see STATIC_FETCHES).
//   No network is used: fetch is always the fixture stub.
//
// Usage: node scripts/measure-collector-cost.mjs --all [--runs N] [--json]
//        node scripts/measure-collector-cost.mjs <feedId> [--runs N] [--json]
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FEEDS } from "../feeds/index.js";
import { FINANCES_BULLETIN_URL } from "../feeds/tax/finances.js";
import { ONS_PUBLICATION_LANDING_URL } from "../contracts/crime-statistics.js";
import { MARKET_DEFINITIONS } from "../contracts/betting-markets.js";

export const SUBREQUEST_LIMIT = 50; // Workers Free, per invocation (verified 6 Nov 2026)
export const INDICATIVE_NOTICE =
  "INDICATIVE ONLY: Node CPU is not Workers CPU. Measured offline against checked-in fixtures; no network.";
const DEFAULT_RUNS = 7;
const NOW = new Date("2026-11-06T08:00:00.000Z"); // after every fixture's release date

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(root(path), "utf8");

// Fixture routers. Each returns {body, url?} for a request URL or null (404).
// Only existing checked-in fixture files are used; nothing is synthesised
// except a one-line link page where the collector expects the ONS landing page
// to point at an edition and the repo has only the edition body.
const FIXTURE_FEEDS = {
  realWages() {
    const bulletin = read("feeds/real-wages/fixtures/bulletin.html");
    const history = read("feeds/real-wages/fixtures/history.csv");
    return {
      files: ["feeds/real-wages/fixtures/bulletin.html", "feeds/real-wages/fixtures/history.csv"],
      route: (url) => ({ body: url.includes("/generator") ? history : bulletin }),
    };
  },
  crimeStatistics() {
    const landing = read("tests/fixtures/ons/crime-yearendingjune2026-latest.html");
    const edition = read("tests/fixtures/ons/crime-yearendingjune2026.html");
    return {
      files: ["tests/fixtures/ons/crime-yearendingjune2026-latest.html", "tests/fixtures/ons/crime-yearendingjune2026.html"],
      route: (url) => {
        if (url === ONS_PUBLICATION_LANDING_URL) return { body: landing };
        if (/\/bulletins\/crimeinenglandandwales\/yearendingjune2026$/.test(url)) return { body: edition };
        return null;
      },
    };
  },
  housePriceIndex() {
    const landing = read("tests/fixtures/ons/hpi-october2026-latest.html");
    const history = read("tests/fixtures/ons/hpi-october2026-figure1.csv");
    return {
      files: ["tests/fixtures/ons/hpi-october2026-latest.html", "tests/fixtures/ons/hpi-october2026-figure1.csv"],
      route: (url) => (url.includes("/generator?uri=") ? { body: history } : { body: landing }),
    };
  },
  nationalDebt() {
    const bulletin = read("tests/fixtures/ons-public-sector-finances-august-2026.html");
    const debt = read("tests/fixtures/ons-hf6w.csv");
    const ratio = read("tests/fixtures/ons-hf6x.csv");
    const edition = FINANCES_BULLETIN_URL.replace("/latest", "/august2026");
    return {
      files: [
        "tests/fixtures/ons-public-sector-finances-august-2026.html",
        "tests/fixtures/ons-hf6w.csv",
        "tests/fixtures/ons-hf6x.csv",
      ],
      route: (url) => {
        if (url === FINANCES_BULLETIN_URL) return { body: `<a href="${edition}">Latest release</a>` };
        if (url === edition) return { body: bulletin };
        if (url.includes("/generator?")) return { body: url.includes("hf6x") ? ratio : debt };
        return { body: bulletin }; // series landing page: only the release date is read
      },
    };
  },
};

// Fetches per collect() read from the collector source (upper bound unless
// noted). ONS bulletin discovery = 1 fetch when the landing URL redirects to
// the edition, otherwise 2 (landing + edition); 2 is used. Used only for feeds
// with no fixture; measured feeds report the stub's exact count instead.
export const STATIC_FETCHES = {
  electionPolling: { count: 16, note: "YouGov 3 + More in Common archive 1 + up to 12 workbooks (MORE_IN_COMMON_POLL_HISTORY_LIMIT)" },
  gdpTracker: { count: 6, note: "bulletin 2 + 4 ONS series" },
  sentimentPulse: { count: 5, note: "4 sequential ONS + 1 Bank of England" },
  taxRevenue: { count: 3, note: "bulletin 2 + 1 series (matches tests/worker/feeds/tax.test.ts)" },
  employmentStats: { count: 6, note: "bulletin 2 + 4 ONS series" },
  nhsStats: { count: 4, note: "landing, data page, timeseries workbook, press-notice PDF" },
  migrationStats: { count: 3, note: "dataset page, bulletin, history CSV" },
  bettingOdds: { count: Object.keys(MARKET_DEFINITIONS).length, note: "one page per MARKET_DEFINITIONS entry" },
  governmentContracts: { count: 40, note: "ceiling only: MAX_PAGES_PER_REFRESH=40 page fetches per refresh-contracts job (actual use is usually lower; stays under 50)" },
  releaseCalendar: { count: 11, note: "ceiling: up to 10 upcoming calendar pages (MAX_UPCOMING_PAGES) + 1 cancelled page; 6 in November 2026" },
  nhsReleaseCalendar: { count: 2, note: "calendar API + plan PDF" },
};

function describeFeed(feed) {
  const id = feed.definition.id;
  if (typeof feed.collect !== "function") {
    const reason = feed.collectShard ? "sharded (collectShard/combine), not measured as one collect()" : "static feed, no collector";
    return { id, kind: "no-fixture", reason };
  }
  if (!Object.hasOwn(FIXTURE_FEEDS, id)) {
    return { id, kind: "no-fixture", reason: "no checked-in fixture files (inline test strings or live-only)" };
  }
  return { id, kind: "measurable" };
}

function responseFor(entry, url, counters) {
  counters.fetches += 1;
  const hit = entry.route(url);
  if (!hit) return new Response("fixture not found", { status: 404 });
  counters.bytes += Buffer.byteLength(hit.body, "utf8");
  return new Response(hit.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const cpuMs = (usage) => (usage.user + usage.system) / 1000;

async function measureOne(feed, runs) {
  const described = describeFeed(feed);
  const id = described.id;
  const statics = STATIC_FETCHES[id];
  if (described.kind === "no-fixture") {
    return {
      feedId: id,
      status: "no-fixture",
      reason: described.reason,
      cpuMs: null,
      bytes: null,
      fetches: statics?.count ?? null,
      fetchesBasis: statics ? `static: ${statics.note}` : null,
    };
  }
  const entry = FIXTURE_FEEDS[id]();
  const samples = [];
  let counters = { fetches: 0, bytes: 0 };
  try {
    for (let run = 0; run <= runs; run += 1) {
      counters = { fetches: 0, bytes: 0 };
      const fetchStub = async (input) => responseFor(entry, String(input?.url ?? input), counters);
      const before = process.cpuUsage();
      await feed.collect({ fetch: fetchStub, now: NOW, feed: feed.definition, previous: null });
      const used = cpuMs(process.cpuUsage(before));
      if (run > 0) samples.push(used); // run 0 is the discarded warm-up
    }
  } catch (error) {
    return {
      feedId: id,
      status: "no-fixture",
      reason: `fixtures do not satisfy the collector: ${String(error?.message ?? error).slice(0, 120)}`,
      cpuMs: null,
      bytes: null,
      fetches: statics?.count ?? null,
      fetchesBasis: statics ? `static: ${statics.note}` : null,
    };
  }
  return {
    feedId: id,
    status: "measured",
    cpuMs: Number(median(samples).toFixed(2)),
    bytes: counters.bytes,
    fetches: counters.fetches,
    fetchesBasis: "counted at fixture stub",
    runs,
  };
}

/** Measure the selected feeds (all collectable feeds by default). */
export async function measureCollectors({ feedIds, runs = DEFAULT_RUNS } = {}) {
  const selected = FEEDS.filter((feed) => !feedIds?.length || feedIds.includes(feed.definition.id));
  const results = [];
  for (const feed of selected) results.push(await measureOne(feed, runs));
  return results;
}

/** One line per feed: `feedId cpuMs bytes`, or `feedId no-fixture (reason)`. */
export function formatLine(result) {
  const fetchPart = result.fetches === null ? "fetches=unknown" : `fetches=${result.fetches}/${SUBREQUEST_LIMIT}`;
  if (result.status === "no-fixture") return `${result.feedId} no-fixture ${fetchPart} (${result.reason})`;
  return `${result.feedId} ${result.cpuMs} ${result.bytes} ${fetchPart}`;
}

export function formatReport(results) {
  return [`# ${INDICATIVE_NOTICE}`, "# columns: feedId cpuMs bytes fetches/50-subrequest-Free-limit", ...results.map(formatLine)].join("\n");
}

async function main(argv) {
  const args = argv.slice(2);
  const runsAt = args.indexOf("--runs");
  const runs = runsAt >= 0 ? Number(args[runsAt + 1]) : DEFAULT_RUNS;
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");
  const feedIds = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--runs");
  if (!args.includes("--all") && feedIds.length === 0) {
    throw new Error("Usage: measure-collector-cost.mjs --all | <feedId...> [--runs N] [--json]");
  }
  const results = await measureCollectors({ feedIds: args.includes("--all") ? [] : feedIds, runs });
  console.log(args.includes("--json") ? JSON.stringify({ notice: INDICATIVE_NOTICE, results }, null, 2) : formatReport(results));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
