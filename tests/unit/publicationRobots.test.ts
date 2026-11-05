import { describe, expect, it, vi } from "vitest";

// Every publication is withheld in this module graph.
vi.mock("@/contracts/publication-policy", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, publicRouteAvailable: () => false, productRouteAvailable: () => true, publicationEnabled: () => false, publicationRouteEnabled: () => false, publicationPublished: () => false };
});
vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot: async () => null }));

describe("withheld routes", () => {
  it("withheld routes set robots noindex", async () => {
    const statics = await Promise.all([
      import("@/app/editions/page"), import("@/app/briefing/page"), import("@/app/compare/page"),
      import("@/app/explore/page"), import("@/app/measure/page"), import("@/app/calendar/page"),
      import("@/app/cost-of-living/page"), import("@/app/money/page"),
    ]);
    for (const page of statics) expect(page.metadata.robots).toMatchObject({ index: false });

    const editionId = await (await import("@/app/editions/[id]/page")).generateMetadata({ params: Promise.resolve({ id: "x" }) });
    expect(editionId.robots).toMatchObject({ index: false });
    const measureId = await (await import("@/app/measure/[id]/page")).generateMetadata({ params: Promise.resolve({ id: "gdp" }) });
    if (Object.keys(measureId).length) expect(measureId.robots).toMatchObject({ index: false });
    const story = await (await import("@/app/stories/[slug]/page")).generateMetadata({ params: Promise.resolve({ slug: "household-budgets" }) });
    expect(story.robots).toMatchObject({ index: false });
    const section = await (await import("@/app/section/[id]/page")).generateMetadata({ params: Promise.resolve({ id: "gdp" }) });
    expect(section.robots).toMatchObject({ index: false });
  });
});
