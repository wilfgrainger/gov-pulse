// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import publicWorker, { currentPublicArtifact } from "@/worker/public-data-entry";
import { publishFromCaches } from "@/worker/queued-publication-entry";
import { PUBLICATION_CURRENT_KEY, PUBLICATION_STATUS_KEY } from "@/worker/publication-entry";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";
import { publicationPublished } from "@/contracts/evidence-policy";

const SECTIONS = [
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

const PUBLISHED_AT = new Date("2026-07-18T03:30:00.000Z");
const READ_AT = new Date("2026-07-18T03:40:00.000Z");

function kvEnv(initial: Record<string, unknown>) {
  const store = new Map(Object.entries(initial));
  const metadata = new Map<string, Record<string, unknown>>();
  const read = (key: string, type?: string) => {
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
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string, type?: string) => read(key, type)),
        getWithMetadata: vi.fn(async (key: string, type?: string) => ({
          value: read(key, type),
          metadata: metadata.get(key) ?? null,
        })),
        put: vi.fn(async (key: string, value: string, options?: { metadata?: Record<string, unknown> }) => {
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

function internalSnapshot(without: string[] = []) {
  const keep = SECTIONS.filter((section) => !without.includes(section));
  const fetchedAt = "2026-07-17T10:00:00.000Z";
  const ids = ["inflation", "bankRate", "unemployment"];
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: "2026-07-17T12:00:00.000Z",
      fetchedAt: "2026-07-17T12:00:00.000Z",
      sources: Object.fromEntries(
        keep.map((section) => [section, { status: "ok", cacheState: "fresh", fetchedAt }]),
      ),
    },
    ...Object.fromEntries(keep.map((section) => [section, { value: section }])),
    sentimentPulse: {
      value: "sentimentPulse",
      order: ids,
      series: Object.fromEntries(ids.map((id) => [id, { id, status: "current", value: 1, annualDelta: 0.1, history: [] }])),
      __measureValidity: Object.fromEntries(ids.map((id) => [id, { validUntil: "2026-08-17T00:00:00.000Z" }])),
    },
    migrationStats: { headline: { netMigration: 171_000 } },
    realWages: { headline: { regularPayRealGrowthPercent: 0.6, totalPayRealGrowthPercent: 0.9 } },
  };
}

async function publishedEnv(without: string[] = []) {
  const kv = kvEnv({ [PUBLICATION_CURRENT_KEY]: JSON.stringify(internalSnapshot(without)) });
  await publishFromCaches(kv.env, { now: PUBLISHED_AT });
  return kv;
}

async function health(env: unknown, at = READ_AT) {
  vi.useFakeTimers();
  vi.setSystemTime(at);
  const response = await publicWorker.fetch(new Request("https://public-data.org/data/health.json"), env as never);
  expect(response.status).toBe(200);
  return response.json();
}

afterEach(() => vi.useRealTimers());

describe("health", () => {
  it("rebuilds a lapsed artifact once while that rebuild is fresh", async () => {
    const kv = await publishedEnv();
    const later = new Date("2026-07-20T03:40:00.000Z");
    const fresh = internalSnapshot();
    const fetchedAt = new Date(later.getTime() - 60 * 60 * 1000).toISOString();
    for (const source of Object.values(fresh.meta.sources)) source.fetchedAt = fetchedAt;
    fresh.meta.fetchedAt = fetchedAt;
    fresh.meta.generatedAt = fetchedAt;
    kv.store.set(PUBLICATION_CURRENT_KEY, JSON.stringify(fresh));
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const reads = () => [
      ...kv.env.METRICS_CACHE.get.mock.calls,
      ...kv.env.METRICS_CACHE.getWithMetadata.mock.calls,
    ].filter(([key]) => key === PUBLICATION_CURRENT_KEY).length;

    const before = reads();
    const first = await currentPublicArtifact(kv.env, { now: later, fetchImpl });
    const second = await currentPublicArtifact(kv.env, { now: new Date(later.getTime() + 1000), fetchImpl });

    expect(first?.delivery).toBe("cloudflare-kv-migration");
    expect(reads() - before).toBe(1);
    expect(second).toBe(first);
  });

  it("answers a repeat check without parsing the stored artifact again", async () => {
    const kv = await publishedEnv();
    expect(await health(kv.env)).toMatchObject({ status: "ready", ready: true });

    const parse = vi.spyOn(JSON, "parse");
    expect(await health(kv.env, new Date("2026-07-18T03:41:00.000Z"))).toMatchObject({ ready: true });

    expect(parse.mock.calls.filter(([text]) => String(text).length > 1_000)).toHaveLength(0);
    parse.mockRestore();
  });

  it("held required feed is reported in held and does not degrade", async () => {
    expect(publicationPublished("nhsStats")).toBe(false);
    const { env, store } = await publishedEnv();
    const body = await health(env);
    expect(body).toMatchObject({ status: "ready", ready: true, held: ["nhsStats"] });
    expect(body).not.toHaveProperty("degraded");
    expect(body).not.toHaveProperty("missingRequiredSections");
    // Held evidence stays unavailable: not a public section, not an unavailable-by-failure entry.
    expect(body.unavailableSections ?? []).not.toContainEqual(expect.objectContaining({ id: "nhsStats" }));

    // A held feed that has aged out (or never arrived) is still just held.
    const status = JSON.parse(String(store.get(PUBLICATION_STATUS_KEY)));
    status.sectionValidUntil.nhsStats = "2026-07-18T03:35:00.000Z";
    store.set(PUBLICATION_STATUS_KEY, JSON.stringify(status));
    expect(await health(env)).toMatchObject({ status: "ready", ready: true, held: ["nhsStats"] });
  });

  it("held feed absent from the publication entirely does not degrade", async () => {
    const { env } = await publishedEnv(["nhsStats"]);
    expect(await health(env)).toMatchObject({ status: "ready", ready: true, held: ["nhsStats"] });
  });

  it("published required feed without current observation degrades", async () => {
    const { env } = await publishedEnv(["housePriceIndex"]);
    const body = await health(env);
    expect(body).toMatchObject({
      status: "degraded",
      ready: false,
      degraded: true,
      missingRequiredSections: ["housePriceIndex"],
      held: ["nhsStats"],
    });
    expect(body.unavailableSections).toContainEqual({ id: "housePriceIndex", reason: "no-current-observation" });
  });

  it("published required feed whose observation is stale degrades", async () => {
    const snapshot = internalSnapshot();
    snapshot.meta.sources.housePriceIndex.fetchedAt = "2025-01-01T00:00:00.000Z";
    const kv = kvEnv({ [PUBLICATION_CURRENT_KEY]: JSON.stringify(snapshot) });
    await publishFromCaches(kv.env, { now: PUBLISHED_AT });
    const body = await health(kv.env);
    expect(body).toMatchObject({
      status: "degraded",
      ready: false,
      degraded: true,
      held: ["nhsStats"],
    });
    expect(body.missingRequiredSections).toContain("housePriceIndex");
    expect(body.missingRequiredSections).not.toContain("nhsStats");
  });

  it("response never contains run ids or KV key names", async () => {
    const { env } = await publishedEnv(["housePriceIndex"]);
    const text = JSON.stringify(await health(env));
    expect(text).not.toMatch(/v\d+:|publication:|run[-_ ]?id|terminal|METRICS_CACHE/i);
    const body = JSON.parse(text);
    expect(Object.keys(body).sort()).toEqual(
      ["degraded", "held", "missingRequiredSections", "ready", "status", "unavailableSections"].sort(),
    );
  });
});
