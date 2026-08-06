import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { filterCurrentSnapshot } from "../worker/publication-currentness.js";

const DEFAULT_SNAPSHOT = "public/data/metrics-snapshot.json";
const DEFAULT_OUTPUT = "public/data/sections";
const OGL = Object.freeze({
  name: "Open Government Licence v3.0, except where otherwise stated",
  url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
  attribution:
    "Contains public sector information licensed under the Open Government Licence v3.0, except where the named source states otherwise.",
});
const PUBLISHER_TERMS = Object.freeze({
  electionPolling: {
    name: "No reuse licence asserted by public-data.org",
    url: "https://yougov.co.uk/about/terms-combined",
    attribution: "YouGov primary publication; reuse is subject to YouGov's terms.",
  },
  bettingOdds: {
    name: "No reuse licence asserted by public-data.org",
    url: "https://www.oddschecker.com/terms-and-conditions",
    attribution: "Oddschecker market data; reuse is subject to Oddschecker's terms.",
  },
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function csvCell(value) {
  const raw = String(value ?? "");
  const text = typeof value === "string" && /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function flatten(value, path = "$", rows = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flatten(entry, `${path}[${index}]`, rows));
    if (value.length === 0) rows.push([path, "[]"]);
    return rows;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right, "en-GB")
    );
    entries.forEach(([key, entry]) => flatten(entry, `${path}.${key}`, rows));
    if (entries.length === 0) rows.push([path, "{}"]);
    return rows;
  }
  rows.push([path, value === null ? "null" : value]);
  return rows;
}

export function sectionDistribution(snapshot, section) {
  const source = snapshot.meta.sources[section];
  if (!source || !Object.prototype.hasOwnProperty.call(snapshot, section)) return null;
  return {
    contractVersion: 1,
    section,
    generatedAt: snapshot.meta.generatedAt ?? null,
    licence: PUBLISHER_TERMS[section] ?? OGL,
    source,
    data: snapshot[section],
  };
}

export async function generateSectionDownloads({
  snapshotPath = DEFAULT_SNAPSHOT,
  outputDirectory = DEFAULT_OUTPUT,
  now = new Date(),
  optionalMissing = false,
} = {}) {
  let raw;
  try {
    raw = await readFile(resolve(snapshotPath), "utf8");
  } catch (error) {
    if (optionalMissing && error && typeof error === "object" && error.code === "ENOENT") {
      return { outputDirectory: resolve(outputDirectory), sections: [], skipped: true };
    }
    throw error;
  }

  const candidate = JSON.parse(raw);
  const current = filterCurrentSnapshot(candidate, now);
  if (!current) throw new Error("Cannot generate downloads without current source-owned evidence");

  const output = resolve(outputDirectory);
  await mkdir(output, { recursive: true });
  const sections = Object.keys(current.meta.sources).sort((left, right) =>
    left.localeCompare(right, "en-GB")
  );

  for (const section of sections) {
    const distribution = sectionDistribution(current, section);
    if (!distribution) continue;
    const jsonPath = join(output, `${section}.json`);
    const csvPath = join(output, `${section}.csv`);
    const rows = flatten(distribution);
    const csv = ["path,value", ...rows.map(([path, value]) => `${csvCell(path)},${csvCell(value)}`)]
      .join("\n") + "\n";

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
