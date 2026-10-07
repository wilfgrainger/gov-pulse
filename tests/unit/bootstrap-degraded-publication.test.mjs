// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { bootstrapCloudflarePublication } from "../../scripts/bootstrap-cloudflare-publication.mjs";
import { FEED_REGISTRY_VERSION, REQUIRED_PUBLISHED_SECTION_IDS } from "../../worker/feed-registry.js";

const SHA = "c".repeat(40);

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function preparedSnapshot(missingSections = [], now = new Date()) {
  const fetchedAt = new Date(now.getTime() - 30_000).toISOString();
  const observedAt = new Date(now.getTime() - 60_000).toISOString();
  const validUntil = new Date(now.getTime() + 60 * 60_000).toISOString();
  const sources = {};
  const sections = {};
  for (const section of REQUIRED_PUBLISHED_SECTION_IDS) {
    if (missingSections.includes(section)) continue;
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
      registryVersion: FEED_REGISTRY_VERSION,
      sources,
      publicProjection: {
        state: "published",
        publishedSections: Object.keys(sources).sort(),
      },
    },
    ...sections,
  };
}

describe("Cloudflare deployment bootstrap with degraded evidence", () => {
  it("accepts a prepared degraded KV publication without waiting for every upstream", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: "degraded",
          ready: false,
          degraded: true,
          missingRequiredSections: ["nhsStats"],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          preparedSnapshot(["nhsStats"]),
          200,
          { "X-Publication-Delivery": "cloudflare-kv" }
        )
      );

    const result = await bootstrapCloudflarePublication({
      accountId: "account",
      apiToken: "token",
      deploymentId: SHA,
      fetchImpl,
    });

    expect(result).toMatchObject({
      triggered: false,
      attempts: 0,
      health: {
        status: "degraded",
        ready: false,
        degraded: true,
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
