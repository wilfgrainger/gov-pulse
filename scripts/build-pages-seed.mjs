import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { anyEvidencePublished } from "../contracts/publication-policy.js";
import { fetchCandidate } from "./fetch-cloudflare-publication-candidate.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OFFLINE_MESSAGE = "Data publications are temporarily offline.\n";

export async function buildPagesSeed({
  enabled = anyEvidencePublished(),
  root = projectRoot,
  outputDirectory = "out",
  offlineEntry = "worker/offline-pages-entry.js",
  commitSha = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
  branch = process.env.CF_PAGES_BRANCH ?? null,
  fetchSnapshot = fetchCandidate,
  buildStaticSite = () => execFileSync("npm", ["run", "build:check"], {
    cwd: root,
    env: { ...process.env, STATIC_EXPORT: "true" },
    stdio: "inherit",
  }),
} = {}) {
  const outputPath = resolve(root, outputDirectory);
  await rm(outputPath, { recursive: true, force: true });

  if (
    process.env.CF_PAGES === "1" &&
    (!/^[0-9a-f]{40}$/i.test(String(commitSha ?? "")) || branch !== "main")
  ) {
    throw new Error("Cloudflare Pages must build a full commit SHA from main");
  }

  const writeReleaseMarker = async () => {
    await mkdir(outputPath, { recursive: true });
    await writeFile(
      join(outputPath, "release.json"),
      `${JSON.stringify({ commitSha, branch })}\n`,
      "utf8"
    );
  };

  if (!enabled) {
    await mkdir(outputPath, { recursive: true });
    await copyFile(resolve(root, offlineEntry), join(outputPath, "_worker.js"));
    await writeFile(join(outputPath, "index.html"), OFFLINE_MESSAGE, "utf8");
    await writeReleaseMarker();
    return { mode: "offline", outputPath };
  }

  await fetchSnapshot({
    output: resolve(root, "public/data/metrics-snapshot.json"),
  });
  buildStaticSite();
  await writeReleaseMarker();
  return { mode: "seed", outputPath };
}

async function main() {
  const result = await buildPagesSeed();
  process.stdout.write(`Prepared Pages ${result.mode} output at ${result.outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
