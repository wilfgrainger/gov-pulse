import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PUBLIC_SNAPSHOT_KEY } from "../worker/public-snapshot.js";
import { acceptedRecoveryArtifact } from "../worker/publication-recovery.js";

const DEFAULT_NAMESPACE_ID = "f950b17f36a447dca7bb339cba8818de";
const DEFAULT_KEY = PUBLIC_SNAPSHOT_KEY;
const DEFAULT_OUTPUT = "public/data/metrics-snapshot.json";

function required(name, value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

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
