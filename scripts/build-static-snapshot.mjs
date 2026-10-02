import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SECTION_BUILDERS } from "../worker/section-builders.js";
import { collectTaxRevenue } from "../worker/live-tax-revenue-collector.js";
import { normalizePrimaryPollPayload } from "../worker/election-polls.js";
import { provenanceFor } from "../worker/feed-registry.js";
import {
  FEED_REGISTRY,
  FEED_REGISTRY_VERSION,
  OPTIONAL_PUBLISHED_SECTION_IDS,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../worker/feed-registry.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const maximumSeedAgeMs = Object.freeze({
  sentimentPulse: 36 * HOUR_MS,
  gdpTracker: 36 * HOUR_MS,
  employmentStats: 36 * HOUR_MS,
  nationalDebt: 40 * DAY_MS,
  taxRevenue: 36 * HOUR_MS,
  migrationStats: 36 * HOUR_MS,
  electionPolling: 14 * DAY_MS,
  nhsStats: 45 * DAY_MS,
  bettingOdds: 4 * HOUR_MS,
  crimeStatistics: 45 * DAY_MS,
});

export function createMemoryKv() {
  const values = new Map();
  return {
    async get(key, type) {
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      values.set(key, String(value));
    },
    async delete(key) {
      values.delete(key);
    },
  };
}

function parseArgs(argv) {
  const options = {
    output: "public/data/metrics-snapshot.json",
    ingests: [],
    minimumVerified: REQUIRED_PUBLISHED_SECTION_IDS.length,
    seed: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output") options.output = argv[++index];
    else if (argv[index] === "--ingest") options.ingests.push(argv[++index]);
    else if (argv[index] === "--seed") options.seed = argv[++index];
    else if (argv[index] === "--minimum-verified") {
      options.minimumVerified = Number.parseInt(argv[++index], 10);
    } else {
      throw new Error(`Unknown snapshot option '${argv[index]}'`);
    }
  }
  if (!options.output) throw new Error("Snapshot output path is required");
  if (!Number.isSafeInteger(options.minimumVerified) || options.minimumVerified < 1) {
    throw new Error("--minimum-verified must be a positive integer");
  }
  return options;
}

async function electionPollIngest() {
  const sourcePath = resolve(
    projectRoot,
    "data/election-polls/primary-polls.json"
  );
  try {
    const raw = JSON.parse(await readFile(sourcePath, "utf8"));
    const data = normalizePrimaryPollPayload(raw);
    return {
      section: "electionPolling",
      data,
      fetchedAt: `${data.latestPublicationDate}T12:00:00.000Z`,
      sourceLabel: "Verified primary pollster publications",
      backend: "scheduled-election-poll-ingest",
    };
  } catch (error) {
    console.warn(
      `Election polling fixture not normalized: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

// Build one section's record directly from the flat builders / live collectors,
// replacing the former internal-worker doll (worker.fetch("/metrics?section=X")).
// Returns a record { section, data, fetchedAt, ... } or null when the section is
// not built at snapshot time (nhsStats / bettingOdds are ingest-only here and
// fall back to seed reuse, exactly as under the doll).
async function resolveSectionRecord(section, ingestRecords, now = new Date()) {
  if (ingestRecords.has(section)) {
    return ingestRecords.get(section);
  }
  if (section === "taxRevenue") {
    return collectTaxRevenue(fetch, now);
  }
  if (typeof SECTION_BUILDERS[section] === "function") {
    return SECTION_BUILDERS[section](now);
  }
  if (section === "electionPolling") {
    // electionPolling is ingested from the committed fixture above; if no
    // fixture was supplied it is unavailable and falls back to seed reuse.
    return null;
  }
  // nhsStats / bettingOdds: ingest-only at snapshot build time.
  return null;
}

export function validateSnapshot(
  snapshot,
  minimumVerified = 1,
  requiredSections = []
) {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot) ||
    snapshot.meta?.registryVersion !== FEED_REGISTRY_VERSION ||
    !snapshot.meta?.sources ||
    typeof snapshot.meta.sources !== "object"
  ) {
    throw new Error("Generated snapshot does not match the repository feed registry");
  }

  const verifiedSections = Object.entries(snapshot.meta.sources)
    .filter(([section, source]) => {
      const observation = snapshot[section]?.__observation;
      return (
        source?.status === "ok" &&
        source.cacheState === "fresh" &&
        observation?.status === "current" &&
        typeof observation.period === "string" &&
        typeof observation.observedAt === "string"
      );
    })
    .map(([section]) => section);

  if (verifiedSections.length < minimumVerified) {
    const diagnostics = Object.entries(snapshot.meta.sources)
      .filter(([section]) => !verifiedSections.includes(section))
      .map(([section, source]) =>
        `${section}=${source?.status ?? "unknown"}/${source?.cacheState ?? "unknown"}${source?.error ? ` (${source.error})` : ""}`
      )
      .join("; ");
    throw new Error(
      `Generated snapshot verified ${verifiedSections.length} sections; ${minimumVerified} required. ${diagnostics}`
    );
  }
  const missingRequiredSections = requiredSections.filter(
    (section) => !verifiedSections.includes(section)
  );
  if (missingRequiredSections.length > 0) {
    throw new Error(
      `Generated snapshot is missing required sections: ${missingRequiredSections.join(", ")}`
    );
  }
  return verifiedSections;
}

export function isUsableSeedSection(seed, section, now = Date.now()) {
  const source = seed?.meta?.sources?.[section];
  const data = seed?.[section];
  const fetchedAt = Date.parse(source?.fetchedAt ?? "");
  const expiresAt = Date.parse(data?.expiresAt ?? "");
  const maximumAge = maximumSeedAgeMs[section];
  return (
    seed?.meta?.registryVersion === FEED_REGISTRY_VERSION &&
    source?.status === "ok" &&
    source.cacheState === "fresh" &&
    data?.__observation?.status === "current" &&
    hasRequiredHistoryShape(section, data, now) &&
    Number.isFinite(fetchedAt) &&
    Number.isFinite(maximumAge) &&
    now >= fetchedAt &&
    now - fetchedAt <= maximumAge &&
    (data?.expiresAt === undefined ||
      (Number.isFinite(expiresAt) && expiresAt >= now))
  );
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function hasRequiredHistoryShape(section, data, now = Date.now()) {
  if (section === "sentimentPulse") {
    return ["inflation", "bankRate", "unemployment"].every(
      (id) =>
        Array.isArray(data?.series?.[id]?.history) &&
        data.series[id].history.length >= 2 &&
        finite(data.series[id].annualDelta)
    );
  }
  if (section === "gdpTracker") {
    return Array.isArray(data?.history) && data.history.length >= 13;
  }
  if (section === "employmentStats") {
    return (
      Array.isArray(data?.history?.labourForce) &&
      data.history.labourForce.length >= 13 &&
      Array.isArray(data?.history?.vacancies) &&
      data.history.vacancies.length >= 13
    );
  }
  if (section === "nationalDebt" || section === "taxRevenue") {
    return Array.isArray(data?.history) && data.history.length >= 13;
  }
  if (section === "migrationStats") {
    return (
      Array.isArray(data?.history) &&
      data.history.length >= 2 &&
      finite(data?.annualDelta?.immigration) &&
      finite(data?.annualDelta?.emigration) &&
      finite(data?.annualDelta?.netMigration)
    );
  }
  if (section === "nhsStats") {
    return Array.isArray(data?.history) && data.history.length >= 13;
  }
  if (section === "crimeStatistics") {
    const releaseDate = Date.parse(data?.headline?.releaseDate ?? "");
    return (
      Number.isFinite(releaseDate) &&
      now >= releaseDate &&
      now - releaseDate <= 450 * DAY_MS &&
      Array.isArray(data?.crimeSurveyVictimisation?.overall) &&
      data.crimeSurveyVictimisation.overall.length > 0 &&
      Array.isArray(data?.policeRecordedCrime) &&
      data.policeRecordedCrime.length > 0
    );
  }
  return true;
}

export function sanitizePublishedSnapshot(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizePublishedSnapshot);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nestedValue]) => {
      if (key === "backend" || key === "generator") return [];
      if (
        key === "retrieval" &&
        typeof nestedValue === "string" &&
        /github|cloudflare|worker/i.test(nestedValue)
      ) {
        return [[key, "scheduled-publication-check"]];
      }
      return [[key, sanitizePublishedSnapshot(nestedValue)]];
    })
  );
}

export async function buildStaticSnapshot(options) {
  let seed = null;
  if (options.seed) {
    try {
      seed = JSON.parse(
        await readFile(resolve(projectRoot, options.seed), "utf8")
      );
    } catch (error) {
      console.warn(
        `Previous snapshot could not be read: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Collect the fixture-based ingests (election polls from the committed file,
  // plus any --ingest payloads) into a section->record map the resolver reads.
  const ingestRecords = new Map();
  const electionRecord = await electionPollIngest();
  if (electionRecord?.section) {
    ingestRecords.set(electionRecord.section, electionRecord);
  }
  for (const ingestPath of options.ingests) {
    const payload = JSON.parse(
      await readFile(resolve(projectRoot, ingestPath), "utf8")
    );
    if (payload?.section) {
      ingestRecords.set(String(payload.section), {
        section: String(payload.section),
        data: payload.data,
        fetchedAt:
          typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString(),
        sourceLabel: payload.sourceLabel ?? FEED_REGISTRY[payload.section]?.title,
        backend: payload.backend ?? "authenticated-ingest",
      });
    }
  }

  const generatedAt = new Date().toISOString();
  const now = new Date(generatedAt);
  const snapshot = {
    meta: {
      generatedAt,
      registryVersion: FEED_REGISTRY_VERSION,
      sources: {},
    },
  };

  // Build each section directly from the flat SECTION_BUILDERS / live collectors.
  // Calling builders directly (instead of a legacy /all compositor) avoids
  // repeating superseded connectors and avoidable upstream rate limits.
  for (const section of Object.keys(FEED_REGISTRY)) {
    let record = null;
    let buildError = null;
    try {
      record = await resolveSectionRecord(section, ingestRecords, now);
    } catch (error) {
      buildError = error instanceof Error ? error.message : String(error);
    }

    const data = record?.data;
    if (data !== null && data !== undefined) {
      const provenance = data.__provenance ?? provenanceFor(section);
      snapshot[section] = { ...data, __provenance: provenance };
      snapshot.meta.sources[section] = {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: record.fetchedAt ?? null,
        source: FEED_REGISTRY[section].title,
        provenance,
      };
      console.log(`Snapshot section ${section}: fresh`);
      continue;
    }

    if (isUsableSeedSection(seed, section)) {
      snapshot[section] = seed[section];
      snapshot.meta.sources[section] = {
        ...sanitizePublishedSnapshot(seed.meta.sources[section]),
        reusedAt: generatedAt,
      };
      console.warn(`Snapshot section ${section}: reused last verified publication`);
      continue;
    }

    snapshot.meta.sources[section] = {
      status: "error",
      cacheState: "missing",
      fetchedAt: null,
      source: FEED_REGISTRY[section].title,
      error: buildError ?? "Section is not available at snapshot build time",
      provenance: provenanceFor(section),
    };
    console.warn(
      `Snapshot section ${section}: ${snapshot.meta.sources[section].error}`
    );
  }

  const contractsPath = resolve(projectRoot, "data/contracts/find-a-tender-awards.json");
  let contractsPayload = null;
  if (ingestRecords.has("governmentContracts")) {
    contractsPayload = ingestRecords.get("governmentContracts")?.data;
  } else {
    try {
      const raw = await readFile(contractsPath, "utf8");
      const candidate = JSON.parse(raw);
      if (candidate && Array.isArray(candidate.awards) && candidate.awards.length === 100) {
        const { buildCompleteContractsRecord } = await import("./generate-contracts-seed.mjs");
        contractsPayload = buildCompleteContractsRecord(now);
      }
    } catch {
      // Optional contracts fixture is unavailable; fallback or omit.
    }
  }

  if (contractsPayload) {
    snapshot.governmentContracts = contractsPayload;
    snapshot.meta.sources.governmentContracts = {
      status: "ok",
      cacheState: "fresh",
      fetchedAt: contractsPayload.generatedAt,
      source: "Cabinet Office Find a Tender OCDS award releases",
      sourceUrl: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
      provenance: "current-collection",
      publicationRequirement: "optional",
      observationPeriod: contractsPayload.window.label,
      evidenceClass: "official-procurement-data",
    };
    console.log("Snapshot section governmentContracts: fresh");
  }

  snapshot.meta.delivery = "published-snapshot";
  snapshot.meta.publicationPolicy = {
    requiredSections: REQUIRED_PUBLISHED_SECTION_IDS,
    optionalSections: OPTIONAL_PUBLISHED_SECTION_IDS,
  };
  const publishedSnapshot = sanitizePublishedSnapshot(snapshot);
  const verifiedSections = validateSnapshot(
    publishedSnapshot,
    options.minimumVerified,
    REQUIRED_PUBLISHED_SECTION_IDS
  );
  publishedSnapshot.meta.verifiedSections = verifiedSections;

  const outputPath = resolve(projectRoot, options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(publishedSnapshot, null, 2)}\n`,
    "utf8"
  );
  return { outputPath, snapshot: publishedSnapshot, verifiedSections };
}

async function main() {
  const result = await buildStaticSnapshot(parseArgs(process.argv.slice(2)));
  process.stdout.write(
    `Wrote ${result.outputPath} with ${result.verifiedSections.length} verified sections: ${result.verifiedSections.join(", ")}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
