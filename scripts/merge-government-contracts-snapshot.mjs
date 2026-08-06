import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  FIND_A_TENDER_API,
  isCurrentGovernmentContractsPayload,
} from "../contracts/government-contracts.js";

function parseArguments(argv) {
  const args = {
    snapshot: "public/data/metrics-snapshot.json",
    candidate: "tmp/government-contracts.json",
    seed: "tmp/previous-metrics-snapshot.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--snapshot") args.snapshot = argv[++index];
    else if (argv[index] === "--candidate") args.candidate = argv[++index];
    else if (argv[index] === "--seed") args.seed = argv[++index];
    else throw new Error(`Unknown government contracts merge option '${argv[index]}'`);
  }
  return args;
}

function readJsonIfPresent(file) {
  if (!file || !fs.existsSync(file) || fs.statSync(file).size === 0) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function selectPayload(candidate, seed, now = new Date()) {
  if (isCurrentGovernmentContractsPayload(candidate, now)) {
    return { payload: candidate, provenance: "current-collection" };
  }
  const seedPayload = seed?.governmentContracts;
  if (isCurrentGovernmentContractsPayload(seedPayload, now)) {
    return { payload: seedPayload, provenance: "bounded-last-known-good" };
  }
  return null;
}

function mergeGovernmentContracts(snapshot, selected, now = new Date()) {
  if (!snapshot?.meta?.sources || typeof snapshot.meta.sources !== "object") {
    throw new Error("Metrics snapshot is missing source metadata");
  }
  const existingVerified = Array.isArray(snapshot.meta.verifiedSections)
    ? snapshot.meta.verifiedSections.filter((section) => section !== "governmentContracts")
    : [];

  if (!selected) {
    delete snapshot.governmentContracts;
    snapshot.meta.sources.governmentContracts = {
      status: "error",
      cacheState: "missing",
      fetchedAt: now.toISOString(),
      source: "Cabinet Office Find a Tender OCDS award releases",
      sourceUrl: FIND_A_TENDER_API,
      error: "No current complete top-100 award publication was available",
      publicationRequirement: "optional",
    };
    snapshot.meta.verifiedSections = existingVerified;
    return snapshot;
  }

  const { payload, provenance } = selected;
  snapshot.governmentContracts = payload;
  snapshot.meta.sources.governmentContracts = {
    status: "ok",
    cacheState: "fresh",
    fetchedAt: payload.generatedAt,
    source: "Cabinet Office Find a Tender OCDS award releases",
    sourceUrl: FIND_A_TENDER_API,
    provenance,
    publicationRequirement: "optional",
    observationPeriod: payload.window.label,
    evidenceClass: "official-procurement-data",
  };
  snapshot.meta.verifiedSections = [...new Set([...existingVerified, "governmentContracts"])]
    .sort();
  return snapshot;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const snapshot = readJsonIfPresent(args.snapshot);
  if (!snapshot) throw new Error(`Metrics snapshot '${args.snapshot}' is unavailable`);
  const candidate = readJsonIfPresent(args.candidate);
  const seed = readJsonIfPresent(args.seed);
  const selected = selectPayload(candidate, seed);
  const merged = mergeGovernmentContracts(snapshot, selected);
  fs.writeFileSync(args.snapshot, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        status: selected ? "published" : "unavailable",
        snapshot: args.snapshot,
        provenance: selected?.provenance ?? null,
        awards: selected?.payload?.awards?.length ?? 0,
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { mergeGovernmentContracts, selectPayload };
