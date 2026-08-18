import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fallback = {
  economicData: [{ date: "Fallback", inflation: 1, bankRate: 1, unemployment: 1 }],
  metricConfig: {
    inflation: { label: "CPI INFLATION", unit: "%", color: "#FF3B00", current: "1%", target: "target" },
    bankRate: { label: "BANK OF ENGLAND RATE", unit: "%", color: "#000000", current: "1%", target: "target" },
    unemployment: { label: "UNEMPLOYMENT RATE", unit: "%", color: "#666666", current: "1%", target: "target" },
  },
};

const completeLivePayload = {
  economicData: [{ date: "Worker", inflation: 3.1, bankRate: 4, unemployment: 5 }],
  metricConfig: {
    inflation: { label: "CPI INFLATION", unit: "%", color: "#FF3B00", current: "3.1%", target: "2.0% target" },
    bankRate: { label: "BANK OF ENGLAND RATE", unit: "%", color: "#000000", current: "4.0%", target: "Monetary policy" },
    unemployment: { label: "UNEMPLOYMENT RATE", unit: "%", color: "#666666", current: "5.0%", target: "ONS LFS" },
  },
};

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

function snapshotWith(data = completeLivePayload, fetchedAt = minutesAgo(5)) {
  return {
    meta: {
      registryVersion: "2026-08-02.1",
      generatedAt: minutesAgo(1),
      sources: {
        sentimentPulse: { status: "ok", cacheState: "fresh", fetchedAt },
      },
    },
    sentimentPulse: {
      ...data,
      __observation: {
        status: "current",
        period: "Current test period",
        observedAt: minutesAgo(60),
        maxAgeDays: 40,
      },
    },
  };
}

async function loadUseMetrics(
  nodeEnv: "development" | "production" = "development",
  initialSnapshot: unknown = null
) {
  vi.resetModules();
  vi.doMock("@/app/lib/MetricsSnapshotProvider", () => ({
    useInitialMetricsSnapshot: () => initialSnapshot,
  }));
  vi.stubEnv("NODE_ENV", nodeEnv);
  return import("@/app/lib/useMetrics");
}

describe("useMetrics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.doUnmock("@/app/lib/MetricsSnapshotProvider");
  });

  it("normalizes cache state against the source-specific publication window", async () => {
    const { normalizeCacheState } = await loadUseMetrics();
    const now = Date.parse("2026-07-11T00:00:00Z");
    const monthlyWindow = 40 * 24 * 60 * 60 * 1000;
    expect(normalizeCacheState("2026-07-01T00:00:00Z", "expired", monthlyWindow, now)).toBe("fresh");
    expect(normalizeCacheState("2026-05-22T00:00:00Z", "fresh", monthlyWindow, now)).toBe("stale");
    expect(normalizeCacheState("2026-03-01T00:00:00Z", "fresh", monthlyWindow, now)).toBe("expired");
    expect(normalizeCacheState("2026-07-01T00:00:00Z", "missing", monthlyWindow, now)).toBe("missing");
  });

  it("accepts only live payloads that satisfy the complete fallback shape", async () => {
    const { acceptsCompleteLivePayload } = await loadUseMetrics();
    expect(acceptsCompleteLivePayload(fallback, completeLivePayload)).toBe(true);
    expect(acceptsCompleteLivePayload(fallback, { economicData: completeLivePayload.economicData })).toBe(false);
    expect(acceptsCompleteLivePayload(fallback, {
      ...completeLivePayload,
      metricConfig: { ...completeLivePayload.metricConfig, inflation: { current: "3.1%" } },
    })).toBe(false);
    expect(acceptsCompleteLivePayload(fallback, {
      ...completeLivePayload,
      economicData: [{ date: "Worker" }],
    })).toBe(false);
  });

  it("derives a sourced result from a publication snapshot", async () => {
    const { metricsResultFromSnapshot } = await loadUseMetrics();
    const result = metricsResultFromSnapshot(
      snapshotWith(), "sentimentPulse", fallback, 40 * 24 * 60 * 60 * 1000
    );
    expect(result?.source).toBe("snapshot");
    expect(result?.isLive).toBe(true);
    expect(result?.cacheState).toBe("fresh");
    expect(result?.observationStatus).toBe("current");
    expect(result?.data.economicData[0].date).toBe("Worker");
  });

  it("renders the request-time snapshot immediately and retains it when browser refresh fails", async () => {
    const serverPayload = {
      ...completeLivePayload,
      economicData: [{ date: "Server", inflation: 3, bankRate: 4, unemployment: 5 }],
    };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("snapshot unavailable")));
    const { useMetrics } = await loadUseMetrics("production", snapshotWith(serverPayload));
    const { result } = renderHook(() => useMetrics("sentimentPulse", fallback));
    expect(result.current.source).toBe("snapshot");
    expect(result.current.data.economicData[0].date).toBe("Server");
    await waitFor(() => {
      expect(result.current.source).toBe("snapshot");
      expect(result.current.data.economicData[0].date).toBe("Server");
    });
  });

  it("replaces request-time evidence with a newer valid same-origin snapshot", async () => {
    const serverPayload = {
      ...completeLivePayload,
      economicData: [{ date: "Server", inflation: 3, bankRate: 4, unemployment: 5 }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => snapshotWith() }));
    const { useMetrics } = await loadUseMetrics("production", snapshotWith(serverPayload, minutesAgo(10)));
    const { result } = renderHook(() => useMetrics("sentimentPulse", fallback));
    expect(result.current.data.economicData[0].date).toBe("Server");
    await waitFor(() => expect(result.current.data.economicData[0].date).toBe("Worker"));
  });

  it("uses the contract-checked same-origin snapshot in production", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => snapshotWith() }));
    const { useMetrics } = await loadUseMetrics("production");
    const { result } = renderHook(() => useMetrics("sentimentPulse", fallback));
    await waitFor(() => expect(result.current.source).toBe("snapshot"));
    expect(result.current.isLive).toBe(true);
    expect(result.current.observationStatus).toBe("current");
    expect(result.current.data.economicData[0].date).toBe("Worker");
  });

  it("fails closed when no server or runtime snapshot is available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("snapshot unavailable")));
    const { useMetrics } = await loadUseMetrics("production");
    const { result } = renderHook(() => useMetrics("sentimentPulse", fallback));
    await waitFor(() => expect(result.current.source).toBe("fallback"));
    expect(result.current.isLive).toBe(false);
    expect(result.current.data).toEqual(fallback);
  });
});
