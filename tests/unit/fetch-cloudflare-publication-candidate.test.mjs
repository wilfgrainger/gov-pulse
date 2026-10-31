import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fetchCandidate,
  publicCandidate,
  validateCandidate,
} from "../../scripts/fetch-cloudflare-publication-candidate.mjs";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../../worker/feed-registry.js";

const NOW = new Date("2026-08-02T09:00:00.000Z");
const FETCHED_AT = "2026-08-02T08:00:00.000Z";

function completeSnapshot() {
  const sections = Object.fromEntries(
    REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
      section,
      section === "sentimentPulse"
        ? {
            value: section,
            series: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
              id,
              { id, status: "current", value: 1 },
            ])),
            __measureValidity: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
              id,
              { validUntil: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() },
            ])),
          }
        : { value: section },
    ])
  );
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: FETCHED_AT,
      publicationMode: "queue-free-tier",
      freeTierBudget: { reads: 1 },
      sources: Object.fromEntries(
        REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
          section,
          {
            status: "ok",
            cacheState: "fresh",
            fetchedAt: FETCHED_AT,
          },
        ])
      ),
    },
    ...sections,
  };
}

describe("Cloudflare Pages publication candidate", () => {
  it("accepts only a current complete required publication", () => {
    const candidate = validateCandidate(completeSnapshot(), NOW);

    expect(Object.keys(candidate.meta.sources).sort()).toEqual(
      [...REQUIRED_PUBLISHED_SECTION_IDS].sort()
    );
    expect(
      REQUIRED_PUBLISHED_SECTION_IDS.every((section) =>
        Object.prototype.hasOwnProperty.call(candidate, section)
      )
    ).toBe(true);
  });

  it("rejects a candidate when filtering removes one required section", () => {
    const candidate = completeSnapshot();
    candidate.meta.sources.sentimentPulse.fetchedAt =
      "2026-07-31T20:59:59.000Z";
    for (const measure of Object.values(candidate.sentimentPulse.__measureValidity)) {
      measure.validUntil = "2026-08-01T00:00:00.000Z";
    }

    expect(() => validateCandidate(candidate, NOW)).toThrow(
      /missing current required evidence: sentimentPulse/i
    );
  });

  it("sanitises deployment-only metadata after the completeness gate", () => {
    const candidate = publicCandidate(completeSnapshot(), NOW);

    expect(candidate.meta).not.toHaveProperty("publicationMode");
    expect(candidate.meta).not.toHaveProperty("freeTierBudget");
    expect(Object.keys(candidate.meta.sources)).toHaveLength(
      REQUIRED_PUBLISHED_SECTION_IDS.length
    );
  });

  it("fetches the public prepared edition without a Cloudflare API credential", async () => {
    const directory = await mkdtemp(join(tmpdir(), "publication-candidate-"));
    const output = join(directory, "snapshot.json");
    let request;
    try {
      const result = await fetchCandidate({
        output,
        now: NOW,
        fetchImpl: async (url, options) => {
          request = { url, options };
          return new Response(JSON.stringify(completeSnapshot()), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Publication-Delivery": "cloudflare-kv",
            },
          });
        },
      });

      expect(String(request.url)).toBe("https://public-data.org/data/metrics-snapshot.json");
      expect(request.options.headers).not.toHaveProperty("Authorization");
      expect(result.sections).toHaveLength(REQUIRED_PUBLISHED_SECTION_IDS.length);
      expect(JSON.parse(await readFile(output, "utf8")).meta).not.toHaveProperty("freeTierBudget");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a public snapshot that did not come from the prepared KV edition", async () => {
    const directory = await mkdtemp(join(tmpdir(), "publication-candidate-"));
    try {
      await expect(fetchCandidate({
        output: join(directory, "snapshot.json"),
        fetchImpl: async () => new Response(JSON.stringify(completeSnapshot()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      })).rejects.toThrow(/prepared KV edition/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects redirects away from the approved public host", async () => {
    const directory = await mkdtemp(join(tmpdir(), "publication-candidate-"));
    try {
      await expect(fetchCandidate({
        output: join(directory, "snapshot.json"),
        fetchImpl: async () => {
          const response = new Response(JSON.stringify(completeSnapshot()), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Publication-Delivery": "cloudflare-kv",
            },
          });
          return {
            ok: response.ok,
            status: response.status,
            url: "https://untrusted.example/data/metrics-snapshot.json",
            headers: response.headers,
            body: response.body,
          };
        },
      })).rejects.toThrow(/redirected away from its approved HTTPS host/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
