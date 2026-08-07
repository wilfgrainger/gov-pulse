import { cache } from "react";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import {
  isCompatibleMetricsSnapshot,
  requestSnapshot,
  type MetricsSnapshot,
} from "./metricsSnapshot";

const PRODUCTION_SNAPSHOT_URL =
  "https://public-data.org/data/metrics-snapshot.json";

export const readServerMetricsSnapshot = cache(
  async (): Promise<MetricsSnapshot | null> => {
    // Cloudflare Pages is retained only as the deterministic seed/fallback build.
    // It is not the production custom-domain renderer after the web Worker cutover.
    if (process.env.STATIC_EXPORT === "true") {
      return isCompatibleMetricsSnapshot(BUILD_METRICS_SNAPSHOT)
        ? BUILD_METRICS_SNAPSHOT
        : null;
    }

    try {
      const loaded = await requestSnapshot(PRODUCTION_SNAPSHOT_URL, "snapshot");
      return loaded.payload;
    } catch {
      return null;
    }
  }
);
