import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import definitions from "@/contracts/measure-definitions.json";

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

describe("editions list ledger cap", () => {
  function manyChanges(editionIndex: number, count: number) {
    return Array.from({ length: count }, (_, index) => ({
      measureId: definitions.measures[0].id, kind: "revision",
      observedAt: `2026-06-${String(28 - (index % 28)).padStart(2, "0")}`, period: `Period ${editionIndex}-${String(index).padStart(3, "0")}`,
      previousSourceEditionId: "ons-old-edition", nextSourceEditionId: "ons-edition",
      previousRevisionId: `revision-previous-${editionIndex}-${index}-${"p".repeat(380)}`, nextRevisionId: `revision-next-${editionIndex}-${index}-${"n".repeat(380)}`,
      previousSourcePublishedAt: "2026-05-16T07:00:00.000Z", nextSourcePublishedAt: "2026-06-02T07:00:00.000Z",
      previousSourceUrl: `https://www.ons.gov.uk/releases/previous/${"a".repeat(850)}`, nextSourceUrl: `https://www.ons.gov.uk/releases/current/${"b".repeat(850)}`,
      previousUnit: "%", nextUnit: "%", previous: 3.4, next: 3.2,
    }));
  }
  async function render(editions: unknown[], searchParams: Record<string, string> = {}) {
    vi.stubEnv("STATIC_EXPORT", "false");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ editions, retention: editions.length }), { status: 200, headers: { "content-type": "application/json" } })));
    const route = await import("@/app/editions/page");
    return renderToStaticMarkup(await route.default({ searchParams: Promise.resolve(searchParams) }));
  }
  const fixture = (editionCount: number, changeCount: number) => Array.from({ length: editionCount }, (_, index) => ({
    id: `catalog-${index}`, publishedAt: "2026-07-01T00:00:00.000Z", previousEditionId: null, sourceEditionIds: ["ons-edition"],
    changes: manyChanges(index, changeCount), asOf: new Date(Date.UTC(2026, 6, 1) + index * 3_600_000).toISOString(),
  }));

  it("caps each edition, discloses the cap and links to the full edition page", async () => {
    const { LEDGER_LIST_CHANGE_CAP: cap } = await import("@/app/components/RevisionLedger");
    const html = await render(fixture(2, 40));
    expect(html).toContain(`Showing the newest ${cap} of 40 changes`);
    expect(html).toMatch(new RegExp(`href="/editions/catalog-0"[^>]*>[^<]*all 40 changes`));
    expect(html).toContain("Period 0-000");
    expect(html).not.toContain(`Period 0-${String(cap).padStart(3, "0")}`);
  });

  it("never renders more than the cap of change items per edition", async () => {
    const { LEDGER_LIST_CHANGE_CAP: cap } = await import("@/app/components/RevisionLedger");
    const html = await render(fixture(3, 60));
    expect(html.match(/Publisher revision/g)).toHaveLength(3 * cap);
  });

  it("does not show a cap line when every change is shown", async () => {
    const html = await render(fixture(1, 2));
    expect(html).not.toContain("Showing the newest");
    expect(html.match(/Publisher revision/g)).toHaveLength(2);
  });

  it("keeps a realistic many-change page under 200,000 bytes", async () => {
    const editions = fixture(8, 33);
    // Sanity: at ~3.4 KB per change the uncapped ledger is the live ~890 KB problem.
    const { default: RevisionLedger } = await import("@/app/components/RevisionLedger");
    expect(Buffer.byteLength(renderToStaticMarkup(<RevisionLedger summaries={editions as never}/>))).toBeGreaterThan(800_000);
    const html = await render(editions);
    expect(Buffer.byteLength(html)).toBeLessThan(200_000);
  });

  it("keeps the edition detail page's ledger complete", async () => {
    vi.stubEnv("STATIC_EXPORT", "false");
    const src = (await import("node:fs")).readFileSync("app/editions/[id]/page.tsx", "utf8");
    expect(src).toContain("edition.summary.changes.map(");
    expect(src).not.toMatch(/changes\.slice\(/);
  });
});
