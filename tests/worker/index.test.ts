// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import worker, {
  normalizeBettingOddsPayload,
  refreshAuthorized,
} from "@/worker/index";

describe("worker contracts", () => {
  const ctx = { waitUntil: vi.fn() };

  it("rejects incomplete betting odds payloads", () => {
    expect(() =>
      normalizeBettingOddsPayload({
        nextPmOdds: [],
        mostSeats: [],
        yearOdds: [],
      })
    ).toThrow(/incomplete/i);
  });

  it("authorizes refresh requests by header or query secret", () => {
    const env = { REFRESH_SECRET: "secret" };

    expect(
      refreshAuthorized(
        new Request("https://example.com/refresh", {
          headers: { "X-Refresh-Secret": "secret" },
        }),
        env
      )
    ).toBe(true);

    expect(
      refreshAuthorized(
        new Request("https://example.com/refresh?secret=secret"),
        env
      )
    ).toBe(true);
  });

  it("rejects /refresh without a secret", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/refresh", { method: "POST" }),
      { REFRESH_SECRET: "secret" },
      ctx
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Refresh secret required",
    });
  });

  it("returns a 400 for /metrics without a section", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/metrics"),
      {},
      ctx
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Missing ?section= parameter",
    });
  });

  it("returns a 404 for /metrics unknown section", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/metrics?section=unknown"),
      {},
      ctx
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unknown section 'unknown'",
    });
  });

  it("requires POST for /ingest", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/ingest", {
        method: "GET",
        headers: { "X-Refresh-Secret": "secret" },
      }),
      { REFRESH_SECRET: "secret" },
      ctx
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: "Use POST for /ingest",
    });
  });

  it("rejects ingest for non-ingest sections", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/ingest", {
        method: "POST",
        headers: { "X-Refresh-Secret": "secret", "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "sentimentPulse",
          data: { value: 1 },
        }),
      }),
      { REFRESH_SECRET: "secret" },
      ctx
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Section 'sentimentPulse' does not support ingest",
    });
  });

  it("rejects malformed betting odds ingest snapshots", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/ingest", {
        method: "POST",
        headers: { "X-Refresh-Secret": "secret", "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "bettingOdds",
          data: {
            nextPmOdds: [],
            mostSeats: [],
            yearOdds: [],
          },
        }),
      }),
      { REFRESH_SECRET: "secret" },
      ctx
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Ingest failed",
    });
  });
});
