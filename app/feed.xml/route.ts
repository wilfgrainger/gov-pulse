import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import { renderRssFeed } from "@/app/lib/rssFeed";

export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
  return new Response(renderRssFeed(BUILD_METRICS_SNAPSHOT), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
