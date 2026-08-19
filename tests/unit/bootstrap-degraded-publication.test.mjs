// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { bootstrapCloudflarePublication } from "../../scripts/bootstrap-cloudflare-publication.mjs";

const SHA = "c".repeat(40);

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
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
          {
            meta: {
              delivery: "published-snapshot",
              publicationState: "degraded",
              missingRequiredSections: ["nhsStats"],
              publicationDiagnostics: {},
            },
          },
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
