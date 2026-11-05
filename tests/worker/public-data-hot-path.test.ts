// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import publicWorker, { readPreparedPublicArtifact } from "@/worker/public-data-entry";
import { publishFromCaches } from "@/worker/queued-publication-entry";
import {
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_STATUS_KEY,
} from "@/worker/publication-entry";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";
import { PUBLIC_SNAPSHOT_KEY, buildPublicProjection } from "@/worker/public-snapshot";
import { PUBLICATION_CONFIG, publicationPublished } from "@/contracts/publication-policy";
import { sectionCurrentness } from "@/worker/publication-currentness";

const REQUIRED = [
  "sentimentPulse",
  "gdpTracker",
  "employmentStats",
  "nationalDebt",
  "taxRevenue",
  "migrationStats",
  "housePriceIndex",
  "realWages",
  "electionPolling",
  "nhsStats",
];

type PutOptions = { metadata?: Record<string, unknown>; expirationTtl?: number };

function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial));
  const metadata = new Map<string, Record<string, unknown>>();
  const reads: string[] = [];
  const writes: string[] = [];
  const read = (key: string, type?: "json" | "text") => {
    const value = store.get(key);
    if (value === undefined) return null;
    if (type === "text") return typeof value === "string" ? value : JSON.stringify(value);
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch { return value; }
    }
    return JSON.parse(JSON.stringify(value));
  };
  return {
    store,
    metadata,
    reads,
    writes,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string, type?: "json" | "text") => {
          reads.push(key);
          return read(key, type);
        }),
        getWithMetadata: vi.fn(async (key: string, type?: "json" | "text") => {
          reads.push(key);
          return { value: read(key, type), metadata: metadata.get(key) ?? null };
        }),
        put: vi.fn(async (key: string, value: string, options?: PutOptions) => {
          writes.push(key);
          // Text artifacts are stored verbatim, as Workers KV does.
          store.set(key, value);
          if (options?.metadata) metadata.set(key, options.metadata);
        }),
        delete: vi.fn(async (key: string) => {
          store.delete(key);
          metadata.delete(key);
        }),
      },
    },
  };
}

function internalSnapshot() {
  const fetchedAt = "2026-07-17T10:00:00.000Z";
  const sources = Object.fromEntries(
    REQUIRED.map((section) => [section, { status: "ok", cacheState: "fresh", fetchedAt }]),
  );
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: "2026-07-17T12:00:00.000Z",
      fetchedAt: "2026-07-17T12:00:00.000Z",
      sources,
    },
    ...Object.fromEntries(REQUIRED.map((section) => [section, { value: section }])),
    sentimentPulse: {
      value: "sentimentPulse",
      order: ["inflation", "bankRate", "unemployment"],
      series: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
        id,
        { id, status: "current", value: 1, annualDelta: 0.1, history: [] },
      ])),
      __measureValidity: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
        id,
        { validUntil: "2026-08-17T00:00:00.000Z" },
      ])),
    },
    migrationStats: { headline: { netMigration: 171_000 } },
    realWages: { headline: { regularPayRealGrowthPercent: 0.6, totalPayRealGrowthPercent: 0.9 } },
  };
}

const PUBLISHED_AT = new Date("2026-07-18T03:30:00.000Z");
const READ_AT = new Date("2026-07-18T03:40:00.000Z");

async function publishedEnv() {
  const kv = kvEnv({ [PUBLICATION_CURRENT_KEY]: JSON.stringify(internalSnapshot()) });
  await publishFromCaches(kv.env, { now: PUBLISHED_AT });
  return kv;
}

function get(path: string, env: unknown) {
  return publicWorker.fetch(new Request(`https://public-data.org${path}`), env);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("free-tier public read path", () => {
  it("a snapshot cache miss clones the artifact at most once", async () => {
    const { env, store } = await publishedEnv();
    vi.useFakeTimers();
    vi.setSystemTime(READ_AT);
    const clone = vi.spyOn(globalThis, "structuredClone");

    const response = await get("/data/metrics-snapshot.json", env);

    expect(response.status).toBe(200);
    expect(clone.mock.calls.length).toBeLessThanOrEqual(1);
    // The publisher stored an already-normalised artifact: the read path
    // serves it unchanged.
    expect(await response.text()).toBe(store.get(PUBLIC_SNAPSHOT_KEY));
  });

  it("the stored public artifact is a fixed point of read-time normalisation", async () => {
    const { store } = await publishedEnv();
    const stored = JSON.parse(String(store.get(PUBLIC_SNAPSHOT_KEY)));
    expect(buildPublicProjection(stored, READ_AT)).toEqual(stored);
    expect(JSON.stringify(buildPublicProjection(stored, READ_AT))).toBe(store.get(PUBLIC_SNAPSHOT_KEY));
  });

  it("a section that expires after publication is withheld at read time with at most one clone", async () => {
    const { env, store, metadata } = await publishedEnv();
    const stored = JSON.parse(String(store.get(PUBLIC_SNAPSHOT_KEY)));
    const expiring = Object.keys(stored.meta.sources)[0];
    stored[expiring] = { ...stored[expiring], expiresAt: "2026-07-18T03:35:00.000Z" };
    store.set(PUBLIC_SNAPSHOT_KEY, JSON.stringify(stored));
    metadata.set(PUBLIC_SNAPSHOT_KEY, {
      ...metadata.get(PUBLIC_SNAPSHOT_KEY),
      validUntil: "2026-07-19T00:00:00.000Z",
    });
    const clone = vi.spyOn(globalThis, "structuredClone");

    const prepared = await readPreparedPublicArtifact(env, READ_AT);

    expect(clone.mock.calls.length).toBeLessThanOrEqual(1);
    expect(prepared).not.toBeNull();
    const served = JSON.parse(prepared!.body);
    expect(served).not.toHaveProperty(expiring);
    expect(served.meta.sources).not.toHaveProperty(expiring);
    expect(served.meta.publicProjection.publishedSections).not.toContain(expiring);
  });

  it("a sentiment measure that expires after publication is redacted at read time", async () => {
    const { env, store } = await publishedEnv();
    const stored = JSON.parse(String(store.get(PUBLIC_SNAPSHOT_KEY)));
    stored.sentimentPulse.__measureValidity.inflation.validUntil = "2026-07-18T03:35:00.000Z";
    store.set(PUBLIC_SNAPSHOT_KEY, JSON.stringify(stored));
    const clone = vi.spyOn(globalThis, "structuredClone");

    const prepared = await readPreparedPublicArtifact(env, READ_AT);

    expect(clone.mock.calls.length).toBeLessThanOrEqual(1);
    const served = JSON.parse(prepared!.body);
    expect(served.sentimentPulse.series.inflation).toMatchObject({
      status: "expired",
      value: null,
      annualDelta: null,
    });
    expect(served.sentimentPulse.series.bankRate).toMatchObject({ status: "current", value: 1 });
    // Redaction is a fixed point: a second read serves the same body.
    store.set(PUBLIC_SNAPSHOT_KEY, prepared!.body);
    expect((await readPreparedPublicArtifact(env, READ_AT))!.body).toBe(prepared!.body);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form tampering of parsed JSON
  async function servedAfterTampering(tamper: (stored: any) => void) {
    const { env, store } = await publishedEnv();
    const stored = JSON.parse(String(store.get(PUBLIC_SNAPSHOT_KEY)));
    tamper(stored);
    const storedBytes = JSON.stringify(stored);
    store.set(PUBLIC_SNAPSHOT_KEY, storedBytes);
    vi.useFakeTimers();
    vi.setSystemTime(READ_AT);
    const response = await get("/data/metrics-snapshot.json", env);
    expect(response.status).toBe(200);
    const text = await response.text();
    return { text, body: JSON.parse(text), storedBytes };
  }

  it("held evidence inside a prepared artifact is never served", async () => {
    // nhsStats is held and, under this fixture, current: only the policy
    // guard (not currentness) can withhold it.
    expect(publicationPublished("nhsStats")).toBe(false);
    const internal = internalSnapshot();
    expect(
      sectionCurrentness("nhsStats", internal.nhsStats, internal.meta.sources.nhsStats, READ_AT).current,
    ).toBe(true);

    const { text, body, storedBytes } = await servedAfterTampering((stored) => {
      stored.nhsStats = internal.nhsStats;
      stored.meta.sources.nhsStats = internal.meta.sources.nhsStats;
      stored.meta.publicProjection.publishedSections = [
        ...stored.meta.publicProjection.publishedSections,
        "nhsStats",
      ].sort();
    });

    expect(text).not.toBe(storedBytes);
    expect(body).not.toHaveProperty("nhsStats");
    expect(body.meta.sources).not.toHaveProperty("nhsStats");
    expect(body.meta.publicProjection.publishedSections).not.toContain("nhsStats");
  });

  it("a family held after publication is withheld on the next read", async () => {
    const { env, store } = await publishedEnv();
    const storedBytes = String(store.get(PUBLIC_SNAPSHOT_KEY));
    expect(JSON.parse(storedBytes)).toHaveProperty("gdpTracker");
    const decision = PUBLICATION_CONFIG.publications.gdpTracker;
    const original = decision.state;
    decision.state = "held";
    try {
      vi.useFakeTimers();
      vi.setSystemTime(READ_AT);
      const response = await get("/data/metrics-snapshot.json", env);
      expect(response.status).toBe(200);
      const text = await response.text();
      const body = JSON.parse(text);
      expect(text).not.toBe(storedBytes);
      expect(body).not.toHaveProperty("gdpTracker");
      expect(body.meta.sources).not.toHaveProperty("gdpTracker");
      expect(body.meta.publicProjection.publishedSections).not.toContain("gdpTracker");
    } finally {
      decision.state = original;
    }
  });

  it("a catalogue measure for a held family is dropped", async () => {
    const { text, body, storedBytes } = await servedAfterTampering((stored) => {
      stored.meta.measureCatalog.measures = {
        heldMeasure: { id: "heldMeasure", sourceId: "nhsStats" },
        publishedMeasure: { id: "publishedMeasure", sourceId: "gdpTracker" },
      };
    });

    expect(text).not.toBe(storedBytes);
    expect(body.meta.measureCatalog.measures).not.toHaveProperty("heldMeasure");
    expect(body.meta.measureCatalog.measures).toHaveProperty("publishedMeasure");
  });

  it("an edition-summary change for a held family is withheld", async () => {
    const { text, body, storedBytes } = await servedAfterTampering((stored) => {
      stored.meta.measureCatalog.measures = {
        heldMeasure: { id: "heldMeasure", sourceId: "nhsStats" },
      };
      stored.meta.editionSummary.changes = [
        { measureId: "heldMeasure", nextSourceEditionId: "held-edition" },
      ];
      stored.meta.editionSummary.sourceEditionIds = ["held-edition"];
    });

    expect(text).not.toBe(storedBytes);
    expect(text).not.toMatch(/held-edition|heldMeasure/);
    expect(body.meta.editionSummary.changes).toEqual([]);
  });

  it("a meta field outside the public allow-list is dropped", async () => {
    const { text, body, storedBytes } = await servedAfterTampering((stored) => {
      stored.meta.commitManifest = { schemaVersion: 1, status: "published" };
    });

    expect(text).not.toBe(storedBytes);
    expect(body.meta).not.toHaveProperty("commitManifest");
  });

  it("an unsanitised prepared artifact is sanitised before it is served", async () => {
    const { env, store } = await publishedEnv();
    const stored = JSON.parse(String(store.get(PUBLIC_SNAPSHOT_KEY)));
    const section = Object.keys(stored.meta.sources)[0];
    stored.meta.sources[section].backend = "cloudflare-worker-kv";
    store.set(PUBLIC_SNAPSHOT_KEY, JSON.stringify(stored));

    const prepared = await readPreparedPublicArtifact(env, READ_AT);

    expect(prepared).not.toBeNull();
    expect(prepared!.body).not.toMatch(/cloudflare-worker-kv/);
  });

  it("/data/health.json reads the status key and never the full internal publication", async () => {
    const { env, reads } = await publishedEnv();
    vi.useFakeTimers();
    vi.setSystemTime(READ_AT);
    reads.length = 0;
    const clone = vi.spyOn(globalThis, "structuredClone");

    const response = await get("/data/health.json", env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready", ready: true });
    expect(reads).toContain(PUBLICATION_STATUS_KEY);
    expect(reads).not.toContain(PUBLICATION_CURRENT_KEY);
    expect([...new Set(reads)].sort()).toEqual([PUBLIC_SNAPSHOT_KEY, PUBLICATION_STATUS_KEY].sort());
    expect(clone.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("/data/health.json stays bootstrapping without a publisher status record", async () => {
    const { env, store } = await publishedEnv();
    store.delete(PUBLICATION_STATUS_KEY);
    vi.useFakeTimers();
    vi.setSystemTime(READ_AT);

    const response = await get("/data/health.json", env);

    expect(await response.json()).toEqual({ status: "bootstrapping", ready: false });
  });

  it("/data/health.json reports a held required section that aged out after publication as missing", async () => {
    const { env, store } = await publishedEnv();
    expect(publicationPublished("nhsStats")).toBe(false);
    const status = JSON.parse(String(store.get(PUBLICATION_STATUS_KEY)));
    status.sectionValidUntil.nhsStats = "2026-07-18T03:35:00.000Z";
    store.set(PUBLICATION_STATUS_KEY, JSON.stringify(status));
    vi.useFakeTimers();
    vi.setSystemTime(READ_AT);

    const response = await get("/data/health.json", env);

    expect(await response.json()).toMatchObject({
      status: "degraded",
      ready: false,
      degraded: true,
      missingRequiredSections: ["nhsStats"],
    });
  });

  it("every KV key written on publish has a reader", async () => {
    const { env, reads, writes, store } = await publishedEnv();
    const written = [...new Set(writes)];
    reads.length = 0;

    // Every public and operational reader of publication state.
    vi.useFakeTimers();
    vi.setSystemTime(READ_AT);
    await get("/data/metrics-snapshot.json", env);
    await get("/data/health.json", env);
    await get("/data/editions.json", env);
    const editionId = JSON.parse(String(store.get(PUBLICATION_CURRENT_KEY))).meta.measureCatalog?.editionId;
    if (editionId) await get(`/data/edition.json?edition=${encodeURIComponent(editionId)}`, env);
    vi.useRealTimers();
    await publishFromCaches(env, { now: new Date("2026-07-18T04:30:00.000Z") });

    const unread = written.filter((key) => !reads.includes(key));
    expect(unread).toEqual([]);
    expect(written).not.toContain("v12:publication:commit");
  });
});
