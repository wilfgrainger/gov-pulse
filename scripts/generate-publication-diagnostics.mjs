import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildPublicationDiagnostics,
  validatePublicationDiagnostics,
} from "../contracts/publication-diagnostics.js";
import { FEED_REGISTRY } from "../worker/feed-registry.js";
import { hasRequiredHistoryShape } from "./build-static-snapshot.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {
    snapshot: "public/data/metrics-snapshot.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--snapshot") options.snapshot = argv[++index];
    else throw new Error(`Unknown publication diagnostics option '${argv[index]}'`);
  }
  if (!options.snapshot) throw new Error("A publication snapshot path is required");
  return options;
}

export async function generatePublicationDiagnostics(options) {
  const snapshotPath = resolve(projectRoot, options.snapshot);
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
  snapshot.meta.publicationDiagnostics = diagnostics;

  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return { snapshotPath, diagnostics };
}

async function main() {
  const result = await generatePublicationDiagnostics(
    parseArgs(process.argv.slice(2))
  );
  process.stdout.write(
    `Wrote ${Object.keys(result.diagnostics).length} publication diagnostics into ${result.snapshotPath}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
