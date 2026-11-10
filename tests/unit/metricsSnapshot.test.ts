// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCompatibleMetricsSnapshot,
  requestSnapshot,
} from "@/app/lib/metricsSnapshot";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

describe("metrics snapshot compatibility", () => {
  afterEach(() => {
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
