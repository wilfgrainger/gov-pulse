import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { publicRouteAvailable } from "@/contracts/publication-policy";

describe("sitemap", () => {
  it("sitemap omits feed URLs and unavailable routes", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths.some((p) => /feed|\.xml$/.test(p))).toBe(false);
    for (const p of paths) expect(publicRouteAvailable(p), p).toBe(true);
    for (const p of ["/calendar/", "/money/"]) expect(paths.includes(p)).toBe(publicRouteAvailable(p));
  });
});
