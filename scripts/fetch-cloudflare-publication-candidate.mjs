import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { acceptedRecoveryArtifact } from "../worker/publication-recovery.js";
import {
  assertSameHttpsHost,
  MAX_RESPONSE_BYTES,
  readResponseJson,
} from "../worker/response-limits.js";

const DEFAULT_OUTPUT = "public/data/metrics-snapshot.json";
// The data Worker serves the prepared public KV artifact at this public route,
// so the Pages seed build needs no Cloudflare API credential to read it.
const DEFAULT_PUBLICATION_URL =
  "https://public-data.org/data/metrics-snapshot.json";

export function validateAcceptedArtifact(value, now = new Date()) {
  const accepted = acceptedRecoveryArtifact(value, now);
  if (!accepted) {
    throw new Error(
      "Cloudflare accepted artifact is not a current accepted public artifact"
    );
  }
  return accepted;
}

export async function fetchCandidate({
  output = DEFAULT_OUTPUT,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
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
    throw new Error(`Cloudflare accepted artifact returned ${response.status}`);
  }

  assertSameHttpsHost(response, candidateUrl, "Cloudflare accepted artifact");
  if (response.headers.get("X-Publication-Delivery") !== "cloudflare-kv") {
    throw new Error("Cloudflare accepted artifact was not served from the prepared KV edition");
  }
  const candidate = validateAcceptedArtifact(
    await readResponseJson(response, {
      limit: MAX_RESPONSE_BYTES.json,
      label: "Cloudflare accepted artifact",
    }),
    now,
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  return {
    outputPath,
    generatedAt: candidate.meta.generatedAt ?? null,
    sections: Object.keys(candidate.meta.sources).sort(),
    sourceUrl: candidateUrl,
  };
}

async function main() {
  const result = await fetchCandidate({
    output: process.env.CLOUDFLARE_PUBLICATION_OUTPUT,
  });
  process.stdout.write(
    `Copied accepted Cloudflare artifact ${result.generatedAt ?? "without edition clock"} with ${result.sections.length} current sections from ${result.sourceUrl}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
