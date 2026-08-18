import { connection } from "next/server";
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

    // Prevent Next.js from resolving a time-sensitive evidence edition during
    // compilation. The live read belongs to the incoming request on the Worker.
    await connection();

    // Keep local development deterministic and offline-friendly. Request-time
    // production rendering is exercised by OpenNext/Cloudflare.
    if (process.env.NODE_ENV !== "production") return null;

    try {
      const loaded = await requestSnapshot(PRODUCTION_SNAPSHOT_URL, "snapshot");
      return loaded.payload;
    } catch {
      return null;
    }
  }
);
