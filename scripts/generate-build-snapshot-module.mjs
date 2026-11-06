import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import { buildEditionSummary } from "../worker/edition-summary.js";
import { buildMeasureCatalog } from "../worker/measure-catalog.js";
import { publicSnapshot } from "../worker/public-snapshot.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PRODUCTION_SNAPSHOT_URL = "https://public-data.org/data/metrics-snapshot.json";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const DEFAULT_OUTPUT = "app/generated/metricsSnapshot.ts";

function parseArgs(argv) {
  const options = { input: undefined, output: DEFAULT_OUTPUT, ensure: false };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") options.input = argv[++index];
    else if (argv[index] === "--output") options.output = argv[++index];
    // Retained so existing callers keep working: a missing artifact is always
    // tolerated now, because the fallback is an explicit null export.
    else if (argv[index] === "--optional-missing") continue;
    else if (argv[index] === "--ensure") options.ensure = true;
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
    const declared = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) {
      throw new Error(`response of ${declared} bytes exceeds the ${MAX_ARTIFACT_BYTES} byte limit`);
    }
    // Enforce the cap while streaming so memory stays bounded whatever the
    // declared length says.
    const chunks = [];
    let total = 0;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_ARTIFACT_BYTES) {
          await reader.cancel().catch(() => {});
          throw new Error(`response exceeds the ${MAX_ARTIFACT_BYTES} byte limit`);
        }
        chunks.push(value);
      }
    } else {
      const bytes = new TextEncoder().encode(await response.text());
      if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
        throw new Error(`response exceeds the ${MAX_ARTIFACT_BYTES} byte limit`);
      }
      chunks.push(bytes);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

const NULL_MODULE = [
  "// No currently valid publication snapshot was available at build time.",
  "// Generated and untracked: do not hand-edit or commit metric values to this file.",
  "export const BUILD_METRICS_SNAPSHOT: unknown = null;",
  "",
].join("\n");

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
  if (!snapshot && process.env.GITHUB_ACTIONS) {
    // Make a release that ships a feed with no dataset items visible in the run.
    console.log("::warning::Build evidence unavailable (fetch or validation failed); wrote a null export so RSS will carry no dataset items.");
  }
  return { wrote: snapshot ? "artifact" : "null" };
}

/**
 * Network-free guard for fresh clones: creates the null export only when the
 * module is missing. An existing file is never overwritten or read.
 */
export async function ensure({ output = DEFAULT_OUTPUT } = {}) {
  const outputPath = resolve(projectRoot, output);
  try {
    await access(outputPath);
    return { wrote: "existing" };
  } catch {
    // Missing: fall through to the null export.
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, NULL_MODULE, { encoding: "utf8", flag: "wx" });
  return { wrote: "null" };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.ensure) {
    const result = await ensure(options);
    process.stdout.write(
      result.wrote === "null"
        ? `Created null build snapshot module ${options.output} (run npm run build:prepare for current evidence)\n`
        : `Build snapshot module ${options.output} already present\n`
    );
    return;
  }
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
