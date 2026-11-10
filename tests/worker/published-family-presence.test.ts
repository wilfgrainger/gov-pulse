// @vitest-environment node

// Fixtures under tests/fixtures/ons/ are unmodified captures of the public ONS
// pages taken on 2026-11-05:
//   - hpi-october2026-latest.html: .../privaterentandhousepricesuk/latest
//     (canonical: .../october2026)
//   - hpi-october2026-figure1.csv: the bulletin's Figure 1 "Download this
//     chart" CSV (generator?uri=.../october2026/f841d43e&format=csv)
//   - crime-yearendingjune2026-latest.html: .../crimeinenglandandwales/latest
//   - crime-yearendingjune2026.html: .../crimeinenglandandwales/yearendingjune2026
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SECTION_BUILDERS } from "@/worker/section-builders";
import { BULLETIN_LATEST_URL } from "@/feeds/house-price-index/parse.js";
import { ONS_PUBLICATION_LANDING_URL } from "@/contracts/crime-statistics";
import publicWorker from "@/worker/public-data-entry";
import { RUN_PREFIX, createRun, finaliseRun } from "@/worker/queued-publication-entry";
import { PUBLICATION_CURRENT_KEY, PUBLICATION_STATUS_KEY } from "@/worker/publication-entry";
import { FEED_REGISTRY_VERSION, REQUIRED_PUBLISHED_SECTION_IDS } from "@/worker/feed-registry";
import { PUBLIC_SNAPSHOT_KEY, buildPublicSnapshotArtifact } from "@/worker/public-snapshot";
import { unavailableReasonFor } from "@/worker/publication-availability";
import { contractsRecordFor, publishFromCaches } from "@/worker/publication-publisher";
import { CURRENT_RECORD_KEY as CONTRACTS_KEY } from "@/feeds/government-contracts/parse.js";
import { parseOnsCrimeBulletin } from "@/feeds/crime-stats/parse.js";
import {
  CRIME_BULLETIN_HTML,
  CRIME_EDITION_URL as LEGACY_CRIME_EDITION_URL,
} from "@/tests/fixtures/crime-publication";

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "../fixtures/ons", name), "utf8");

const HPI_CHART_URL =
  "https://www.ons.gov.uk/generator?uri=/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/october2026/f841d43e&format=csv";
const CRIME_EDITION_URL =
  "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/yearendingjune2026";

const now = new Date("2026-11-05T12:00:00.000Z");

function recordedOnsFetch() {
  const pages: Record<string, { body: string; type: string }> = {
    [BULLETIN_LATEST_URL]: { body: fixture("hpi-october2026-latest.html"), type: "text/html" },
    [HPI_CHART_URL]: { body: fixture("hpi-october2026-figure1.csv"), type: "text/csv" },
    [ONS_PUBLICATION_LANDING_URL]: {
      body: fixture("crime-yearendingjune2026-latest.html"),
      type: "text/html",
    },
    [CRIME_EDITION_URL]: { body: fixture("crime-yearendingjune2026.html"), type: "text/html" },
  };
  return vi.fn(async (input: RequestInfo | URL) => {
    const page = pages[String(input)];
    return page
      ? new Response(page.body, { status: 200, headers: { "Content-Type": page.type } })
      : new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("published families build from the current ONS bulletins", () => {
  it("housePriceIndex and crimeStatistics sections build from the recorded bulletins", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal("fetch", recordedOnsFetch());

    const housePrices = await SECTION_BUILDERS.housePriceIndex(now);
    expect(housePrices.section).toBe("housePriceIndex");
    expect(housePrices.source.status).toBe("ok");
    expect(housePrices.data.headline).toMatchObject({
      period: "Aug 2026",
      releaseDate: "2026-10-21",
      nextReleaseDate: "2026-11-18",
      avgPriceGbp: 273000,
      changePercent: 0.9,
      previousPeriod: "Jul 2026",
      previousChangePercent: 1.2,
      privateRentPeriod: "Sep 2026",
      avgMonthlyPrivateRentGbp: 1406,
      privateRentAnnualChangePercent: 3.8,
      // The October 2026 bulletin reads "this annual growth rate is unchanged
      // from the 12 months to August 2026": the previous rate is the same 3.8%.
      previousPrivateRentPeriod: "Aug 2026",
      previousPrivateRentAnnualChangePercent: 3.8,
    });
    expect(housePrices.data.__observation).toMatchObject({
      status: "current",
      period: "Aug 2026",
      observedAt: "2026-08-31T00:00:00.000Z",
    });
    expect(housePrices.data.source.edition).toBe("october2026");
    expect(housePrices.data.source.historyUrl).toBe(HPI_CHART_URL);

    const crime = await SECTION_BUILDERS.crimeStatistics(now);
    expect(crime.section).toBe("crimeStatistics");
    expect(crime.source.status).toBe("ok");
    expect(crime.data.headline).toMatchObject({
      period: "Year ending June 2026",
      observedAt: "2026-06-30",
      releaseDate: "2026-10-22",
      nextReleaseDate: "2027-01-28",
      geography: "England and Wales",
      publicationUrl: CRIME_EDITION_URL,
    });
    const survey = Object.fromEntries(
      crime.data.crimeSurvey.measures.map((item: { id: string }) => [item.id, item]),
    );
    expect(survey.headlineCrime).toMatchObject({
      value: 9_700_000,
      changeLabel: "No statistically significant change from the previous survey",
    });
    // The year-ending June 2026 survey reports statistically significant
    // increases for fraud and computer misuse; the label must say so.
    expect(survey.fraud).toMatchObject({
      value: 4_500_000,
      changeLabel: "11% higher than the previous survey",
    });
    expect(survey.computerMisuse).toMatchObject({
      value: 817_000,
      changeLabel: "23% higher than the previous survey",
    });
    expect(survey.otherHouseholdTheft).toMatchObject({
      value: 833_000,
      changeLabel: "27% higher than the previous survey",
    });
    const police = Object.fromEntries(
      crime.data.policeRecorded.measures.map((item: { id: string }) => [item.id, item]),
    );
    // This edition does not state a police-recorded total excluding fraud and
    // computer misuse: the measure is absent, not carried over or derived.
    expect(police).not.toHaveProperty("recordedCrime");
    expect(crime.data.policeRecorded.summary).toMatch(/does not state a total/);
    expect(police.homicide).toMatchObject({ value: 512 });
    expect(police.knife).toMatchObject({ value: 48_615, changeLabel: "6% lower than the previous year" });
    expect(police.firearms).toMatchObject({ value: 5_065, changeLabel: "8% lower than the previous year" });
  });
});

function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial));
  const metadata = new Map<string, Record<string, unknown>>();
  const decode = (value: unknown, type?: "json" | "text") => {
    if (value === undefined || value === null) return null;
    if (type === "text") return typeof value === "string" ? value : JSON.stringify(value);
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  };
  return {
    store,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string, type?: "json" | "text") => decode(store.get(key), type)),
        getWithMetadata: vi.fn(async (key: string, type?: "json" | "text") => ({
          value: decode(store.get(key), type),
          metadata: metadata.get(key) ?? null,
        })),
        put: vi.fn(async (key: string, value: string, options?: { metadata?: Record<string, unknown> }) => {
          store.set(key, value);
          if (options?.metadata) metadata.set(key, options.metadata);
        }),
        delete: vi.fn(async (key: string) => { store.delete(key); metadata.delete(key); }),
      },
    },
  };
}

function snapshotWithout(missing: string[]) {
  const fetchedAt = "2026-07-17T10:00:00.000Z";
  const present = REQUIRED_PUBLISHED_SECTION_IDS.filter((section) => !missing.includes(section));
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: "2026-07-17T12:00:00.000Z",
      fetchedAt: "2026-07-17T12:00:00.000Z",
      sources: Object.fromEntries(
        present.map((section) => [section, { status: "ok", cacheState: "fresh", fetchedAt }]),
      ),
    },
    ...Object.fromEntries(present.map((section) => [
      section,
      section === "sentimentPulse"
        ? {
            value: section,
            series: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
              id,
              { id, status: "current", value: 1 },
            ])),
            __measureValidity: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
              id,
              { validUntil: "2026-08-17T00:00:00.000Z" },
            ])),
          }
        : { value: section },
    ])),
  };
}

describe("published families with no section", () => {
  it("a published family with no section reports an unavailable reason", async () => {
    const startedAt = new Date("2026-07-18T03:17:00.000Z");
    const finalisedAt = new Date("2026-07-18T03:43:00.000Z");
    const { env, store } = kvEnv({
      [PUBLICATION_CURRENT_KEY]: snapshotWithout(["housePriceIndex"]),
    });
    const { run } = await createRun(env, startedAt);
    for (const jobId of run.expectedJobIds) {
      store.set(`${RUN_PREFIX}${run.runId}:terminal:${jobId}`, {
        runId: run.runId,
        jobId,
        status: jobId === "section:housePriceIndex" ? "failure" : "success",
        result: jobId === "section:housePriceIndex"
          ? { error: "ONS house price index bulletin did not expose previous private rent annual growth" }
          : null,
      });
    }

    const result = await finaliseRun(run.runId, env, { now: finalisedAt });

    // The reason lives in the publisher's small status record.
    const status = await env.METRICS_CACHE.get(PUBLICATION_STATUS_KEY, "json");
    expect(status.unavailableSections).toEqual([
      // Contract collection succeeded but left no current award record.
      { id: "crimeStatistics", reason: "no-current-observation" },
      { id: "governmentContracts", reason: "no-current-observation" },
      { id: "housePriceIndex", reason: "collector-failed" },
    ]);
    expect(result.publicationResult?.status.unavailableSections).toEqual(status.unavailableSections);

    vi.useFakeTimers();
    vi.setSystemTime(finalisedAt);
    const health = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      env,
    );
    expect(health.status).toBe(200);
    const body = await health.json();
    expect(body).toEqual({
      status: "degraded",
      ready: false,
      degraded: true,
      missingRequiredSections: ["housePriceIndex"],
      held: ["nhsStats"],
      unavailableSections: status.unavailableSections,
    });
    // No collector internals reach the public health contract.
    expect(JSON.stringify(body)).not.toMatch(/private rent|v1[23]:|terminal|error/i);
  });

  it("names a published family without a collection job as not scheduled", () => {
    expect(unavailableReasonFor("earlyYears", null)).toBe("not-scheduled");
    expect(unavailableReasonFor("housePriceIndex", { status: "failure" })).toBe("collector-failed");
    expect(unavailableReasonFor("housePriceIndex", { status: "pending" })).toBe("collector-failed");
    expect(unavailableReasonFor("housePriceIndex", { status: "success" })).toBe("no-current-observation");
    expect(unavailableReasonFor("housePriceIndex", null)).toBe("no-current-observation");
  });

  it("serves only well-formed reasons for families absent from the current publication", async () => {
    const now = new Date("2026-07-18T03:43:00.000Z");
    const snapshot = snapshotWithout([]);
    const artifact = buildPublicSnapshotArtifact(snapshot, now);
    const { env, store } = kvEnv({ [PUBLICATION_CURRENT_KEY]: snapshot });
    await env.METRICS_CACHE.put(PUBLIC_SNAPSHOT_KEY, artifact.body, { metadata: artifact.metadata });
    store.set(PUBLICATION_STATUS_KEY, {
      status: "published",
      generatedAt: snapshot.meta.generatedAt,
      includedSections: Object.keys(snapshot.meta.sources).sort(),
      unavailableSections: [
        { id: "crimeStatistics", reason: "collector-failed", error: "stack trace at worker.js:1" },
        { id: "housePriceIndex", reason: "collector-failed" },
        { id: "bettingOdds", reason: "collector-failed" },
        { id: "governmentContracts", reason: "anything else" },
      ],
    });

    vi.useFakeTimers();
    vi.setSystemTime(now);
    const health = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      env,
    );
    const body = await health.json();
    expect(body.status).toBe("ready");
    // housePriceIndex is present now, bettingOdds is held: neither is listed.
    // A malformed reason falls back to the conservative public reason.
    expect(body.unavailableSections).toEqual([
      { id: "crimeStatistics", reason: "collector-failed" },
      { id: "governmentContracts", reason: "no-current-observation" },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/stack|worker\.js/);
  });
});

describe("police-recorded total", () => {
  it("fails closed when an edition states the total in wording the parser does not recognise", () => {
    const changed = CRIME_BULLETIN_HTML.replace(
      "a 1% decrease compared with last year (5.3 million)",
      "a 1% increase compared with last year (5.1 million)",
    );
    expect(changed).not.toBe(CRIME_BULLETIN_HTML);
    expect(() => parseOnsCrimeBulletin(changed, LEGACY_CRIME_EDITION_URL)).toThrow(
      /police-recorded crime excluding fraud and computer misuse/,
    );
  });
});

describe("CSEW comparison wording", () => {
  const recorded = fixture("crime-yearendingjune2026.html");
  const fraudClause =
    "4.5 million fraud incidents, an 11% increase compared with last year's survey (4.1 million incidents)";
  const fraudMeasure = (html: string) =>
    parseOnsCrimeBulletin(html, CRIME_EDITION_URL).crimeSurvey.measures.find(
      (item: { id: string }) => item.id === "fraud",
    );

  it("reports a decimal increase even when a later sub-measure clause has no significant change", () => {
    expect(recorded).toContain(fraudClause);
    const html = recorded.replace(
      fraudClause,
      "4.5 million fraud incidents, an 11.4% increase compared with last year's survey (4.1 million incidents); there was no statistically significant change in other fraud",
    );
    expect(fraudMeasure(html)).toMatchObject({
      value: 4_500_000,
      changeLabel: "11.4% higher than the previous survey",
    });
  });

  it("fails closed when a stated change uses unrecognised wording before a no-change clause", () => {
    const html = recorded.replace(
      fraudClause,
      "4.5 million fraud incidents, a statistically significant 11% rise on last year's survey (4.1 million incidents); there was no statistically significant change in other fraud",
    );
    expect(() => fraudMeasure(html)).toThrow(/CSEW fraud and comparison/);
  });
});

describe("publisher under the three-message pipeline", () => {
  it("takes a collector failure from the feed's last attempt when the run has no terminal records", async () => {
    const at = new Date("2026-07-18T03:43:00.000Z");
    const runId = "2026-07-18";
    const { env } = kvEnv({
      [PUBLICATION_CURRENT_KEY]: snapshotWithout(["housePriceIndex"]),
      "v20:feed:housePriceIndex": {
        feedId: "housePriceIndex",
        record: null,
        lastAttempt: { runId, at: at.toISOString(), status: "failure", reason: "source unreachable" },
      },
      // A failure from another run says nothing about this one.
      "v20:feed:crimeStatistics": {
        feedId: "crimeStatistics",
        record: null,
        lastAttempt: { runId: "2026-07-17", at: at.toISOString(), status: "failure", reason: "old" },
      },
    });

    const { status } = await publishFromCaches(env, { runId, now: at });

    expect(status.unavailableSections).toEqual([
      { id: "crimeStatistics", reason: "no-current-observation" },
      { id: "governmentContracts", reason: "no-current-observation" },
      { id: "housePriceIndex", reason: "collector-failed" },
    ]);
  });

  it("reads the contracts record from the per-feed key, or the legacy key when that is newer", async () => {
    const record = (fetchedAt: string) => ({ section: "governmentContracts", data: { fetchedAt }, fetchedAt });
    const feed = (fetchedAt: string) => ({
      feedId: "governmentContracts",
      record: record(fetchedAt),
      lastAttempt: { runId: "r", at: fetchedAt, status: "success", reason: null },
    });
    const older = "2026-07-17T03:20:00.000Z";
    const newer = "2026-07-18T03:20:00.000Z";

    expect(await contractsRecordFor(kvEnv({ "v20:feed:governmentContracts": feed(newer) }).env)).toEqual(record(newer));
    expect(await contractsRecordFor(kvEnv({ [CONTRACTS_KEY]: record(older) }).env)).toEqual(record(older));
    expect(
      await contractsRecordFor(kvEnv({ "v20:feed:governmentContracts": feed(older), [CONTRACTS_KEY]: record(newer) }).env),
    ).toEqual(record(newer));
    expect(await contractsRecordFor(kvEnv().env)).toBeNull();
  });
});

describe("a published family whose collector failed but whose older evidence is still shown", () => {
  it("is named in the status record and in health, without degrading readiness", async () => {
    const startedAt = new Date("2026-07-18T03:17:00.000Z");
    const finalisedAt = new Date("2026-07-18T03:43:00.000Z");
    const { env, store } = kvEnv({ [PUBLICATION_CURRENT_KEY]: snapshotWithout([]) });
    const { run } = await createRun(env, startedAt);
    for (const jobId of run.expectedJobIds) {
      store.set(`${RUN_PREFIX}${run.runId}:terminal:${jobId}`, {
        runId: run.runId,
        jobId,
        status: jobId === "section:nationalDebt" ? "failure" : "success",
        result: jobId === "section:nationalDebt" ? { error: "bulletin wording changed" } : null,
      });
    }

    await finaliseRun(run.runId, env, { now: finalisedAt });

    const status = await env.METRICS_CACHE.get(PUBLICATION_STATUS_KEY, "json");
    expect(status.failingSections).toEqual(["nationalDebt"]);

    vi.useFakeTimers();
    vi.setSystemTime(finalisedAt);
    const health = await publicWorker.fetch(new Request("https://public-data.org/data/health.json"), env);
    const body = await health.json();
    expect(body.failing).toEqual(["nationalDebt"]);
    // Ids only: no collector error text, keys or run ids.
    expect(JSON.stringify(body)).not.toMatch(/wording|v1[23]:|terminal|error/i);
  });

  it("drops ids that are not published families from a stored failing list", async () => {
    const { publicFailingSections } = await import("@/worker/publication-availability");
    expect(publicFailingSections({ failingSections: ["nationalDebt", "nhsStats", "<script>", 7] })).toEqual(["nationalDebt"]);
    expect(publicFailingSections(null)).toEqual([]);
  });
});
