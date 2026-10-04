import { describe, expect, it } from "vitest";
import { archiveEdition, EDITION_CONTENT_PREFIX, EDITION_INDEX_KEY, EDITION_SUMMARY_CORRECTION_PREFIX, EDITION_SUMMARY_PREFIX, listEditionSummaries, readEdition, reconcileEditionSummaryFromRetainedPrior } from "../../worker/edition-archive.js";
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
  const summary: { id: string; publishedAt: string; previousEditionId: string | null; sourceEditionIds: string[]; changes: Record<string, unknown>[] } = { id: catalog.editionId, publishedAt, previousEditionId: null, sourceEditionIds: [`edition-${index}`], changes: [] };
  return { catalog, summary };
}

function misbasedEditionPair() {
  const prior = edition(4);
  const current = structuredClone(prior);
  current.catalog.generatedAt = "2024-01-06T00:00:00.000Z";
  current.catalog.measures.measure.sourceEditionId = "ons-edition-5";
  current.catalog.measures.measure.publisher = "Office for National Statistics";
  current.catalog.measures.measure.note = "Publisher metadata was normalised.";
  current.catalog.measures.measure.publishedAt = current.catalog.generatedAt;
  current.catalog.measures.measure.fetchedAt = current.catalog.generatedAt;
  current.catalog.editionId = catalogRevisionIdentity(current.catalog.measures);
  current.summary = {
    ...current.summary,
    id: current.catalog.editionId,
    publishedAt: current.catalog.generatedAt,
    previousEditionId: null,
    sourceEditionIds: ["ons-edition-5"],
    changes: [{
      measureId: "measure",
      kind: "new-observation",
      observedAt: "2024-01-31",
      period: "January 2024",
      previousSourceEditionId: null,
      nextSourceEditionId: "ons-edition-5",
      previousRevisionId: null,
      nextRevisionId: "edition-4",
      previous: null,
      next: 5,
    }],
  };
  return { prior, current };
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

  it("keeps the immutable archive when the same catalogue is retried with a different comparison summary", async () => {
    const kv = new MemoryKv();
    const first = edition(0);
    await archiveEdition({ METRICS_CACHE: kv }, first.catalog, first.summary);

    const retrySummary = {
      ...first.summary,
      publishedAt: "2024-01-03T00:00:00.000Z",
      previousEditionId: "catalog-different-baseline",
    };
    const retried = await archiveEdition({ METRICS_CACHE: kv }, first.catalog, retrySummary);
    const restored = await readEdition({ METRICS_CACHE: kv }, first.catalog.editionId);

    expect(retried).toMatchObject({ archived: false, duplicate: true, id: first.catalog.editionId });
    expect(restored).toMatchObject({ catalog: first.catalog, summary: first.summary });
    expect(JSON.parse(kv.values.get(EDITION_INDEX_KEY)!.value)).toHaveLength(1);
    expect([...kv.values.keys()].filter((key) => key.startsWith(EDITION_CONTENT_PREFIX))).toHaveLength(1);
  });

  it("publishes an append-only correction when a retained predecessor proves the first summary missed its baseline", async () => {
    const kv = new MemoryKv();
    const { prior, current } = misbasedEditionPair();
    await archiveEdition({ METRICS_CACHE: kv }, prior.catalog, prior.summary);
    await archiveEdition({ METRICS_CACHE: kv }, current.catalog, current.summary);

    const repaired = await reconcileEditionSummaryFromRetainedPrior(
      { METRICS_CACHE: kv },
      current.catalog.editionId,
    );
    const reread = await readEdition({ METRICS_CACHE: kv }, current.catalog.editionId);
    const indexed = await listEditionSummaries({ METRICS_CACHE: kv });
    const originalRecord = await kv.getWithMetadata(
      `${EDITION_SUMMARY_PREFIX}${current.catalog.editionId}`,
      "json",
    );
    const detailUrl = `https://public-data.org/data/edition.json?edition=${current.catalog.editionId}`;
    const detailResponse = await editionResponse(
      new Request(detailUrl),
      { METRICS_CACHE: kv },
      new URL(detailUrl),
    );
    const detail = await detailResponse.json();

    expect(repaired).toMatchObject({
      corrected: true,
      summary: {
        id: current.catalog.editionId,
        previousEditionId: prior.catalog.editionId,
        summaryCorrection: {
          kind: "baseline-reconciliation",
          baselineEditionId: prior.catalog.editionId,
        },
        changes: [{ kind: "metadata-change", previous: null, next: null }],
      },
    });
    expect(reread?.summary).toEqual(repaired.summary);
    expect(indexed[0]).toEqual(repaired.summary);
    expect(detail.summary).toEqual(repaired.summary);
    expect(detailResponse.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=60");
    expect(originalRecord.value.summary).toEqual(current.summary);

    await expect(
      reconcileEditionSummaryFromRetainedPrior(
        { METRICS_CACHE: kv },
        current.catalog.editionId,
      ),
    ).resolves.toMatchObject({ corrected: false, duplicate: true, summary: repaired.summary });
    expect(await readEdition({ METRICS_CACHE: kv }, current.catalog.editionId)).toMatchObject({
      catalog: current.catalog,
      summary: repaired.summary,
    });
  });

  it("archives source-linked value and metadata changes with their publication dates", async () => {
    const kv = new MemoryKv();
    const item = edition(9);
    item.summary.previousEditionId = "catalog-previous";
    item.summary.changes = [
      {
        measureId: "measure", kind: "revision", observedAt: "2024-01-31", period: "January 2024",
        previousSourceEditionId: "edition-8", nextSourceEditionId: "edition-9",
        previousRevisionId: "revision-8", nextRevisionId: "revision-9",
        previousSourcePublishedAt: "2024-01-31T00:00:00.000Z", nextSourcePublishedAt: item.catalog.measures.measure.publishedAt,
        previousSourceUrl: "https://www.ons.gov.uk/edition-8", nextSourceUrl: item.catalog.measures.measure.sourceUrl,
        previousUnit: "units", nextUnit: "units", previous: 9, next: 10,
      },
      {
        measureId: "measure", kind: "metadata-change", observedAt: null, period: null,
        previousSourceEditionId: "edition-8", nextSourceEditionId: "edition-9",
        previousRevisionId: "revision-8", nextRevisionId: "revision-9",
        previousSourcePublishedAt: "2024-01-31T00:00:00.000Z", nextSourcePublishedAt: item.catalog.measures.measure.publishedAt,
        previousSourceUrl: "https://www.ons.gov.uk/edition-8", nextSourceUrl: item.catalog.measures.measure.sourceUrl,
        previousUnit: "units", nextUnit: "units", previous: null, next: null, changedFields: ["sourceUrl"],
      },
    ];

    await archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary);

    await expect(readEdition({ METRICS_CACHE: kv }, item.catalog.editionId)).resolves.toMatchObject({ summary: item.summary });
    await expect(archiveEdition({ METRICS_CACHE: new MemoryKv() }, item.catalog, {
      ...item.summary,
      changes: [{ ...item.summary.changes[0], nextSourceUrl: "javascript:alert(1)" }],
    })).rejects.toThrow("Edition summary change is invalid");
  });

  it("serializes concurrent duplicate finalisers into one immutable index entry", async () => {
    const kv = new MemoryKv();
    const item = edition(2);
    await Promise.all([
      archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary),
      archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary),
    ]);

    expect(JSON.parse(kv.values.get(EDITION_INDEX_KEY)!.value)).toHaveLength(1);
    expect([...kv.values.keys()].filter((key) => key.startsWith(EDITION_CONTENT_PREFIX))).toHaveLength(1);
    expect(await readEdition({ METRICS_CACHE: kv }, item.catalog.editionId)).toMatchObject({ catalog: item.catalog });
  });

  it("retains an expired observation as historical evidence in the immutable detail", async () => {
    const kv = new MemoryKv();
    const item = edition(7);
    item.catalog.measures.measure.availability = "historical";
    item.catalog.measures.measure.validUntil = "2024-01-07T00:00:00.000Z";
    item.catalog.editionId = catalogRevisionIdentity(item.catalog.measures);
    item.summary.id = item.catalog.editionId;
    await archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary);

    const response = await editionResponse(
      new Request(`https://public-data.org/data/edition.json?edition=${item.catalog.editionId}`),
      { METRICS_CACHE: kv },
      new URL(`https://public-data.org/data/edition.json?edition=${item.catalog.editionId}`),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.availability).toBe("historical");
    expect(payload.measureCatalog.measures.measure).toMatchObject({ availability: "historical", value: 8 });
  });

  it("does not advertise a listed edition after its content object disappears", async () => {
    const kv = new MemoryKv();
    const item = edition(3);
    await archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary);
    const entry = JSON.parse(kv.values.get(EDITION_INDEX_KEY)!.value)[0];
    await kv.delete(`${EDITION_CONTENT_PREFIX}${entry.contentHash}`);

    expect(await listEditionSummaries({ METRICS_CACHE: kv })).toEqual([]);
    const response = await editionsResponse(
      new Request("https://public-data.org/data/editions.json"),
      { METRICS_CACHE: kv },
    );
    expect(await response.json()).toEqual({ editions: [], retention: 0 });
  });

  it("recovers an interrupted index write without leaving a dangling public entry", async () => {
    const kv = new MemoryKv();
    const item = edition(4);
    const put = kv.put.bind(kv);
    let failIndex = true;
    kv.put = async (key, value, options) => {
      if (key === EDITION_INDEX_KEY && failIndex) {
        failIndex = false;
        throw new Error("simulated index write interruption");
      }
      return put(key, value, options);
    };

    await expect(archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary)).rejects.toThrow("simulated index write interruption");
    expect(await listEditionSummaries({ METRICS_CACHE: kv })).toEqual([]);

    const recovered = await archiveEdition({ METRICS_CACHE: kv }, item.catalog, item.summary);
    expect(recovered.duplicate).toBe(true);
    expect(await listEditionSummaries({ METRICS_CACHE: kv })).toEqual([item.summary]);
    expect(await readEdition({ METRICS_CACHE: kv }, item.catalog.editionId)).not.toBeNull();
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

  it("keeps an earlier briefing unchanged after a newer edition is archived", async () => {
    const kv = new MemoryKv();
    const earlier = edition(20);
    const later = edition(21);
    await archiveEdition({ METRICS_CACHE: kv }, earlier.catalog, earlier.summary);
    const before = await readEdition({ METRICS_CACHE: kv }, earlier.catalog.editionId);

    await archiveEdition({ METRICS_CACHE: kv }, later.catalog, later.summary);

    expect(await readEdition({ METRICS_CACHE: kv }, earlier.catalog.editionId)).toEqual(before);
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
    const expiring = editions[1];
    await kv.put(`${EDITION_SUMMARY_CORRECTION_PREFIX}${expiring.catalog.editionId}`, JSON.stringify({ editionId: expiring.catalog.editionId }));
    const updated = edition(61);
    await archiveEdition({ METRICS_CACHE: kv }, updated.catalog, updated.summary);
    const summaries = await listEditionSummaries({ METRICS_CACHE: kv });
    expect(summaries).toHaveLength(60);
    expect(summaries[0].id).toBe(updated.catalog.editionId);
    expect(await readEdition({ METRICS_CACHE: kv }, expiring.catalog.editionId)).toBeNull();
    expect(await readEdition({ METRICS_CACHE: kv }, updated.catalog.editionId)).not.toBeNull();
    expect(kv.values.has(`${EDITION_SUMMARY_CORRECTION_PREFIX}${expiring.catalog.editionId}`)).toBe(false);
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
