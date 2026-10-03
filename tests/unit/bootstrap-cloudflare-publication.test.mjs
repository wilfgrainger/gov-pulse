// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  bootstrapAttemptId,
  bootstrapCloudflarePublication,
  hasPreparedPublication,
  positiveInteger,
} from "../../scripts/bootstrap-cloudflare-publication.mjs";
import { REQUIRED_PUBLISHED_SECTION_IDS } from "../../worker/feed-registry.js";

const SHA = "a".repeat(40);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function preparedSnapshot(now = new Date()) {
  const fetchedAt = new Date(now.getTime() - 30_000).toISOString();
  const observedAt = new Date(now.getTime() - 60_000).toISOString();
  const validUntil = new Date(now.getTime() + 60 * 60_000).toISOString();
  const sources = {};
  const sections = {};
  for (const section of REQUIRED_PUBLISHED_SECTION_IDS) {
    sources[section] = {
      status: "ok",
      cacheState: "fresh",
      fetchedAt,
      provenance: { section },
    };
    sections[section] = {
      expiresAt: validUntil,
      __observation: {
        status: "current",
        period: "Current test period",
        observedAt,
        maxAgeDays: 30,
      },
    };
    if (section === "sentimentPulse") {
      sections[section].__measureValidity = Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [id, { validUntil }]),
      );
      sections[section].series = Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [id, { status: "current", value: 1 }]),
      );
    }
  }
  return {
    meta: {
      delivery: "published-snapshot",
      registryVersion: "2026-08-02.1",
      generatedAt: now.toISOString(),
      publicationState: "ready",
      missingRequiredSections: [],
      sources,
    },
    ...sections,
  };
}

describe("Cloudflare deployment bootstrap", () => {
  it("does not accept an empty ready artifact as a prepared publication", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      meta: {
        delivery: "published-snapshot",
        publicationState: "ready",
        missingRequiredSections: [],
        sources: {},
      },
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Publication-Delivery": "cloudflare-kv",
      },
    }));

    await expect(hasPreparedPublication(
      fetchImpl,
      "https://public-data.org/data/health.json",
      { status: "ready", ready: true },
    )).resolves.toBe(false);
  });

  it("rejects a prepared publication that exposes private catalog diagnostics", async () => {
    const leaked = preparedSnapshot();
    leaked.meta.measureCatalogDiagnostics = [{ measureId: "bankRate", reason: "expired-value" }];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }))
      .mockResolvedValueOnce(new Response(JSON.stringify(leaked), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Publication-Delivery": "cloudflare-kv" },
      }));

    await expect(hasPreparedPublication(
      fetchImpl,
      "https://public-data.org/data/health.json",
      { status: "ready", ready: true },
    )).resolves.toBe(false);
  });

  it("skips Queue work when the prepared publication is already ready", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(preparedSnapshot()),
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

  it("forces a new run and waits for its finalisation even when an old snapshot is ready", async () => {
    let now = 0;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true, result: [{ queue_name: "public-data-jobs", queue_id: "queue-id" }] }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ status: "running", finalisedAt: null }))
      .mockResolvedValueOnce(jsonResponse({ status: "published", finalisedAt: "2026-09-28T09:00:00.000Z" }))
      .mockResolvedValueOnce(jsonResponse({ status: "ready", ready: true }))
      .mockResolvedValueOnce(new Response(JSON.stringify(preparedSnapshot()), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Publication-Delivery": "cloudflare-kv" },
      }));

    const result = await bootstrapCloudflarePublication({
      accountId: "account", apiToken: "token", deploymentId: SHA,
      forceRefresh: true, fetchImpl, timeoutMs: 60_000,
      pollIntervalMs: 10_000, nowImpl: () => now,
      sleepImpl: async (milliseconds) => { now += milliseconds; },
    });

    expect(result).toMatchObject({ triggered: true, attempts: 1, health: { ready: true } });
    expect(fetchImpl.mock.calls[2][0]).toContain("/queues/queue-id/messages");
    expect(fetchImpl.mock.calls[3][0]).toContain(`v13%3Apublication%3Arun%3Abootstrap-${SHA}`);
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
              publicationState: "ready",
              missingRequiredSections: [],
              sources: {},
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

  it("accepts the first finalised run before dispatching its scheduled recovery", async () => {
    let now = 0;
    let pushes = 0;
    const fetchImpl = vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/data/health.json")) {
        return jsonResponse({ status: "ready", ready: true });
      }
      if (url.includes("/queues?per_page=")) {
        return jsonResponse({
          success: true,
          result: [{ queue_name: "public-data-jobs", queue_id: "queue-id" }],
        });
      }
      if (url.includes("/queues/queue-id/messages")) {
        pushes += 1;
        return jsonResponse({ success: true });
      }
      if (url.includes(encodeURIComponent(`v13:publication:run:bootstrap-${SHA}`))) {
        const finalised = now >= 20_000;
        return jsonResponse({
          status: finalised ? "incomplete" : "running",
          finalisedAt: finalised ? "2026-10-02T00:00:20.000Z" : null,
        });
      }
      if (url.endsWith("/data/metrics-snapshot.json")) {
        return new Response(JSON.stringify(preparedSnapshot()), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Publication-Delivery": "cloudflare-kv",
          },
        });
      }
      return jsonResponse({ status: "running", finalisedAt: null });
    });

    const result = await bootstrapCloudflarePublication({
      accountId: "account",
      apiToken: "token",
      deploymentId: SHA,
      forceRefresh: true,
      fetchImpl,
      timeoutMs: 30_000,
      pollIntervalMs: 10_000,
      recoveryIntervalMs: 20_000,
      nowImpl: () => now,
      sleepImpl: async (milliseconds) => { now += milliseconds; },
    });

    expect(result).toMatchObject({ triggered: true, attempts: 1 });
    expect(pushes).toBe(1);
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
