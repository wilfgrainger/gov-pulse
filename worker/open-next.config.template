import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// public-data.org does not use ISR as a source of truth. Dynamic evidence is
// read on each request from the exact same-origin data route. This read-only
// cache is only for Next.js prerendered/static artifacts and needs no R2, D1 or
// Durable Object binding on the Cloudflare Free plan.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
