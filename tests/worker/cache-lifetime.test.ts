// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_PUBLIC_CACHE_LIFETIME_SECONDS, cacheLifetimeSeconds } from "@/scripts/lib/cache-lifetime.mjs";
import { cacheControlFor } from "@/worker/public-data-entry";

const NOW = new Date("2026-11-10T08:00:00.000Z");
const validFor = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();

describe("cache lifetime", () => {
  it("adds the freshest max-age to both stale windows", () => {
    expect(cacheLifetimeSeconds("public, max-age=300, s-maxage=300, stale-while-revalidate=110871")).toBe(111171);
    expect(cacheLifetimeSeconds("s-maxage=31536000, stale-while-revalidate=2592000")).toBe(34128000);
    expect(cacheLifetimeSeconds("public, max-age=60, stale-if-error=30")).toBe(90);
    expect(cacheLifetimeSeconds("private, no-cache, no-store, max-age=0, must-revalidate")).toBe(0);
    expect(cacheLifetimeSeconds("public, max-age=0, must-revalidate, no-transform")).toBe(0);
    expect(cacheLifetimeSeconds(null)).toBe(0);
    expect(cacheLifetimeSeconds("public, max-age=soon")).toBe(Infinity);
  });

  it.each([10, 300, 86_400])("snapshot total lifetime never exceeds 300 s with %i s of validity left", (seconds) => {
    const header = cacheControlFor(validFor(seconds), NOW);
    expect(cacheLifetimeSeconds(header)).toBeLessThanOrEqual(MAX_PUBLIC_CACHE_LIFETIME_SECONDS);
    expect(cacheLifetimeSeconds(header)).toBe(Math.min(seconds, 300));
  });

  it("expired snapshot is no-store", () => {
    expect(cacheControlFor(validFor(0), NOW)).toBe("no-store");
    expect(cacheControlFor(validFor(-60), NOW)).toBe("no-store");
  });

  it("feed.xml lifetime is at most 300 s", () => {
    const route = readFileSync(resolve(__dirname, "../../app/feed.xml/route.ts"), "utf8");
    const header = /"cache-control":\s*"([^"]+)"/.exec(route)?.[1];
    expect(header).toBeTruthy();
    expect(cacheLifetimeSeconds(header)).toBeLessThanOrEqual(MAX_PUBLIC_CACHE_LIFETIME_SECONDS);
  });
});
