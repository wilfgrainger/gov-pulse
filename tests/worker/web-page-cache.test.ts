// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PAGE_CACHE_SECONDS, withPageCache } from "@/worker/web-page-cache";

function setup(respond: () => Response) {
  const store = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (request: Request) => store.get(request.url)?.clone()),
    put: vi.fn(async (request: Request, response: Response) => void store.set(request.url, response)),
  };
  const handler = { fetch: vi.fn(async () => respond()) };
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };
  const env = { CF_VERSION_METADATA: { id: "v1" } };
  const worker = withPageCache(handler, async () => cache);
  const get = async (url: string, init: RequestInit = {}, envOverride = env) => {
    const response = await worker.fetch(new Request(url, init), envOverride, ctx);
    await Promise.all(pending.splice(0));
    return response;
  };
  return { cache, handler, get, store };
}

const html = (headers: Record<string, string> = {}) =>
  new Response("<p>page</p>", { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", ...headers } });

describe("web page cache", () => {
  it("renders a page once and serves repeat requests from the cache with the original headers", async () => {
    const { handler, get } = setup(() => html());
    const first = await get("https://public-data.org/explore/");
    const second = await get("https://public-data.org/explore/");
    expect(handler.fetch).toHaveBeenCalledTimes(1);
    expect(await second.text()).toBe("<p>page</p>");
    // Readers and downstream caches still see the page's own policy, never the internal lifetime.
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    expect(second.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps an internal copy for at most 300 seconds", async () => {
    const { get, store } = setup(() => html());
    await get("https://public-data.org/explore/");
    expect(PAGE_CACHE_SECONDS).toBeLessThanOrEqual(300);
    expect([...store.values()][0].headers.get("cache-control")).toBe(`public, s-maxage=${PAGE_CACHE_SECONDS}`);
  });

  it("separates deployments, and HTML from navigation payloads", async () => {
    const { handler, get } = setup(() => html());
    await get("https://public-data.org/explore/");
    await get("https://public-data.org/explore/", {}, { CF_VERSION_METADATA: { id: "v2" } });
    await get("https://public-data.org/explore/", { headers: { rsc: "1", "next-router-state-tree": "abc" } });
    await get("https://public-data.org/explore/", { headers: { rsc: "1", "next-router-state-tree": "abc" } });
    expect(handler.fetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["an error", () => new Response("no", { status: 503, headers: { "content-type": "text/html" } })],
    ["a response that sets a cookie", () => html({ "set-cookie": "a=b" })],
    ["a non-page response", () => new Response("{}", { headers: { "content-type": "application/json" } })],
  ])("never stores %s", async (_name, respond) => {
    const { handler, get, cache } = setup(respond);
    await get("https://public-data.org/explore/");
    await get("https://public-data.org/explore/");
    expect(handler.fetch).toHaveBeenCalledTimes(2);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("passes writes, static assets and unversioned deployments straight through", async () => {
    const { handler, get, cache } = setup(() => html());
    await get("https://public-data.org/explore/", { method: "POST" });
    await get("https://public-data.org/_next/static/chunk.js");
    await get("https://public-data.org/explore/", {}, {} as never);
    expect(handler.fetch).toHaveBeenCalledTimes(3);
    expect(cache.match).not.toHaveBeenCalled();
  });

  it("still serves the page when the cache itself fails", async () => {
    const handler = { fetch: vi.fn(async () => html()) };
    const worker = withPageCache(handler, async () => { throw new Error("cache down"); });
    const response = await worker.fetch(new Request("https://public-data.org/explore/"), { CF_VERSION_METADATA: { id: "v1" } }, { waitUntil() {} });
    expect(response.status).toBe(200);
  });
});
