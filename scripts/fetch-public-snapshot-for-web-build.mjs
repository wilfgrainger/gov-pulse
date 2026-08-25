import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../worker/feed-registry.js";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import { publicSnapshot } from "../worker/public-snapshot.js";
import { readResponseJson, assertSameHttpsHost } from "../worker/response-limits.js";
import { validateSnapshot } from "./build-static-snapshot.mjs";

const DEFAULT_URL = "https://public-data.org/data/metrics-snapshot.json";
const DEFAULT_OUTPUT = "public/data/metrics-snapshot.json";
const PUBLIC_HOST = "public-data.org";
const PUBLIC_PATH = "/data/metrics-snapshot.json";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validatePublicSnapshotUrl(value) {
  const url = new URL(String(value ?? ""));
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== PUBLIC_HOST ||
    url.pathname !== PUBLIC_PATH ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `Web build snapshot URL must be https://${PUBLIC_HOST}${PUBLIC_PATH}`,
    );
  }
  return url.toString();
}

function missingRequiredSections(snapshot) {
  return REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) =>
      !isRecord(snapshot?.meta?.sources?.[section]) ||
      !Object.prototype.hasOwnProperty.call(snapshot, section),
  );
}

function expectedRevision(value) {
  const revision = String(value ?? "").trim().toLowerCase();
  if (!revision) return null;
  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error("Expected data Worker revision must be a full Git commit SHA");
  }
  return revision;
}

function assertExpectedRevision(response, revision) {
  if (!revision) return;
  const servedRevision = String(
    response?.headers?.get?.("X-Public-Data-Revision") ?? "",
  )
    .trim()
    .toLowerCase();
  if (servedRevision !== revision) {
    throw new Error(
      `Public snapshot was not served by data Worker revision ${revision}`,
    );
  }
}

export function prepareWebSnapshot(value, now = new Date()) {
  if (
    !isRecord(value) ||
    !isRecord(value.meta) ||
    value.meta.registryVersion !== FEED_REGISTRY_VERSION ||
    !isRecord(value.meta.sources) ||
    value.meta.delivery !== "published-snapshot"
  ) {
    throw new Error("Web build snapshot is not a verified public publication");
  }

  const current = filterCurrentSnapshot(value, now);
  if (!current) {
    throw new Error("Web build snapshot contains no current source-owned evidence");
  }

  validateSnapshot(current, 1, []);
  const snapshot = publicSnapshot(current);
  const missing = missingRequiredSections(snapshot);
  snapshot.meta.publicationState = missing.length > 0 ? "degraded" : "ready";
  snapshot.meta.missingRequiredSections = missing;
  return snapshot;
}

export async function fetchPublicSnapshot({
  url = DEFAULT_URL,
  output = DEFAULT_OUTPUT,
  expectedRevision: expectedRevisionValue,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const snapshotUrl = validatePublicSnapshotUrl(url);
  const revision = expectedRevision(expectedRevisionValue);
  const response = await fetchImpl(snapshotUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      // Releasing an unsuccessful response body is best effort only.
    }
    throw new Error(`Public snapshot returned ${response.status}`);
  }

  assertSameHttpsHost(response, snapshotUrl, "Public snapshot");
  assertExpectedRevision(response, revision);
  const snapshot = prepareWebSnapshot(
    await readResponseJson(response, { label: "Public snapshot JSON" }),
    now,
  );
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return {
    outputPath,
    generatedAt: snapshot.meta.generatedAt ?? null,
    publicationState: snapshot.meta.publicationState,
    missingRequiredSections: snapshot.meta.missingRequiredSections,
    sections: Object.keys(snapshot.meta.sources).sort(),
  };
}

async function main() {
  const result = await fetchPublicSnapshot({
    url: process.env.METRICS_SNAPSHOT_URL ?? DEFAULT_URL,
    output: process.env.WEB_BUILD_SNAPSHOT_OUTPUT ?? DEFAULT_OUTPUT,
    expectedRevision: process.env.PUBLIC_DATA_EXPECTED_REVISION,
  });
  process.stdout.write(
    `Wrote ${result.outputPath} with ${result.sections.length} current sections (${result.publicationState})\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
