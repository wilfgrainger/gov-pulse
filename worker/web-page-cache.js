// Short-lived cache in front of the OpenNext handler. Rendering an evidence page
// costs 35-425 ms of CPU (measured 10 November 2026) against the 10 ms free-plan
// limit, so a burst of requests gets Error 1102. Repeat requests within the
// lifetime are served without rendering.
//
// shortcut: this only spares repeat requests per Cloudflare location; the first
// render after each expiry can still exceed the CPU limit. Upgrade to the
// static-first delivery plan (gate G9) to remove per-visitor rendering.

// Within the 300 s cap on evidence-bearing responses (plan Global Constraints).
const PAGE_CACHE_SECONDS = 300;
const PAGE_TYPES = ["text/html", "text/x-component"];

function cacheKey(request, version) {
  const url = new URL(request.url);
  // Navigation payloads share the page URL; their router state decides the body.
  const variant = request.headers.get("rsc")
    ? `rsc:${request.headers.get("next-router-state-tree") ?? ""}:${request.headers.get("next-router-prefetch") ?? ""}`
    : "html";
  url.searchParams.set("__page_cache", `${version}:${variant}`);
  return new Request(url.toString(), { method: "GET" });
}

function storable(response) {
  const type = response.headers.get("content-type") ?? "";
  return (
    response.status === 200 &&
    PAGE_TYPES.some((prefix) => type.startsWith(prefix)) &&
    !response.headers.has("set-cookie")
  );
}

/**
 * Wrap a Worker handler. The stored copy keeps the page's own Cache-Control in
 * a side header and restores it on a hit, so readers never see the internal lifetime.
 */
function withPageCache(handler, openCache = async () => caches.default) {
  return {
    ...handler,
    async fetch(request, env, ctx) {
      const version = env?.CF_VERSION_METADATA?.id;
      const path = new URL(request.url).pathname;
      if (request.method !== "GET" || !version || path.startsWith("/_next/")) {
        return handler.fetch(request, env, ctx);
      }
      let cache = null;
      let key = null;
      try {
        cache = await openCache();
        key = cacheKey(request, version);
        const hit = await cache.match(key);
        if (hit) {
          const headers = new Headers(hit.headers);
          const original = headers.get("x-page-cache-control");
          headers.delete("x-page-cache-control");
          if (original === null) headers.delete("cache-control");
          else headers.set("cache-control", original);
          return new Response(hit.body, { status: hit.status, headers });
        }
      } catch {
        cache = null; // The cache is an optimisation; render as usual without it.
      }
      const response = await handler.fetch(request, env, ctx);
      if (cache && storable(response)) {
        const headers = new Headers(response.headers);
        const original = headers.get("cache-control");
        if (original !== null) headers.set("x-page-cache-control", original);
        headers.set("cache-control", `public, s-maxage=${PAGE_CACHE_SECONDS}`);
        const copy = new Response(response.clone().body, { status: 200, headers });
        ctx.waitUntil(cache.put(key, copy).catch(() => {}));
      }
      return response;
    },
  };
}

export { PAGE_CACHE_SECONDS, withPageCache };
