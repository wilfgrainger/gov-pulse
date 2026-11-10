// Shared harness for the wired data Worker (worker/public-data-entry.js):
// a counting fake KV, a fake Queue with Cloudflare retry semantics
// (max_retries 3, then the dead-letter queue) and fixture collector records.
// Test files mock the collector modules and point them at `collectorDefaults`.
import { vi } from "vitest";

import publicWorker from "@/worker/public-data-entry";
import { PUBLICATION_CURRENT_KEY } from "@/worker/publication-entry";
import { FEED_REGISTRY_VERSION, REQUIRED_PUBLISHED_SECTION_IDS } from "@/worker/feed-registry";
import { previousCompleteDays, rankDailyAwards } from "@/feeds/government-contracts/parse.js";
import { DAILY_CRON } from "@/worker/publication-schedule";

type Body = Record<string, unknown>;
type Pending = { body: Body; attempts: number };

export const DAILY_TIME = new Date("2026-11-10T03:17:00.000Z");
const MAX_DELIVERIES = 4; // first delivery + max_retries 3 (worker/wrangler.toml)

export function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const metadata = new Map<string, Record<string, unknown>>();
  const decode = (value: unknown, type?: "json" | "text") => {
    if (value === undefined || value === null) return null;
    if (type === "text") return typeof value === "string" ? value : JSON.stringify(value);
    if (typeof value !== "string") return structuredClone(value);
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  const queue: Pending[] = [];
  const dlq: Body[] = [];
  const env = {
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
      delete: vi.fn(async (key: string) => {
        store.delete(key);
        metadata.delete(key);
      }),
    },
    DATA_JOBS: {
      send: vi.fn(async (body: Body) => {
        queue.push({ body: structuredClone(body), attempts: 1 });
      }),
      sendBatch: vi.fn(async (messages: { body: Body }[]) => {
        for (const item of messages) queue.push({ body: structuredClone(item.body), attempts: 1 });
      }),
    },
  };
  const read = (key: string) => decode(store.get(key), "json");
  const putKeys = () => env.METRICS_CACHE.put.mock.calls.map(([key]) => key as string);
  return { env, store, metadata, queue, dlq, read, putKeys };
}

export type Harness = ReturnType<typeof kvEnv>;

/** Section data that the evidence policy treats as current at `now`. */
export function sectionData(section: string, now: Date, expiresAt?: string) {
  const validUntil = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const base = section === "sentimentPulse"
    ? {
        value: section,
        series: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
          id,
          { id, status: "current", value: 1 },
        ])),
        __measureValidity: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
          id,
          { validUntil },
        ])),
      }
    : { value: `${section}@${now.toISOString()}` };
  return expiresAt ? { ...base, expiresAt } : base;
}

export function sectionRecord(section: string, now: Date, expiresAt?: string) {
  const fetchedAt = now.toISOString();
  return {
    section,
    data: sectionData(section, now, expiresAt),
    source: { status: "ok", cacheState: "fresh", fetchedAt, source: "fixture" },
    fetchedAt,
  };
}

/** Yesterday's committed publication, as production holds one. */
export function committedSnapshot(at: Date) {
  const fetchedAt = at.toISOString();
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: fetchedAt,
      fetchedAt,
      sources: Object.fromEntries(
        REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [section, { status: "ok", cacheState: "fresh", fetchedAt }]),
      ),
    },
    ...Object.fromEntries(REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [section, sectionData(section, at)])),
  };
}

export function contractsDayShard(day: string, now: Date) {
  const index = Number(day.slice(-2));
  const release = {
    ocid: `ocds-h6vhtk-${index.toString(16).padStart(8, "0")}`,
    id: `${String(index).padStart(6, "0")}-2026`,
    date: `${day}T13:00:00.000Z`,
    buyer: { name: "Buyer" },
    tender: { title: "Contract", procurementMethod: "open", mainProcurementCategory: "services" },
    awards: [{ id: `award-${index}`, title: "Award", date: `${day}T12:00:00.000Z`, value: { amount: 1000 + index, currency: "GBP" }, suppliers: [{ name: "Supplier", id: "supplier-1" }] }],
    contracts: [],
    parties: [{ id: "supplier-1", address: { postalCode: "SY1 1AA" } }],
  };
  return rankDailyAwards([release], day, now, {});
}

/** Six of the seven contracts day shards already stored, as on a normal day. */
export function storedContractShards(now: Date) {
  return Object.fromEntries(
    previousCompleteDays(now, 7)
      .slice(0, 6)
      .map((day) => [`v20:feed:governmentContracts:shard:${day}`, contractsDayShard(day, now)]),
  );
}

export function seededHarness(now = DAILY_TIME, extra: Record<string, unknown> = {}) {
  return kvEnv({
    [PUBLICATION_CURRENT_KEY]: committedSnapshot(new Date(now.getTime() - 86_400_000)),
    ...storedContractShards(now),
    ...extra,
  });
}

/** Default fixture collectors: every source answers with a current record. */
export const collectorDefaults = {
  section: async (section: string, _env?: unknown, _ctx?: unknown, now: Date = new Date()) =>
    sectionRecord(section, now),
  external: async (section: string, options: { now: Date }) => sectionRecord(section, options.now),
  shard: async (ctx: { now: Date }, day: string) => contractsDayShard(day, ctx.now),
};

export function message(pending: Pending) {
  return { body: pending.body, attempts: pending.attempts, ack: vi.fn(), retry: vi.fn() };
}

/** Deliver one message through the wired Queue handler; returns its outcome. */
export async function deliver(h: Harness, pending: Pending) {
  const msg = message(pending);
  await publicWorker.queue({ messages: [msg] } as never, h.env as never, {} as never);
  if (msg.retry.mock.calls.length > 0) {
    if (pending.attempts < MAX_DELIVERIES) h.queue.push({ body: pending.body, attempts: pending.attempts + 1 });
    else h.dlq.push(pending.body);
    return "retry";
  }
  return msg.ack.mock.calls.length > 0 ? "ack" : "none";
}

export async function cron(h: Harness, cronExpression = DAILY_CRON, at = DAILY_TIME) {
  const pending: Promise<unknown>[] = [];
  publicWorker.scheduled(
    { cron: cronExpression, scheduledTime: at.getTime() } as never,
    h.env as never,
    { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as never,
  );
  await Promise.all(pending);
}

/**
 * cron -> collect messages (with retries) -> finalise after the deadline.
 * The system clock must be faked (Date only) by the caller.
 */
export async function runDaily(h: Harness, at = DAILY_TIME) {
  vi.setSystemTime(at);
  await cron(h, DAILY_CRON, at);
  const finalises: Pending[] = [];
  while (h.queue.length > 0) {
    const next = h.queue.shift()!;
    if (next.body.type === "finalise") finalises.push(next);
    else await deliver(h, next);
  }
  const finalise = finalises.at(-1);
  if (!finalise) throw new Error("cron sent no finalise message");
  vi.setSystemTime(new Date(Date.parse(String(finalise.body.deadlineAt)) + 60_000));
  await deliver(h, finalise);
  return { runId: String(finalise.body.runId), finalise };
}
