import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {
    snapshot: "public/data/metrics-snapshot.json",
    output: "app/generated/metricsSnapshot.ts",
    optionalMissing: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--snapshot") options.snapshot = argv[++index];
    else if (argv[index] === "--output") options.output = argv[++index];
    else if (argv[index] === "--optional-missing") options.optionalMissing = true;
    else throw new Error(`Unknown build snapshot option '${argv[index]}'`);
  }

  if (!options.snapshot || !options.output) {
    throw new Error("Both --snapshot and --output are required");
  }

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
  return current;
}

export async function generateBuildSnapshotModule(options) {
  const snapshotPath = resolve(projectRoot, options.snapshot);
  const outputPath = resolve(projectRoot, options.output);
  let raw;

  try {
    raw = await readFile(snapshotPath, "utf8");
  } catch (error) {
    if (options.optionalMissing && error && typeof error === "object" && error.code === "ENOENT") {
      return { outputPath, sectionCount: 0, skipped: true };
    }
    throw error;
  }

  const snapshot = validateBuildSnapshot(
    JSON.parse(raw),
    options.now instanceof Date ? options.now : new Date()
  );
  const source = [
    "// Generated from the final verified same-origin publication snapshot.",
    "// Do not hand-edit or commit metric values to this file.",
    `export const BUILD_METRICS_SNAPSHOT: unknown = ${JSON.stringify(snapshot, null, 2)};`,
    "",
  ].join("\n");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, source, "utf8");

  return {
    outputPath,
    sectionCount: Object.keys(snapshot.meta.sources).length,
    skipped: false,
  };
}

async function main() {
  const result = await generateBuildSnapshotModule(parseArgs(process.argv.slice(2)));
  if (result.skipped) {
    process.stdout.write(
      `No publication snapshot found; retained placeholder ${result.outputPath}\n`
    );
    return;
  }

  process.stdout.write(
    `Wrote ${result.outputPath} with ${result.sectionCount} source records for static rendering\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
