import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sanitizePublishedSnapshot } from "./build-static-snapshot.mjs";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import {
  assertSameHttpsHost,
  MAX_RESPONSE_BYTES,
  readResponseJson,
} from "../worker/response-limits.js";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../worker/feed-registry.js";

const DEFAULT_OUTPUT = "public/data/metrics-snapshot.json";
const DEFAULT_PUBLICATION_URL =
  "https://public-data.org/data/metrics-snapshot.json";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function missingRequiredSections(candidate) {
  if (!isRecord(candidate) || !isRecord(candidate.meta?.sources)) {
    return [...REQUIRED_PUBLISHED_SECTION_IDS];
  }
  return REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) =>
      !isRecord(candidate.meta.sources[section]) ||
      !Object.prototype.hasOwnProperty.call(candidate, section)
  );
}

export function validateCandidate(value, now = new Date()) {
  if (
    !isRecord(value) ||
    !isRecord(value.meta) ||
    value.meta.registryVersion !== FEED_REGISTRY_VERSION ||
    !isRecord(value.meta.sources)
  ) {
    throw new Error("Cloudflare publication candidate has an invalid source manifest");
  }

  const current = filterCurrentSnapshot(value, now);
  if (!current) {
    throw new Error("Cloudflare publication candidate has no current source-owned evidence");
  }

  const missing = missingRequiredSections(current);
  if (missing.length > 0) {
    throw new Error(
      `Cloudflare publication candidate is missing current required evidence: ${missing.join(", ")}`
    );
  }
  return current;
}

export function publicCandidate(value, now = new Date()) {
  const candidate = sanitizePublishedSnapshot(validateCandidate(value, now));
  delete candidate.meta.publicationMode;
  delete candidate.meta.freeTierBudget;
  return candidate;
}

export async function fetchCandidate({
  output = DEFAULT_OUTPUT,
  fetchImpl = fetch,
  now = new Date(),
}) {
  const candidateUrl = DEFAULT_PUBLICATION_URL;
  const outputPath = resolve(output);
  const response = await fetchImpl(candidateUrl, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      // Releasing an unsuccessful response body is best effort only.
    }
    throw new Error(`Cloudflare publication candidate returned ${response.status}`);
  }

  assertSameHttpsHost(response, candidateUrl, "Cloudflare publication candidate");
  if (response.headers.get("X-Publication-Delivery") !== "cloudflare-kv") {
    throw new Error("Cloudflare publication candidate was not served from the prepared KV edition");
  }
  const candidate = publicCandidate(
    await readResponseJson(response, {
      limit: MAX_RESPONSE_BYTES.json,
      label: "Cloudflare publication candidate",
    }),
    now,
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  return {
    outputPath,
    generatedAt: candidate.meta.generatedAt ?? null,
    sections: Object.keys(candidate.meta.sources).sort(),
  };
}

async function main() {
  const result = await fetchCandidate({
    output: process.env.CLOUDFLARE_PUBLICATION_OUTPUT,
  });
  process.stdout.write(
    `Read Cloudflare candidate ${result.generatedAt ?? "without edition clock"} with ${result.sections.length} current sections\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
