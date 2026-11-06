import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  fetchCandidate,
  validateAcceptedArtifact,
} from "../../scripts/fetch-cloudflare-publication-candidate.mjs";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../../worker/feed-registry.js";

const NOW = new Date("2026-08-02T09:00:00.000Z");
const FETCHED_AT = "2026-08-02T08:00:00.000Z";

function acceptedArtifact() {
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
      publicProjection: {
        state: "published",
        publishedSections: [...REQUIRED_PUBLISHED_SECTION_IDS].sort(),
      },
    },
    ...sections,
  };
}

describe("Cloudflare Pages accepted-artifact recovery", () => {
  it("accepts a pre-sanitized current publication artifact", () => {
    const candidate = validateAcceptedArtifact(acceptedArtifact(), NOW);

    expect(Object.keys(candidate.meta.sources).sort()).toEqual(
      [...REQUIRED_PUBLISHED_SECTION_IDS].sort()
    );
  });

  it("rejects an accepted artifact once any published section has expired", () => {
    const candidate = acceptedArtifact();
    candidate.meta.sources.sentimentPulse.fetchedAt =
      "2026-07-31T20:59:59.000Z";
    for (const measure of Object.values(candidate.sentimentPulse.__measureValidity)) {
      measure.validUntil = "2026-08-01T00:00:00.000Z";
    }

    expect(() => validateAcceptedArtifact(candidate, NOW)).toThrow(
      /not a current accepted public artifact/i
    );
  });

  it("rejects deployment-only or private metadata instead of sanitizing it during recovery", () => {
    const candidate = acceptedArtifact();
    candidate.meta.publicationMode = "queue-free-tier";
    candidate.meta.sources.gdpTracker.backend = "private-worker";

    expect(() => validateAcceptedArtifact(candidate, NOW)).toThrow(
      /not a current accepted public artifact/i
    );
  });

  it("rejects private source diagnostics", () => {
    const candidate = acceptedArtifact();
    candidate.meta.sources.gdpTracker.error = "private upstream response";

    expect(() => validateAcceptedArtifact(candidate, NOW)).toThrow(
      /not a current accepted public artifact/i
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
          return new Response(JSON.stringify(acceptedArtifact()), {
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
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(acceptedArtifact());
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a public snapshot that did not come from the prepared KV edition", async () => {
    const directory = await mkdtemp(join(tmpdir(), "publication-candidate-"));
    try {
      await expect(fetchCandidate({
        output: join(directory, "snapshot.json"),
        now: NOW,
        fetchImpl: async () => new Response(JSON.stringify(acceptedArtifact()), {
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
        now: NOW,
        fetchImpl: async () => {
          const response = new Response(JSON.stringify(acceptedArtifact()), {
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


vi.mock("../../config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal();
  return {
    default: {
      ...config,
      publications: Object.fromEntries(
        Object.entries(config.publications).map(([id, entry]) => [
          id,
          { ...entry, state: "published" },
        ])
      ),
    },
  };
});
