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
    const markup = renderToStaticMarkup(await route.default());

    expect(markup).toContain("Source published 2026-07-01 · Archived 2026-07-03");
    expect(markup).toContain("Source published 2026-07-01 · Archived 2026-07-02");
    expect(markup).toContain("Archive date unavailable for this older edition");
    expect(markup.indexOf("Archived 2026-07-03")).toBeLessThan(markup.indexOf("Archived 2026-07-02"));
  });
});

// Exercise the enabled-publication behavior independently of the production pause.
vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{ default: { publications: Record<string, { enabled: boolean }> } }>();
  return { default: { ...config, publications: { ...Object.fromEntries(Object.entries(config.publications).map(([id, entry]) => [id, { ...entry, enabled: true }])), ons: { enabled: true } } } };
});
