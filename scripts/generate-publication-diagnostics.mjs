import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildPublicationDiagnostics,
  validatePublicationDiagnostics,
} from "../contracts/publication-diagnostics.js";
import { FEED_REGISTRY } from "../worker/feed-registry.js";
import { hasRequiredHistoryShape } from "./lib/publication-validation.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {
    snapshot: "public/data/metrics-snapshot.json",
    output: "tmp/publication-diagnostics.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--snapshot") options.snapshot = argv[++index];
    else if (argv[index] === "--output") options.output = argv[++index];
    else throw new Error(`Unknown publication diagnostics option '${argv[index]}'`);
  }
  if (!options.snapshot || !options.output) {
    throw new Error("Publication snapshot and diagnostics output paths are required");
  }
  return options;
}

function isWithin(parent, target) {
  const path = relative(parent, target);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

export async function generatePublicationDiagnostics(options) {
  const snapshotPath = resolve(projectRoot, options.snapshot);
  const outputPath = resolve(projectRoot, options.output);
  if (
    snapshotPath === outputPath ||
    isWithin(resolve(projectRoot, "public"), outputPath) ||
    isWithin(resolve(projectRoot, "app/generated"), outputPath)
  ) {
    throw new Error("Publication diagnostics must be written to a private sidecar path");
  }
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (
    !snapshot?.meta?.sources ||
    typeof snapshot.meta.sources !== "object" ||
    Array.isArray(snapshot.meta.sources)
  ) {
    throw new Error("Publication snapshot does not contain a source manifest");
  }

  const diagnostics = buildPublicationDiagnostics(
    snapshot,
    Object.keys(FEED_REGISTRY),
    hasRequiredHistoryShape
  );
  validatePublicationDiagnostics(diagnostics);
  const sidecar = {
    generatedAt: typeof snapshot.meta.generatedAt === "string"
      ? snapshot.meta.generatedAt
      : null,
    diagnostics,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  return { snapshotPath, outputPath, diagnostics };
}

async function main() {
  const result = await generatePublicationDiagnostics(
    parseArgs(process.argv.slice(2))
  );
  process.stdout.write(
    `Wrote ${Object.keys(result.diagnostics).length} publication diagnostics to private sidecar ${result.outputPath}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
