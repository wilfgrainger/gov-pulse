import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sanitizePublishedSnapshot } from "./build-static-snapshot.mjs";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../worker/feed-registry.js";

const DEFAULT_NAMESPACE_ID = "f950b17f36a447dca7bb339cba8818de";
const DEFAULT_KEY = "v12:publication:current";
const DEFAULT_OUTPUT = "public/data/metrics-snapshot.json";

function required(name, value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

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
    throw new Error(`Cloudflare KV candidate returned ${response.status}`);
  }

  const candidate = publicCandidate(await response.json(), now);
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
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID,
    key: process.env.CLOUDFLARE_PUBLICATION_KEY,
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
