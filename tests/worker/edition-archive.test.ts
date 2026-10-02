import { describe, expect, it } from "vitest";
import { archiveEdition, EDITION_CONTENT_PREFIX, EDITION_SUMMARY_PREFIX, listEditionSummaries, readEdition } from "../../worker/edition-archive.js";
import { catalogRevisionIdentity } from "../../worker/measure-catalog.js";
import publicDataWorker, { editionResponse, editionsResponse } from "../../worker/public-data-entry.js";

class MemoryKv {
  values = new Map<string, { value: string; metadata?: Record<string, unknown> }>();
  async get(key: string, type?: "json" | "text") {
    const stored = this.values.get(key)?.value;
    if (stored === undefined) return null;
    return type === "text" ? stored : JSON.parse(stored);
  }
  async getWithMetadata(key: string, type?: "json" | "text") {
    const stored = this.values.get(key);
    if (!stored) return { value: null, metadata: null };
    return { value: type === "text" ? stored.value : JSON.parse(stored.value), metadata: stored.metadata ?? null };
  }
  async put(key: string, value: string, options?: { metadata?: Record<string, unknown> }) {
    this.values.set(key, { value, metadata: options?.metadata });
  }
  async list(options: { prefix: string; limit: number }) {
    return { keys: [...this.values].filter(([key]) => key.startsWith(options.prefix)).slice(0, options.limit).map(([name, stored]) => ({ name, metadata: stored.metadata })) };
  }
  async delete(key: string) { this.values.delete(key); }
}

function edition(index: number) {
  const publishedAt = new Date(Date.UTC(2024, 0, 1 + index)).toISOString();
  const measure = {
    id: "measure", label: "Measure", evidenceClass: "official-statistics", comparisonKey: "measure-family", cadence: "monthly", unit: "units", basis: "Published measure basis",
    geography: { code: "GB", label: "Great Britain" }, sourceId: "ons", sourceUrl: "https://www.ons.gov.uk/series", sourceEditionId: `edition-${index}`,
    observationPeriod: { start: "2024-01-01", end: "2024-01-31", label: "January 2024" }, publishedAt, fetchedAt: publishedAt, validUntil: "2030-01-01T00:00:00.000Z",
    availability: "current", value: index + 1, revisionId: `edition-${index}`, points: [{ period: "January 2024", observedAt: "2024-01-31", value: index + 1, valueStatus: "observed", revisionId: `edition-${index}` }], caveats: [],
  };
  const measures = { measure };
  const catalog = { schemaVersion: 2, editionId: catalogRevisionIdentity(measures), generatedAt: publishedAt, validUntil: "2030-01-01T00:00:00.000Z", measures };
  const summary = { id: catalog.editionId, publishedAt, sourceEditionIds: [`edition-${index}`], changes: [] };
  return { catalog, summary };
}

describe("content-addressed edition archive", () => {
  it("archives idempotently and returns a validated as-of edition", async () => {
    const kv = new MemoryKv();
    const first = edition(0);
    const archived = await archiveEdition({ METRICS_CACHE: kv }, first.catalog, first.summary);
    const repeated = await archiveEdition({ METRICS_CACHE: kv }, first.catalog, first.summary);
    const restored = await readEdition({ METRICS_CACHE: kv }, first.catalog.editionId);
    expect(archived.archived).toBe(true);
    expect(repeated.duplicate).toBe(true);
    expect(restored).toMatchObject({ asOf: first.catalog.generatedAt, summary: first.summary, catalog: first.catalog });
    expect([...kv.values.keys()].filter((key) => key.startsWith(EDITION_CONTENT_PREFIX))).toHaveLength(1);
  });

  it("refuses to rewrite an edition id with different evidence", async () => {
    const kv = new MemoryKv();
    const first = edition(1);
    await archiveEdition({ METRICS_CACHE: kv }, first.catalog, first.summary);
    const changed = structuredClone(first);
    changed.catalog.measures.measure.value = 99;
    changed.catalog.measures.measure.points[0].value = 99;
    await expect(archiveEdition({ METRICS_CACHE: kv }, changed.catalog, changed.summary)).rejects.toThrow(/cannot be rewritten/i);
  });

  it("rejects unsafe archive identifiers before touching KV", async () => {
    const kv = new MemoryKv();
    await expect(readEdition({ METRICS_CACHE: kv }, "../../private")).rejects.toThrow(/invalid/i);
    expect(kv.values.size).toBe(0);
  });

  it("retains 60 summaries and their content records without deleting the newest edition", async () => {
    const kv = new MemoryKv();
    const editions = Array.from({ length: 61 }, (_, index) => edition(index));
    for (const item of editions) await archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary);
    const summaries = await listEditionSummaries({ METRICS_CACHE: kv });
    expect(summaries).toHaveLength(60);
    expect(summaries[0].id).toBe(editions.at(-1)!.catalog.editionId);
    expect(await readEdition({ METRICS_CACHE: kv }, editions[0].catalog.editionId)).toBeNull();
    expect(await readEdition({ METRICS_CACHE: kv }, editions.at(-1)!.catalog.editionId)).not.toBeNull();
    expect([...kv.values.keys()].filter((key) => key.startsWith(EDITION_SUMMARY_PREFIX))).toHaveLength(60);
  });

  it("exposes archived editions as historical records and rejects arbitrary query values", async () => {
    const kv = new MemoryKv();
    const item = edition(5);
    await archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary);
    const valid = await editionResponse(new Request(`https://public-data.org/data/edition.json?edition=${item.catalog.editionId}`), { METRICS_CACHE: kv }, new URL(`https://public-data.org/data/edition.json?edition=${item.catalog.editionId}`));
    const payload = await valid.json();
    expect(valid.status).toBe(200);
    expect(payload).toMatchObject({ availability: "historical", edition: item.catalog.editionId, asOf: item.catalog.generatedAt });
    expect((await editionResponse(new Request("https://public-data.org/data/edition.json?edition=../../secret"), { METRICS_CACHE: kv }, new URL("https://public-data.org/data/edition.json?edition=../../secret"))).status).toBe(400);
    expect((await editionResponse(new Request("https://public-data.org/data/edition.json?edition=foo&debug=yes"), { METRICS_CACHE: kv }, new URL("https://public-data.org/data/edition.json?edition=foo&debug=yes"))).status).toBe(400);
    expect((await editionsResponse(new Request("https://public-data.org/data/editions.json"), { METRICS_CACHE: kv })).status).toBe(200);
    expect((await editionsResponse(new Request("https://public-data.org/data/editions.json?debug=true"), { METRICS_CACHE: kv })).status).toBe(400);
  });

  it("routes the exact archive URLs through the public Worker", async () => {
    const kv = new MemoryKv();
    const item = edition(8);
    await archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary);
    const env = { METRICS_CACHE: kv };
    const list = await publicDataWorker.fetch(new Request("https://public-data.org/data/editions.json"), env);
    const detail = await publicDataWorker.fetch(new Request(`https://public-data.org/data/edition.json?edition=${item.catalog.editionId}`), env);
    const unknown = await publicDataWorker.fetch(new Request("https://public-data.org/data/not-a-route.json"), env);
    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(unknown.status).toBe(404);
  });
});
