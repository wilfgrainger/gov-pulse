import { connection } from "next/server";
import { cache } from "react";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import { publicSnapshot } from "@/worker/public-snapshot";
import { filterCurrentSnapshot, filterPublicationSnapshot } from "@/contracts/evidence-policy";
import { anyEvidencePublished } from "@/contracts/publication-policy";
import {
  isCompatibleMetricsSnapshot,
  requestSnapshot,
  type MetricsSnapshot,
} from "./metricsSnapshot";

const PRODUCTION_SNAPSHOT_URL =
  "https://public-data.org/data/metrics-snapshot.json";

// Build-time evidence is trusted only while it is still valid: expired or null
// build evidence yields no snapshot rather than a stale one.
export function currentBuildSnapshot(raw: unknown, now: Date = new Date()): MetricsSnapshot | null {
  const current = filterCurrentSnapshot(publicSnapshot(raw), now);
  const snapshot = current ? filterPublicationSnapshot(current) : null;
  return isCompatibleMetricsSnapshot(snapshot) ? snapshot : null;
}

function publishableSnapshot(raw: unknown): MetricsSnapshot | null {
  const snapshot = filterPublicationSnapshot(publicSnapshot(raw));
  return isCompatibleMetricsSnapshot(snapshot) ? snapshot : null;
}

export const readServerMetricsSnapshot = cache(
  async (): Promise<MetricsSnapshot | null> => {
    if (!anyEvidencePublished()) return null;
    // Cloudflare Pages is retained only as the deterministic seed/fallback build.
    // It is not the production custom-domain renderer after the web Worker cutover.
    if (process.env.STATIC_EXPORT === "true") {
      return currentBuildSnapshot(BUILD_METRICS_SNAPSHOT);
    }

    // Prevent Next.js from resolving a time-sensitive evidence edition during
    // compilation. The live read belongs to the incoming request on the Worker.
    await connection();

    // Keep local development deterministic and offline-friendly. Request-time
    // production rendering is exercised by OpenNext/Cloudflare.
    // The sanitized fixture is labelled `meta.fixture` and is never bundled
    // into production output.
    if (process.env.NODE_ENV !== "production") {
      const { default: fixture } = await import("@/tests/fixtures/publication/current-snapshot.json");
      return publishableSnapshot(structuredClone(fixture));
    }

    try {
      const loaded = await requestSnapshot(PRODUCTION_SNAPSHOT_URL, "snapshot");
      return publishableSnapshot(loaded.payload);
    } catch {
      return null;
    }
  }
);
