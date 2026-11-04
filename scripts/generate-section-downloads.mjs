import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";
import { filterPublicationSnapshot } from "../contracts/publication-policy.js";
import { publicSnapshot } from "../worker/public-snapshot.js";
import { BUILD_METRICS_SNAPSHOT } from "../app/generated/metricsSnapshot.ts";
import {
  SECTION_DOWNLOAD_IDS,
  sectionDistribution,
  sectionCsv,
  csvCell,
} from "../app/lib/sectionDownloads.ts";

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

async function removeStaleSectionDownloads(outputDirectory, keepSections) {
  const keep = new Set(keepSections);
  for (const section of SECTION_DOWNLOAD_IDS) {
    if (keep.has(section)) continue;
    for (const extension of ["json", "csv"]) {
      try {
        await unlink(join(outputDirectory, `${section}.${extension}`));
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") continue;
        throw error;
      }
    }
  }
}

export async function generateSectionDownloads({
  snapshotPath = DEFAULT_SNAPSHOT,
  outputDirectory = DEFAULT_SECTION_DOWNLOAD_OUTPUT,
  now = new Date(),
  optionalMissing = false,
  fallbackSnapshot = BUILD_METRICS_SNAPSHOT,
} = {}) {
  const output = assertSafeOutputDirectory(outputDirectory);
  let raw;
  let candidate;
  let candidateWasMissing = false;
  try {
    raw = await readFile(resolve(snapshotPath), "utf8");
  } catch (error) {
    if (optionalMissing && error && typeof error === "object" && error.code === "ENOENT") {
      candidate = fallbackSnapshot;
      candidateWasMissing = true;
    } else {
      throw error;
    }
  }

  if (raw !== undefined) candidate = JSON.parse(raw);
  const current = filterCurrentSnapshot(candidate, now);
  await mkdir(output, { recursive: true });
  if (!current) {
    await removeStaleSectionDownloads(output, []);
    if (candidateWasMissing) {
      return { outputDirectory: output, sections: [], skipped: true };
    }
    throw new Error("Cannot generate downloads without current source-owned evidence");
  }
  const publicProjection = filterPublicationSnapshot(current);
  if (!publicProjection) {
    await removeStaleSectionDownloads(output, []);
    if (candidateWasMissing) {
      return { outputDirectory: output, sections: [], skipped: true };
    }
    throw new Error("Cannot generate downloads without enabled public evidence");
  }
  const published = publicSnapshot(publicProjection);

  const sections = Object.keys(published.meta.sources).sort((left, right) =>
    left.localeCompare(right, "en-GB")
  ).filter((section) => sectionDistribution(published, section));
  await removeStaleSectionDownloads(output, sections);

  for (const section of sections) {
    const distribution = sectionDistribution(published, section);
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
