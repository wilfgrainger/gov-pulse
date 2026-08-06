import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { FEED_REGISTRY } from "../worker/feed-registry.js";

const INVENTORY_PATH = "docs/architecture/source-ownership.json";
const ACTIVE_REQUIRED_FIELDS = [
  "collector",
  "normalizer",
  "entrypoint",
  "schedule",
  "storage",
  "fallback",
];
const WITHDRAWN_REQUIRED_FIELDS = ["consumer", "schedule", "storage", "fallback"];
const STATIC_REQUIRED_SECTIONS = new Set(["earlyYears"]);
const RETIRED_PATHS = new Set([
  "fetch_intel.py",
  "public/daily_threat_data.json",
]);
const EXPECTED_PUBLICATION = Object.freeze({
  publicationArtifact: "cloudflare-kv:v14:publication:public",
  publicRoute: "/data/metrics-snapshot.json",
  livePublicationKey: "v12:publication:current",
  publicPublicationKey: "v14:publication:public",
});

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function existingRepositoryPath(value) {
  return nonEmptyString(value) && fs.existsSync(path.resolve(value));
}

function uniqueValues(items, field, label, failures) {
  const values = items.map((item) => item?.[field]);
  if (new Set(values).size !== values.length) {
    failures.push(`${label} must contain unique ${field} values`);
  }
  return values;
}

function validateActiveSources(inventory, failures) {
  if (!Array.isArray(inventory.sources)) {
    failures.push("sources must be an array");
    return new Set();
  }

  const expectedSections = Object.keys(FEED_REGISTRY).sort();
  const actualSections = uniqueValues(
    inventory.sources,
    "section",
    "active sources",
    failures
  ).sort();
  const missing = expectedSections.filter((section) => !actualSections.includes(section));
  const unexpected = actualSections.filter((section) => !expectedSections.includes(section));
  if (missing.length > 0) failures.push(`missing sections: ${missing.join(", ")}`);
  if (unexpected.length > 0) failures.push(`unexpected sections: ${unexpected.join(", ")}`);

  for (const source of inventory.sources) {
    const label = source?.section ?? "unknown active section";
    for (const field of ACTIVE_REQUIRED_FIELDS) {
      if (!nonEmptyString(source?.[field])) {
        failures.push(`${label}: ${field} must be one path or description`);
      }
      if (Array.isArray(source?.[field])) {
        failures.push(`${label}: ${field} must not contain multiple owners`);
      }
    }
    for (const field of ["collector", "normalizer", "entrypoint"]) {
      if (nonEmptyString(source?.[field]) && !existingRepositoryPath(source[field])) {
        failures.push(`${label}: ${field} path '${source[field]}' does not exist`);
      }
      if (RETIRED_PATHS.has(source?.[field])) {
        failures.push(`${label}: ${field} uses retired path '${source[field]}'`);
      }
    }
  }

  return new Set(actualSections);
}

function validateWithdrawnSources(inventory, failures) {
  if (!Array.isArray(inventory.withdrawnSources)) {
    failures.push("withdrawnSources must be an array");
    return new Set();
  }
  const sections = uniqueValues(
    inventory.withdrawnSources,
    "section",
    "withdrawn sources",
    failures
  );

  for (const source of inventory.withdrawnSources) {
    const label = source?.section ?? "unknown withdrawn section";
    if (source?.collector !== null || source?.normalizer !== null) {
      failures.push(`${label}: withdrawn sources must have null collector and normalizer`);
    }
    for (const field of WITHDRAWN_REQUIRED_FIELDS) {
      if (!nonEmptyString(source?.[field])) {
        failures.push(`${label}: ${field} must be recorded`);
      }
    }
    if (nonEmptyString(source?.consumer) && !existingRepositoryPath(source.consumer)) {
      failures.push(`${label}: consumer path '${source.consumer}' does not exist`);
    }
    if (source?.schedule !== "none" || source?.storage !== "none") {
      failures.push(`${label}: withdrawn sources must not schedule collection or store values`);
    }
  }

  return new Set(sections);
}

function validateStaticSources(inventory, failures) {
  if (!Array.isArray(inventory.staticSources)) {
    failures.push("staticSources must be an array");
    return;
  }

  const sections = uniqueValues(
    inventory.staticSources,
    "section",
    "static sources",
    failures,
  );
  const missing = [...STATIC_REQUIRED_SECTIONS].filter((section) => !sections.includes(section));
  const unexpected = sections.filter((section) => !STATIC_REQUIRED_SECTIONS.has(section));
  if (missing.length > 0) failures.push(`missing static sections: ${missing.join(", ")}`);
  if (unexpected.length > 0) failures.push(`unexpected static sections: ${unexpected.join(", ")}`);

  for (const source of inventory.staticSources) {
    const label = source?.section ?? "unknown static section";
    for (const field of ["consumer", "sourceClass", "observationPeriod", "automation", "fallback"]) {
      if (!nonEmptyString(source?.[field])) failures.push(`${label}: ${field} must be recorded`);
    }
    if (source?.automation !== "static") failures.push(`${label}: automation must be 'static'`);
    if (!existingRepositoryPath(source?.consumer)) {
      failures.push(`${label}: consumer path '${source?.consumer ?? "missing"}' does not exist`);
    }
    if (!Array.isArray(source?.publishers) || source.publishers.length === 0) {
      failures.push(`${label}: publishers must be a non-empty array`);
    }
    if (!Array.isArray(source?.publications) || source.publications.length === 0) {
      failures.push(`${label}: publications must be a non-empty array`);
    }
    if (
      !Array.isArray(source?.sourceUrls) ||
      source.sourceUrls.length === 0 ||
      source.sourceUrls.some((url) => !/^https:\/\//i.test(String(url)))
    ) {
      failures.push(`${label}: sourceUrls must contain HTTPS publisher URLs`);
    }
  }
}

function validateWithdrawnRoutes(inventory, activeSections, withdrawnSections, failures) {
  if (!Array.isArray(inventory.withdrawnRoutes)) {
    failures.push("withdrawnRoutes must be an array");
    return;
  }
  uniqueValues(inventory.withdrawnRoutes, "route", "withdrawn routes", failures);
  for (const route of inventory.withdrawnRoutes) {
    const label = route?.route ?? "unknown withdrawn route";
    if (!nonEmptyString(route?.source)) failures.push(`${label}: source must be recorded`);
    if (!activeSections.has(route?.source) && !withdrawnSections.has(route?.source)) {
      failures.push(`${label}: source '${route?.source ?? "missing"}' is not inventoried`);
    }
    if (!existingRepositoryPath(route?.consumer)) {
      failures.push(`${label}: consumer path '${route?.consumer ?? "missing"}' does not exist`);
    }
  }
}

function validateSimplification(inventory, failures) {
  const simplification = inventory.simplification;
  if (!simplification || typeof simplification !== "object" || Array.isArray(simplification)) {
    failures.push("simplification measurements must be recorded");
    return;
  }

  for (const field of [
    "retiredCollectorImplementations",
    "retiredCollectorLines",
    "workflowFilesRemoved",
    "workflowLinesRemoved",
    "ciJobsRemoved",
    "scheduledRunsPerDayRemoved",
    "testFilesRemoved",
  ]) {
    if (!Number.isInteger(simplification[field]) || simplification[field] < 0) {
      failures.push(`simplification.${field} must be a non-negative integer`);
    }
  }

  if (simplification.retiredCollectorImplementations < 1) {
    failures.push("at least one duplicate collector retirement must be measured");
  }
  if (simplification.workflowFilesRemoved !== simplification.removedDedicatedWorkflows?.length) {
    failures.push("workflowFilesRemoved must match removedDedicatedWorkflows");
  }
  for (const retired of simplification.retiredPaths ?? []) {
    if (!RETIRED_PATHS.has(retired)) failures.push(`unrecognised retired path '${retired}'`);
    if (fs.existsSync(path.resolve(retired))) failures.push(`retired path '${retired}' still exists`);
  }
  for (const workflow of simplification.removedDedicatedWorkflows ?? []) {
    if (fs.existsSync(path.resolve(workflow))) {
      failures.push(`duplicate workflow '${workflow}' still exists`);
    }
  }
}

function validateSourceOwnership(inventory) {
  const failures = [];
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return ["source ownership inventory must be an object"];
  }
  if (inventory.parentIssue !== 208) failures.push("parentIssue must remain 208");
  for (const [field, expected] of Object.entries(EXPECTED_PUBLICATION)) {
    if (inventory[field] !== expected) {
      failures.push(`${field} must be '${expected}'`);
    }
  }
  if (!existingRepositoryPath(inventory.browserConsumer)) {
    failures.push(`browserConsumer '${inventory.browserConsumer ?? "missing"}' does not exist`);
  }

  const activeSections = validateActiveSources(inventory, failures);
  validateStaticSources(inventory, failures);
  const withdrawnSections = validateWithdrawnSources(inventory, failures);
  validateWithdrawnRoutes(inventory, activeSections, withdrawnSections, failures);
  validateSimplification(inventory, failures);
  return failures;
}

const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
const failures = validateSourceOwnership(inventory);
if (failures.length > 0) {
  console.error("Source ownership inventory is invalid:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Source ownership verified for ${inventory.sources.length} active sources, ` +
    `${inventory.withdrawnSources.length} withdrawn sources and ` +
    `${inventory.withdrawnRoutes.length} withdrawn routes.`
);

export { EXPECTED_PUBLICATION, validateSourceOwnership };
