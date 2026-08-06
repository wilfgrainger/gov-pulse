import fs from "node:fs";
import process from "node:process";
import {
  isUsableSeedSection,
  validateSnapshot,
} from "./build-static-snapshot.mjs";
import { validateSnapshotAge } from "./snapshot-canary.mjs";
import { verifyProduction } from "./verify-production.mjs";
import { REQUIRED_PUBLISHED_SECTION_IDS } from "../worker/feed-registry.js";
import {
  publicationDecision,
  publicationFingerprint,
} from "./lib/publication-fingerprint.mjs";

function parseArgs(argv) {
  const options = {
    candidate: null,
    previous: null,
    revision: process.env.GITHUB_SHA ?? null,
    productionUrl: "https://public-data.org/",
    eventName: process.env.GITHUB_EVENT_NAME ?? "manual",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--candidate") options.candidate = argv[++index];
    else if (key === "--previous") options.previous = argv[++index];
    else if (key === "--revision") options.revision = argv[++index];
    else if (key === "--production-url") options.productionUrl = argv[++index];
    else if (key === "--event") options.eventName = argv[++index];
    else throw new Error(`Unknown publication decision option '${key}'`);
  }
  if (!options.candidate || !options.revision) {
    throw new Error("--candidate and --revision are required");
  }
  return options;
}

function readJson(path) {
  if (!path || !fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function previousSnapshotIsValid(snapshot, now = Date.now()) {
  if (!snapshot) return false;
  try {
    validateSnapshot(
      snapshot,
      REQUIRED_PUBLISHED_SECTION_IDS.length,
      REQUIRED_PUBLISHED_SECTION_IDS
    );
    validateSnapshotAge(snapshot.meta?.generatedAt, now);
    return REQUIRED_PUBLISHED_SECTION_IDS.every((section) =>
      isUsableSeedSection(snapshot, section, now)
    );
  } catch {
    return false;
  }
}

async function deployedRevisionMatches(url, revision) {
  try {
    await verifyProduction({
      url,
      expectedRevision: revision,
      attempts: 1,
      delayMs: 0,
      log: { info() {}, warn() {} },
    });
    return true;
  } catch {
    return false;
  }
}

function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidate = readJson(options.candidate);
  validateSnapshot(
    candidate,
    REQUIRED_PUBLISHED_SECTION_IDS.length,
    REQUIRED_PUBLISHED_SECTION_IDS
  );

  if (options.eventName !== "schedule") {
    const decision = publicationDecision({ eventName: options.eventName });
    writeOutput("deploy", "true");
    writeOutput("reason", decision.reason);
    console.log(JSON.stringify(decision, null, 2));
    return;
  }

  const previous = readJson(options.previous);
  const previousValid = previousSnapshotIsValid(previous);
  const revisionMatches = await deployedRevisionMatches(
    options.productionUrl,
    options.revision
  );
  const candidateFingerprint = publicationFingerprint(candidate, options.revision);
  const previousFingerprint = previous
    ? publicationFingerprint(previous, options.revision)
    : null;
  const decision = publicationDecision({
    eventName: options.eventName,
    deployedRevisionMatches: revisionMatches,
    previousSnapshotValid: previousValid,
    candidateFingerprint,
    previousFingerprint,
  });

  writeOutput("deploy", String(decision.deploy));
  writeOutput("reason", decision.reason);
  writeOutput("candidate_fingerprint", candidateFingerprint);
  writeOutput("previous_fingerprint", previousFingerprint ?? "missing");

  const report = {
    ...decision,
    eventName: options.eventName,
    deployedRevisionMatches: revisionMatches,
    previousSnapshotValid: previousValid,
    candidateFingerprint,
    previousFingerprint,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Publication decision\n\n- Deploy: ${decision.deploy}\n- Reason: ${decision.reason}\n- Candidate fingerprint: \`${candidateFingerprint}\`\n- Previous fingerprint: \`${previousFingerprint ?? "missing"}\`\n`,
      "utf8"
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
