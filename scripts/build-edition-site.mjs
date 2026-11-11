// Builds one verified edition as static files (static-first plan Task 14):
// the normal export, an unavailable variant of every evidence-bearing file
// under /_unavailable/, edition-manifest.json for the gate Worker, _headers and
// _redirects. Produces a CI artifact only; it deploys nothing.
//
//   EDITION_BUILD=1 node scripts/build-edition-site.mjs --edition <id> --sha <sha> --out out \
//     [--input <snapshot.json> | --origin https://public-data.org]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { securityHeaders } from "../contracts/security-headers.js";
import { PUBLICATION_CONFIG, decisionFor, projectPublic, sectionValidityDeadline } from "../contracts/evidence-policy.js";
import {
  classifyEmittedFiles,
  evidenceValues,
  evidenceValuesByFeed,
  feedEmbedding,
  recordFeedEmbedding,
  resetFeedEmbedding,
  undeclaredFeedEvidence,
} from "../app/lib/editionManifest.ts";
import { embeddedFeedsForRoute, routeEvidenceFeeds, routeForEmittedFile } from "../app/lib/routeEvidence.js";
import { generate } from "./generate-build-snapshot-module.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Workers Static Assets limits (verified, plan Global Constraints).
export const MAX_ASSET_FILES = 20_000;
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const RETRY_INTERVAL_MS = 30_000;
const DEFAULT_RETRY_MS = 5 * 60_000;
const VARIANT_DIR = "_unavailable";
const MODULE_PATH = "app/generated/metricsSnapshot.ts";

function walk(root, dir = root) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(root, full) : [path.relative(root, full).split(path.sep).join("/")];
  });
}

async function fetchSnapshot(origin, fetchImpl) {
  const response = await fetchImpl(new URL("/data/metrics-snapshot.json", origin), { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Build input HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_INPUT_BYTES) throw new Error(`Build input exceeds ${MAX_INPUT_BYTES} bytes`);
  return JSON.parse(text);
}

/** Reads the build input and insists it is the requested edition; retries a stale read (KV, edge cache). */
async function loadInput({ editionId, origin, fetchImpl, input, retryMs }) {
  const deadline = Date.now() + retryMs;
  for (;;) {
    const raw = input ?? await fetchSnapshot(origin, fetchImpl);
    const fetched = raw?.meta?.editionSummary?.id;
    if (fetched === editionId) return raw;
    if (input !== undefined || Date.now() + RETRY_INTERVAL_MS > deadline) {
      throw new Error(`Refusing to emit: build input edition id '${fetched}' differs from requested '${editionId}'`);
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
  }
}

/** Default builder: writes the snapshot module the pages read, runs the export and moves `out` to outDir. */
async function runNextBuild({ snapshot, outDir, sha, now }) {
  const scratch = path.join(path.dirname(outDir), `.edition-input-${process.pid}.json`);
  try {
    if (snapshot) {
      fs.writeFileSync(scratch, JSON.stringify(snapshot));
      const { wrote } = await generate({ input: scratch, fetchImpl: null, now });
      if (wrote !== "artifact") throw new Error("Current build input was rejected by the snapshot module generator");
    } else {
      fs.writeFileSync(path.join(projectRoot, MODULE_PATH),
        "// Unavailable variant build: no evidence.\nexport const BUILD_METRICS_SNAPSHOT: unknown = null;\n");
    }
  } finally {
    fs.rmSync(scratch, { force: true });
  }
  fs.rmSync(path.join(projectRoot, "out"), { recursive: true, force: true });
  const result = spawnSync("npx", ["next", "build", "--webpack"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, EDITION_BUILD: "1", STATIC_EXPORT: "true", EDITION_BUILD_ID: sha, NEXT_PUBLIC_COMMIT_SHA: sha },
  });
  if (result.status !== 0) throw new Error(`next build failed with status ${result.status}`);
  move(path.join(projectRoot, "out"), outDir);
}

/** rename, or copy then delete when source and target are on different devices. */
function move(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
}

function sameBytes(a, b) {
  return fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b));
}

function assertAssetBudget(outDir) {
  const files = walk(outDir);
  if (files.length >= MAX_ASSET_FILES) throw new Error(`${files.length} files exceeds the ${MAX_ASSET_FILES} static asset limit`);
  for (const file of files) {
    if (fs.statSync(path.join(outDir, file)).size >= MAX_ASSET_BYTES) throw new Error(`${file} exceeds the 25 MiB static asset limit`);
  }
}

function headersFile() {
  return [
    "/*",
    ...securityHeaders.map(({ key, value }) => `  ${key}: ${value}`),
    "",
    "/_next/static/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}

/**
 * @param {{ editionId: string, sha: string, origin: string, fetchImpl?: typeof fetch, now: Date, outDir: string,
 *   input?: unknown, retryMs?: number, config?: object,
 *   nextBuild?: (args: { snapshot: object | null, outDir: string, sha: string, now: Date }) => Promise<void> }} opts
 * @returns {Promise<import("../app/lib/editionManifest.ts").EditionManifest>}
 */
export async function buildEditionSite({
  editionId, sha, origin, fetchImpl = globalThis.fetch, now, outDir,
  input, retryMs = DEFAULT_RETRY_MS, config = PUBLICATION_CONFIG, nextBuild = runNextBuild,
}) {
  const raw = await loadInput({ editionId, origin, fetchImpl, input, retryMs });
  // Held, retired, unknown and expired feeds never reach the build input.
  const { snapshot } = projectPublic(raw, now, config);
  const feeds = Object.keys(snapshot?.meta?.sources ?? {});
  const validUntil = Object.fromEntries(feeds.map((id) => {
    const deadline = sectionValidityDeadline(id, snapshot[id], snapshot.meta.sources[id], now);
    return [id, Number.isFinite(deadline) ? new Date(deadline).toISOString() : null];
  }));
  const held = Object.keys(raw?.meta?.sources ?? {}).filter((id) => decisionFor(id, config) !== "published").sort();

  const target = path.resolve(outDir);
  // Outside the project: Tailwind scans unignored project files for class names, so
  // a variant output beside the source would change the available build's CSS.
  const variant = path.join(os.tmpdir(), `edition-variant-${process.pid}-${Date.now()}`);
  fs.rmSync(target, { recursive: true, force: true });
  fs.rmSync(variant, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const modulePath = path.join(projectRoot, MODULE_PATH);
  const originalModule = fs.existsSync(modulePath) ? fs.readFileSync(modulePath) : null;
  try {
    // Variant first: every evidence block rendered unavailable (no build input at all).
    await nextBuild({ snapshot: null, outDir: variant, sha, now });
    await nextBuild({ snapshot, outDir: target, sha, now });
  } finally {
    if (originalModule && nextBuild === runNextBuild) fs.writeFileSync(modulePath, originalModule);
  }

  // Embedding record: a file whose bytes change when the build input is removed
  // serialises evidence (by construction); which feeds is its route's declaration
  // (app/lib/routeEvidence.js), the same one pages project their snapshot with.
  // The per-feed scan below verifies it. A route whose declared feeds are all
  // absent from this edition differs only by edition metadata ("section
  // unavailable in this edition") and is not gated; the scans still check it.
  resetFeedEmbedding();
  const undeclared = [];
  for (const file of walk(target)) {
    if (sameBytes(path.join(target, file), path.join(variant, file))) continue;
    const route = routeForEmittedFile(file);
    const declared = routeEvidenceFeeds(route, config);
    if (declared !== "all" && declared.length === 0) undeclared.push(file);
    recordFeedEmbedding(file, embeddedFeedsForRoute(route, feeds, config));
  }
  if (undeclared.length > 0) {
    throw new Error(`Refusing to emit: files change with the build input but their route declares no feed: ${undeclared.sort().join(", ")}`);
  }
  const embedding = feedEmbedding();

  // Keep only the variants a gated file points to; hashed assets are shared.
  const files = {};
  const keep = new Set();
  for (const [file, embedded] of Object.entries(embedding)) {
    const hasVariant = !file.startsWith("data/") && fs.existsSync(path.join(variant, file));
    if (hasVariant) keep.add(file);
    files[`/${file}`] = {
      validUntil: embedded.map((id) => validUntil[id]).filter(Boolean).sort()[0] ?? null,
      feeds: embedded,
      unavailable: hasVariant ? `/${VARIANT_DIR}/${file}` : { status: 503 },
    };
  }
  for (const file of walk(variant)) {
    const from = path.join(variant, file);
    if (keep.has(file)) move(from, path.join(target, VARIANT_DIR, file));
    else if (file.startsWith("_next/static/") && !fs.existsSync(path.join(target, file))) move(from, path.join(target, file));
  }
  fs.rmSync(variant, { recursive: true, force: true });

  fs.writeFileSync(path.join(target, "_headers"), headersFile());
  fs.copyFileSync(path.join(projectRoot, "contracts/edition-redirects.txt"), path.join(target, "_redirects"));

  // Backstop: scan every emitted file, variants included, for build-input values.
  const { unexplained } = classifyEmittedFiles(target, embedding, evidenceValues(snapshot));
  if (unexplained.length > 0) {
    throw new Error(`Refusing to emit: unexplained evidence-bearing files: ${unexplained.join(", ")}`);
  }
  const leaks = undeclaredFeedEvidence(target, embedding, evidenceValuesByFeed(snapshot));
  if (leaks.length > 0) {
    throw new Error(`Refusing to emit: files embed evidence from feeds their route does not declare: ${leaks.map(({ file, feeds: extra }) => `${file} (${extra.join(", ")})`).join(", ")}`);
  }
  assertAssetBudget(target);

  const manifest = { editionId, builtAt: now.toISOString(), sha, held, files };
  fs.writeFileSync(path.join(target, "edition-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function parseArgs(argv) {
  const options = { origin: "https://public-data.org", out: "out" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[++index];
    if (!value) throw new Error(`${flag} requires a value`);
    if (flag === "--input") options.input = value;
    else if (flag === "--edition") options.edition = value;
    else if (flag === "--sha") options.sha = value;
    else if (flag === "--out") options.out = value;
    else if (flag === "--origin") options.origin = value;
    else throw new Error(`Unknown option '${flag}'`);
  }
  if (!options.edition || !options.sha) throw new Error("--edition and --sha are required");
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const manifest = await buildEditionSite({
    editionId: options.edition,
    sha: options.sha,
    origin: options.origin,
    now: new Date(),
    outDir: path.resolve(options.out),
    input: options.input ? JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8")) : undefined,
  });
  const files = walk(path.resolve(options.out));
  const bytes = files.reduce((sum, file) => sum + fs.statSync(path.join(path.resolve(options.out), file)).size, 0);
  process.stdout.write(`Edition ${manifest.editionId}: ${Object.keys(manifest.files).length} gated files, ${files.length} files, ${bytes} bytes, ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
