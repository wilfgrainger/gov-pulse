import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isSnapshot } from "../worker/publication-entry.js";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import { FEED_REGISTRY_VERSION } from "../worker/feed-registry.js";
import { PUBLIC_SNAPSHOT_KEY, publicSnapshot } from "../worker/public-snapshot.js";

const DEFAULT_NAMESPACE_ID = "f950b17f36a447dca7bb339cba8818de";
const DEFAULT_KEY = PUBLIC_SNAPSHOT_KEY;
const DEFAULT_OUTPUT = "public/data/metrics-snapshot.json";

function required(name, value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateAcceptedArtifact(value, now = new Date()) {
  if (
    !isRecord(value) ||
    !isRecord(value.meta) ||
    value.meta.registryVersion !== FEED_REGISTRY_VERSION ||
    !isRecord(value.meta.sources) ||
    !isSnapshot(value)
  ) {
    throw new Error("Cloudflare accepted artifact has an invalid publication shape");
  }

  if (
    Object.prototype.hasOwnProperty.call(value.meta, "publicationDiagnostics") ||
    Object.prototype.hasOwnProperty.call(value.meta, "measureCatalogDiagnostics") ||
    Object.values(value.meta.sources).some((source) =>
      isRecord(source) && Object.prototype.hasOwnProperty.call(source, "error")
    ) ||
    JSON.stringify(publicSnapshot(value)) !== JSON.stringify(value)
  ) {
    throw new Error("Cloudflare accepted artifact contains private publication metadata");
  }

  const current = filterCurrentSnapshot(value, now);
  if (!current || !isSnapshot(current)) {
    throw new Error("Cloudflare accepted artifact has no current source-owned evidence");
  }

  return current;
}

export async function fetchCandidate({
  accountId,
  apiToken,
  namespaceId = DEFAULT_NAMESPACE_ID,
  key = DEFAULT_KEY,
  output = DEFAULT_OUTPUT,
  fetchImpl = fetch,
  now = new Date(),
}) {
  const account = required("CLOUDFLARE_ACCOUNT_ID", accountId);
  const token = required("CLOUDFLARE_API_TOKEN", apiToken);
  const namespace = required("CLOUDFLARE_KV_NAMESPACE_ID", namespaceId);
  const keyName = required("CLOUDFLARE_PUBLICATION_KEY", key);
  const outputPath = resolve(output);
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}` +
    `/storage/kv/namespaces/${encodeURIComponent(namespace)}` +
    `/values/${encodeURIComponent(keyName)}`;

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
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

  const candidate = validateAcceptedArtifact(await response.json(), now);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  return {
    outputPath,
    generatedAt: candidate.meta.generatedAt ?? null,
    sections: Object.keys(candidate.meta.sources).sort(),
    sourceKey: keyName,
  };
}

async function main() {
  const result = await fetchCandidate({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID,
    key: process.env.CLOUDFLARE_PUBLICATION_KEY,
    output: process.env.CLOUDFLARE_PUBLICATION_OUTPUT,
  });
  process.stdout.write(
    `Copied accepted Cloudflare artifact ${result.generatedAt ?? "without edition clock"} with ${result.sections.length} current sections from ${result.sourceKey}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
