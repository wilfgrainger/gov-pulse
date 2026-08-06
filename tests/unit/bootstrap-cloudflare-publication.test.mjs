// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  bootstrapAttemptId,
  bootstrapCloudflarePublication,
  positiveInteger,
} from "../../scripts/bootstrap-cloudflare-publication.mjs";

const SHA = "a".repeat(40);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Cloudflare deployment bootstrap", () => {
  it("skips Queue work when the prepared publication is already ready", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            meta: {
              delivery: "published-snapshot",
              publicationDiagnostics: {},
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Publication-Delivery": "cloudflare-kv",
            },
          }
        )
      );

    const result = await bootstrapCloudflarePublication({
      accountId: "account",
      apiToken: "token",
      deploymentId: SHA,
      fetchImpl,
    });

    expect(result.triggered).toBe(false);
    expect(result.attempts).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not skip when ready health is backed by migration delivery", async () => {
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            meta: {
              delivery: "published-snapshot",
              publicationDiagnostics: {},
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Publication-Delivery": "cloudflare-kv-migration",
            },
          }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: [{ queue_name: "public-data-jobs", queue_id: "queue-id" }],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }));

    const result = await bootstrapCloudflarePublication({
      accountId: "account",
      apiToken: "token",
      deploymentId: SHA,
      fetchImpl,
      timeoutMs: 60_000,
      pollIntervalMs: 10_000,
      nowImpl: () => now,
      sleepImpl: async (milliseconds) => {
        now += milliseconds;
      },
    });

    expect(result).toMatchObject({ triggered: true, attempts: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("pushes one bootstrap message and waits for readiness", async () => {
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "bootstrapping", ready: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: [{ queue_name: "public-data-jobs", queue_id: "queue-id" }],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ status: "bootstrapping", ready: false }))
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }));

    const result = await bootstrapCloudflarePublication({
      accountId: "account",
      apiToken: "token",
      deploymentId: SHA,
      fetchImpl,
      timeoutMs: 60_000,
      pollIntervalMs: 10_000,
      nowImpl: () => now,
      sleepImpl: async (milliseconds) => {
        now += milliseconds;
      },
    });

    expect(result.triggered).toBe(true);
    expect(result.attempts).toBe(1);
    const pushCall = fetchImpl.mock.calls[2];
    expect(pushCall[0]).toContain("/queues/queue-id/messages");
    expect(JSON.parse(pushCall[1].body)).toEqual({
      body: { type: "bootstrap-publication", deploymentId: SHA },
    });
  });

  it("starts a fresh recovery run when the first run remains bootstrapping", async () => {
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "bootstrapping", ready: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: [{ queue_name: "public-data-jobs", queue_id: "queue-id" }],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ status: "bootstrapping", ready: false }))
      .mockResolvedValueOnce(jsonResponse({ status: "bootstrapping", ready: false }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }));

    const result = await bootstrapCloudflarePublication({
      accountId: "account",
      apiToken: "token",
      deploymentId: SHA,
      fetchImpl,
      timeoutMs: 50_000,
      pollIntervalMs: 10_000,
      recoveryIntervalMs: 20_000,
      nowImpl: () => now,
      sleepImpl: async (milliseconds) => {
        now += milliseconds;
      },
    });

    const firstPush = JSON.parse(fetchImpl.mock.calls[2][1].body);
    const recoveryPush = JSON.parse(fetchImpl.mock.calls[5][1].body);
    expect(firstPush.body.deploymentId).toBe(SHA);
    expect(recoveryPush.body.deploymentId).toMatch(/^[0-9a-f]{40}$/);
    expect(recoveryPush.body.deploymentId).not.toBe(SHA);
    expect(result).toMatchObject({ triggered: true, attempts: 2 });
  });

  it("derives deterministic but distinct recovery identifiers", () => {
    expect(bootstrapAttemptId(SHA, 0)).toBe(SHA);
    expect(bootstrapAttemptId(SHA, 1)).toMatch(/^[0-9a-f]{40}$/);
    expect(bootstrapAttemptId(SHA, 1)).not.toBe(SHA);
    expect(bootstrapAttemptId(SHA, 1)).toBe(bootstrapAttemptId(SHA, 1));
  });

  it("fails closed when the reconciled Queue cannot be found", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "bootstrapping", ready: false }))
      .mockResolvedValueOnce(jsonResponse({ success: true, result: [] }));

    await expect(
      bootstrapCloudflarePublication({
        accountId: "account",
        apiToken: "token",
        deploymentId: SHA,
        fetchImpl,
      })
    ).rejects.toThrow("was not found after reconciliation");
  });

  it("rejects invalid timing configuration before calling Cloudflare", async () => {
    expect(() => positiveInteger("0", "timeout")).toThrow(
      "must be a positive integer"
    );
    expect(() => positiveInteger("not-a-number", "timeout")).toThrow(
      "must be a positive integer"
    );

    const fetchImpl = vi.fn();
    await expect(
      bootstrapCloudflarePublication({
        accountId: "account",
        apiToken: "token",
        deploymentId: SHA,
        timeoutMs: -1,
        fetchImpl,
      })
    ).rejects.toThrow("BOOTSTRAP_TIMEOUT_MS must be a positive integer");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
