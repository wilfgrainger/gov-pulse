import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

afterEach(() => vi.unstubAllEnvs());

describe("historical edition route", () => {
  it("keeps a static fallback parameter for the Pages seed", async () => {
    vi.stubEnv("STATIC_EXPORT", "true");
    const route = await import("@/app/editions/[id]/page");

    expect(route.generateStaticParams()).toEqual([{ id: "_archive_unavailable" }]);
  });

  it("seeds the Worker build with the same fallback so dynamic IDs can render on demand", async () => {
    vi.stubEnv("STATIC_EXPORT", "false");
    const route = await import("@/app/editions/[id]/page");

    expect(route.generateStaticParams()).toEqual([{ id: "_archive_unavailable" }]);
  });

  it("does not force dynamic rendering, which static export cannot serve", async () => {
    const route = await import("@/app/editions/[id]/page");
    const config = route as unknown as Record<string, unknown>;

    expect(config.dynamic).not.toBe("force-dynamic");
  });

  it("renders the honest unavailable page for the reserved static fallback ID", async () => {
    vi.stubEnv("STATIC_EXPORT", "true");
    const route = await import("@/app/editions/[id]/page");
    const page = await route.default({ params: Promise.resolve({ id: "_archive_unavailable" }) });

    expect(renderToStaticMarkup(page)).toContain("Edition details unavailable");
  });
});
