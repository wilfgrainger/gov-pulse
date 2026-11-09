import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const connection = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("next/server", () => ({ connection }));

afterEach(() => {
  vi.unstubAllEnvs();
  connection.mockClear();
});

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

  // The Worker build prerenders only the fallback ID. If that render skips the
  // request-time API, Next.js classes the route as static and every real
  // edition ID then fails at runtime ("changed from static to dynamic").
  it("marks the route request-time in the Worker build, even for the fallback ID", async () => {
    vi.stubEnv("STATIC_EXPORT", "false");
    const route = await import("@/app/editions/[id]/page");
    await route.default({ params: Promise.resolve({ id: "_archive_unavailable" }) });

    expect(connection).toHaveBeenCalledOnce();
  });

  it("keeps the static export free of request-time APIs", async () => {
    vi.stubEnv("STATIC_EXPORT", "true");
    const route = await import("@/app/editions/[id]/page");
    await route.default({ params: Promise.resolve({ id: "_archive_unavailable" }) });

    expect(connection).not.toHaveBeenCalled();
  });
});

// Exercise the published-publication behavior independently of the production pause.
vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{ default: { publications: Record<string, { state: string }> } }>();
  return { default: { ...config, publications: { ...Object.fromEntries(Object.entries(config.publications).map(([id, entry]) => [id, { ...entry, state: "published" }])), ons: { state: "published" } } } };
});
