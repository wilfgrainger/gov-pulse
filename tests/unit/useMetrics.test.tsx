import { act, renderHook, waitFor } from "@testing-library/react";
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
  series: {
    inflation: { status: "current", value: 3.1 },
    bankRate: { status: "current", value: 4 },
    unemployment: { status: "current", value: 5 },
  },
};

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

function snapshotWith(data = completeLivePayload, fetchedAt = minutesAgo(5), deadline: string | Record<string, string> = new Date(Date.now() + 60_000).toISOString()) {
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
      __measureValidity: Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [
          id,
          { validUntil: typeof deadline === "string" ? deadline : deadline[id] },
        ])
      ),
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
    vi.useRealTimers();
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

  it("accepts populated nullable scalar fields while still rejecting object-shaped values", async () => {
    const { acceptsCompleteLivePayload } = await loadUseMetrics();
    const nullableFallback = { latestPublicationDate: null };

    expect(acceptsCompleteLivePayload(nullableFallback, { latestPublicationDate: "2026-09-29" })).toBe(true);
    expect(acceptsCompleteLivePayload(nullableFallback, { latestPublicationDate: { year: 2026 } })).toBe(false);
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

  it("keeps the request-time render deterministic for hydration, then rejects expired evidence on the browser clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:02:00.000Z"));
    const publication = snapshotWith(
      completeLivePayload,
      "2026-07-14T12:00:00.000Z",
      "2026-07-14T12:01:00.000Z",
    );
    publication.meta.generatedAt = "2026-07-14T12:00:00.000Z";
    const { currentMetricsResultFromSnapshot, metricsResultFromSnapshot } = await loadUseMetrics();

    expect(metricsResultFromSnapshot(publication, "sentimentPulse", fallback, 40 * 24 * 60 * 60 * 1000)?.isLive).toBe(true);
    expect(currentMetricsResultFromSnapshot(publication, "sentimentPulse", fallback, 40 * 24 * 60 * 60 * 1000)).toBeNull();
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

  it("clears a browser result at its exact publication expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
    const expiresAt = new Date(Date.now() + 2_000).toISOString();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("snapshot unavailable")));
    const { useMetrics } = await loadUseMetrics("production", snapshotWith(completeLivePayload, minutesAgo(5), expiresAt));
    const { result } = renderHook(() => useMetrics("sentimentPulse", fallback));

    expect(result.current.isLive).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(result.current.isLive).toBe(false);
    expect(result.current.source).toBe("fallback");
  });

  it("redacts an expired indicator at its deadline while keeping other current indicators", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
    const near = new Date(Date.now() + 2_000).toISOString();
    const later = new Date(Date.now() + 20_000).toISOString();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("snapshot unavailable")));
    const { useMetrics } = await loadUseMetrics("production", snapshotWith(completeLivePayload, minutesAgo(5), {
      inflation: later,
      bankRate: near,
      unemployment: later,
    }));
    const { result } = renderHook(() => useMetrics("sentimentPulse", fallback));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(result.current.isLive).toBe(true);
    expect(result.current.data.series.bankRate).toMatchObject({ value: null, status: "expired" });
    expect(result.current.data.series.inflation.value).toBe(3.1);
  });
});
