import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import { sectionDistribution, sectionCsv, csvCell } from "../app/lib/sectionDownloads.ts";

export { sectionDistribution, csvCell };

const DEFAULT_SNAPSHOT = "public/data/metrics-snapshot.json";
export const DEFAULT_SECTION_DOWNLOAD_OUTPUT = "out/data/sections";

function assertSafeOutputDirectory(outputDirectory) {
  const output = resolve(outputDirectory);
  const publicSections = resolve("public/data/sections");
  if (output === publicSections || output.startsWith(`${publicSections}${sep}`)) {
    throw new Error("Section downloads cannot be generated under public/data/sections because that path shadows request-time downloads");
  }
  return output;
}

export async function generateSectionDownloads({
  snapshotPath = DEFAULT_SNAPSHOT,
  outputDirectory = DEFAULT_SECTION_DOWNLOAD_OUTPUT,
  now = new Date(),
  optionalMissing = false,
} = {}) {
  const output = assertSafeOutputDirectory(outputDirectory);
  let raw;
  try {
    raw = await readFile(resolve(snapshotPath), "utf8");
  } catch (error) {
    if (optionalMissing && error && typeof error === "object" && error.code === "ENOENT") {
      return { outputDirectory: output, sections: [], skipped: true };
    }
    throw error;
  }

  const candidate = JSON.parse(raw);
  const current = filterCurrentSnapshot(candidate, now);
  if (!current) throw new Error("Cannot generate downloads without current source-owned evidence");

  await mkdir(output, { recursive: true });
  const sections = Object.keys(current.meta.sources).sort((left, right) =>
    left.localeCompare(right, "en-GB")
  ).filter((section) => sectionDistribution(current, section));

  for (const section of sections) {
    const distribution = sectionDistribution(current, section);
    if (!distribution) continue;
    const jsonPath = join(output, `${section}.json`);
    const csvPath = join(output, `${section}.csv`);
    const csv = sectionCsv(distribution);

    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(distribution, null, 2)}\n`, "utf8");
    await writeFile(csvPath, csv, "utf8");
  }

  return { outputDirectory: output, sections, skipped: false };
}

async function main() {
  const result = await generateSectionDownloads({
    optionalMissing: process.argv.includes("--optional-missing"),
  });
  if (result.skipped) {
    process.stdout.write("No publication snapshot found; section downloads were not generated\n");
    return;
  }
  process.stdout.write(
    `Generated JSON and CSV downloads for ${result.sections.length} current sections\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
