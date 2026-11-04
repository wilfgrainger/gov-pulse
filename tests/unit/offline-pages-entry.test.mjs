import { describe, expect, it, vi } from "vitest";
import worker from "../../worker/offline-pages-entry.js";

describe("offline Pages worker", () => {
  it("serves the release marker from assets so deploys can prove the published revision", async () => {
    const marker = new Response('{"commitSha":"a","branch":"main"}');
    const ASSETS = { fetch: vi.fn().mockResolvedValue(marker) };
    const response = await worker.fetch(new Request("https://x.test/release.json?release=a"), { ASSETS });
    expect(ASSETS.fetch).toHaveBeenCalledOnce();
    expect(response).toBe(marker);
  });

  it("keeps every other path closed behind the offline notice", async () => {
    const ASSETS = { fetch: vi.fn() };
    const page = await worker.fetch(new Request("https://x.test/section/gdp"), { ASSETS });
    const data = await worker.fetch(new Request("https://x.test/data/sections/gdpTracker.json"), { ASSETS });
    expect(page.status).toBe(200);
    expect(data.status).toBe(503);
    expect(ASSETS.fetch).not.toHaveBeenCalled();
  });
});
