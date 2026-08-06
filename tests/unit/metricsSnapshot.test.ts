// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchMetricsSnapshot,
  isCompatibleMetricsSnapshot,
  requestSnapshot,
  resetMetricsSnapshotCache,
} from "@/app/lib/metricsSnapshot";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

describe("metrics snapshot compatibility", () => {
  afterEach(() => {
    resetMetricsSnapshotCache();
    vi.unstubAllGlobals();
  });

  it("accepts only the current feed registry", () => {
    expect(
      isCompatibleMetricsSnapshot({
        meta: { registryVersion: FEED_REGISTRY_VERSION, sources: {} },
      })
    ).toBe(true);

    expect(
      isCompatibleMetricsSnapshot({
        meta: { registryVersion: "v10", sources: {} },
      })
    ).toBe(false);
  });

  it("does not request a production-only snapshot from a development server", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(fetchMetricsSnapshot()).rejects.toThrow(
      "No metrics snapshot is configured"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("releases an unsuccessful response body", async () => {
    const response = new Response("unavailable", { status: 503 });
    const cancelSpy = vi.spyOn(response.body!, "cancel");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(requestSnapshot("/data/metrics.json", "snapshot")).rejects.toThrow(
      "snapshot returned 503"
    );
    expect(cancelSpy).toHaveBeenCalledOnce();
  });
});
