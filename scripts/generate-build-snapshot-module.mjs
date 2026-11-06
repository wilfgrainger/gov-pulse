import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import { buildEditionSummary } from "../worker/edition-summary.js";
import { buildMeasureCatalog } from "../worker/measure-catalog.js";
import { publicSnapshot } from "../worker/public-snapshot.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PRODUCTION_SNAPSHOT_URL = "https://public-data.org/data/metrics-snapshot.json";
const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_OUTPUT = "app/generated/metricsSnapshot.ts";

function parseArgs(argv) {
  const options = { input: undefined, output: DEFAULT_OUTPUT };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") options.input = argv[++index];
    else if (argv[index] === "--output") options.output = argv[++index];
    // Retained so existing callers keep working: a missing artifact is always
    // tolerated now, because the fallback is an explicit null export.
    else if (argv[index] === "--optional-missing") continue;
    else throw new Error(`Unknown build snapshot option '${argv[index]}'`);
  }

  if (!options.output) throw new Error("--output requires a path");
  if (options.input !== undefined && !options.input) throw new Error("--input requires a path");

  return options;
}

export function validateBuildSnapshot(value, now = new Date()) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !value.meta ||
    typeof value.meta !== "object" ||
    Array.isArray(value.meta) ||
    typeof value.meta.registryVersion !== "string" ||
    !value.meta.sources ||
    typeof value.meta.sources !== "object" ||
    Array.isArray(value.meta.sources)
  ) {
    throw new Error("Build snapshot does not contain a valid registry and source manifest");
  }

  const current = filterCurrentSnapshot(value, now);
  if (!current) {
    throw new Error("Build snapshot does not contain current source-owned evidence");
  }
  const snapshot = publicSnapshot(current);
  const measureCatalog = buildMeasureCatalog(snapshot, now);
  snapshot.meta.measureCatalog = measureCatalog;
  // A single checked-in snapshot cannot establish a previous-publication baseline.
  snapshot.meta.editionSummary = buildEditionSummary(null, measureCatalog);
  return snapshot;
}

async function readInput(path) {
  try {
    return JSON.parse(await readFile(resolve(projectRoot, path), "utf8"));
  } catch (error) {
    console.warn(`Build snapshot input '${path}' unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function fetchArtifact(fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(PRODUCTION_SNAPSHOT_URL, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Published snapshot unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function usable(candidate, now, origin) {
  if (candidate === undefined) return null;
  try {
    return validateBuildSnapshot(candidate, now);
  } catch (error) {
    console.warn(`Build snapshot from ${origin} rejected: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Writes the build-time evidence module. Order: the `input` file, else the
 * published artifact, else an explicit `null` export. A previous output is never
 * read, and an artifact with no currently valid evidence is never written.
 */
export async function generate({
  input,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  output = DEFAULT_OUTPUT,
} = {}) {
  const outputPath = resolve(projectRoot, output);
  let snapshot = null;
  if (input) snapshot = usable(await readInput(input), now, `input '${input}'`);
  if (!snapshot && typeof fetchImpl === "function") {
    snapshot = usable(await fetchArtifact(fetchImpl), now, "the published artifact");
  }

  const source = [
    snapshot
      ? "// Generated from a verified, currently valid publication snapshot at build time."
      : "// No currently valid publication snapshot was available at build time.",
    "// Generated and untracked: do not hand-edit or commit metric values to this file.",
    `export const BUILD_METRICS_SNAPSHOT: unknown = ${snapshot ? JSON.stringify(snapshot, null, 2) : "null"};`,
    "",
  ].join("\n");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, source, "utf8");
  return { wrote: snapshot ? "artifact" : "null" };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await generate(options);
  process.stdout.write(
    result.wrote === "artifact"
      ? `Wrote ${options.output} from current publication evidence\n`
      : `No current publication snapshot available; wrote null export to ${options.output}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
