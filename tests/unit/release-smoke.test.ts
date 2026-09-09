// @vitest-environment node
import { expect, it, vi } from "vitest";
import { releaseSmoke } from "@/scripts/release-smoke.mjs";
const revision = "a".repeat(40);
const html = `<meta name="public-data-revision" content="${revision}">`;
it("accepts deployed code when evidence is explicitly degraded", async () => {
  const log = { info: vi.fn(), warn: vi.fn() };
  await releaseSmoke({
    url: "https://public-data.org/",
    revision,
    log,
    fetchImpl: async (url: URL) =>
      new Response(
        url.pathname.endsWith("health.json") ? '{"ready":false}' : html,
      ),
  });
  expect(log.warn).toHaveBeenCalledOnce();
});
it("rejects a wrong revision with a bounded retry count", async () => {
  const fetchImpl = vi.fn(async () => new Response("old revision"));
  await expect(
    releaseSmoke({
      url: "https://public-data.org/",
      revision,
      fetchImpl,
      delay: async () => {},
    }),
  ).rejects.toThrow("expected revision");
  expect(fetchImpl).toHaveBeenCalledTimes(6);
});
it("does not accept a failed reader route", async () => {
  await expect(
    releaseSmoke({
      url: "https://public-data.org/",
      revision,
      attempts: 1,
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
    }),
  ).rejects.toThrow("503");
});
it("rejects a broken health endpoint rather than treating it as degraded evidence", async () => {
  await expect(
    releaseSmoke({
      url: "https://public-data.org/",
      revision,
      attempts: 1,
      fetchImpl: async (url: URL) =>
        url.pathname.endsWith("health.json")
          ? new Response("not found", { status: 404 })
          : new Response(html),
    }),
  ).rejects.toThrow("404");
});
it("requires the revision on the revision meta tag itself", async () => {
  await expect(
    releaseSmoke({
      url: "https://public-data.org/",
      revision,
      attempts: 1,
      fetchImpl: async () =>
        new Response(
          `<meta name="public-data-revision" content="old"><meta name="other" content="${revision}">`,
        ),
    }),
  ).rejects.toThrow("expected revision");
});
