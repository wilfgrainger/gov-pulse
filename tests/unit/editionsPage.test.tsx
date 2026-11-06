import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("edition archive reader", () => {
  it("shows source publication and archive dates and puts the newest archive first", async () => {
    vi.stubEnv("STATIC_EXPORT", "false");
    const base = {
      publishedAt: "2026-07-01T00:00:00.000Z",
      previousEditionId: null,
      sourceEditionIds: ["ons-edition"],
      changes: [],
    };
    const older = { ...base, id: "catalog-older-a1", asOf: "2026-07-02T12:00:00.000Z" };
    const newer = { ...base, id: "catalog-newer-b1", asOf: "2026-07-03T12:00:00.000Z" };
    const legacy = { ...base, id: "catalog-legacy-c1" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ editions: [older, newer, legacy], retention: 3 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    const route = await import("@/app/editions/page");
    const markup = renderToStaticMarkup(await route.default({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain("Source published 2026-07-01 · Archived 2026-07-03");
    expect(markup).toContain("Source published 2026-07-01 · Archived 2026-07-02");
    expect(markup).toContain("Archive date unavailable for this older edition");
    expect(markup.indexOf("Archived 2026-07-03")).toBeLessThan(markup.indexOf("Archived 2026-07-02"));
    expect(markup).toContain("Revision ledger");
    expect(markup).toContain("/data/editions.json");
    expect(markup).toContain("/data/edition.json?edition=");
  });
});

// Exercise the published-publication behavior independently of the production pause.
vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{ default: { publications: Record<string, { state: string }> } }>();
  return { default: { ...config, publications: { ...Object.fromEntries(Object.entries(config.publications).map(([id, entry]) => [id, { ...entry, state: "published" }])), ons: { state: "published" } } } };
});

describe("editions page", () => {
  it("renders at most 20 entries and a next link", async () => {
    vi.stubEnv("STATIC_EXPORT", "false");
    const editions = Array.from({ length: 25 }, (_, index) => ({
      id: `catalog-${String(index).padStart(2, "0")}`,
      publishedAt: "2026-07-01T00:00:00.000Z",
      previousEditionId: null,
      sourceEditionIds: ["ons-edition"],
      changes: [],
      asOf: new Date(Date.UTC(2026, 6, 1, 0, 0, 0) + index * 3_600_000).toISOString(),
    }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ editions, retention: 25 }), { status: 200, headers: { "content-type": "application/json" } })));
    const route = await import("@/app/editions/page");
    const first = renderToStaticMarkup(await route.default({ searchParams: Promise.resolve({}) }));
    expect(first.match(/Open as-of edition/g)).toHaveLength(20);
    expect(first).toMatch(/href="\/editions\/?\?page=2"/);
    expect(first).not.toContain("page=0");
    const second = renderToStaticMarkup(await route.default({ searchParams: Promise.resolve({ page: "2" }) }));
    expect(second.match(/Open as-of edition/g)).toHaveLength(5);
    expect(second).toMatch(/href="\/editions\/?"/);
    expect(second).not.toContain("page=3");
  });
});
