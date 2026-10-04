import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { FEED_REGISTRY, PUBLICATION_SOURCE_REGISTRY } from "../worker/feed-registry.js";

const INVENTORY_PATH = "docs/architecture/source-ownership.json";
const ACTIVE_REQUIRED_FIELDS = ["collector", "normalizer", "entrypoint", "schedule", "storage", "fallback"];
const IMPLEMENTATION_FIELDS = ["collector", "normalizer", "entrypoint"];
const WITHDRAWN_REQUIRED_FIELDS = ["consumer", "schedule", "storage", "fallback"];

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function repositoryPathExists(value, projectRoot) {
  return nonEmptyString(value) && fs.existsSync(path.resolve(projectRoot, value));
}

function values(value) {
  return Array.isArray(value) ? value : [value];
}

function uniqueValues(items, field, label, failures) {
  const entries = items.map((item) => item?.[field]);
  if (new Set(entries).size !== entries.length) failures.push(`${label} must contain unique ${field} values`);
  return entries;
}

function implementationLooksLikePath(value) {
  return /[\\/]|\.(?:[cm]?js|tsx?|jsx?|py|json)$/i.test(value);
}

function validateImplementationOwners(value, label, field, projectRoot, failures) {
  const owners = values(value);
  if (owners.length === 0 || owners.some((owner) => !nonEmptyString(owner))) {
    failures.push(`${label}: ${field} must name at least one implementation or describe its owner`);
    return;
  }
  for (const owner of owners) {
    if (implementationLooksLikePath(owner) && !repositoryPathExists(owner, projectRoot)) {
      failures.push(`${label}: ${field} implementation '${owner}' does not exist`);
    }
  }
}

function validateActiveSources(inventory, projectRoot, failures) {
  if (!Array.isArray(inventory.sources)) {
    failures.push("sources must be an array");
    return new Set();
  }

  const expectedSections = Object.keys(FEED_REGISTRY).sort();
  const actualSections = uniqueValues(inventory.sources, "section", "active sources", failures).sort();
  const missing = expectedSections.filter((section) => !actualSections.includes(section));
  const unexpected = actualSections.filter((section) => !expectedSections.includes(section));
  if (missing.length > 0) failures.push(`missing sections: ${missing.join(", ")}`);
  if (unexpected.length > 0) failures.push(`unexpected sections: ${unexpected.join(", ")}`);

  for (const source of inventory.sources) {
    const label = source?.section ?? "unknown active section";
    for (const field of ACTIVE_REQUIRED_FIELDS) {
      const entries = values(source?.[field]);
      if (entries.length === 0 || entries.some((entry) => !nonEmptyString(entry))) {
        failures.push(`${label}: ${field} must be recorded`);
      }
    }
    for (const field of IMPLEMENTATION_FIELDS) {
      validateImplementationOwners(source?.[field], label, field, projectRoot, failures);
    }
  }

  return new Set(actualSections);
}

function validateAdditionalSources(sources, label, projectRoot, failures) {
  if (!Array.isArray(sources)) {
    failures.push(`${label} must be an array`);
    return;
  }
  const expectedSections = Object.keys(PUBLICATION_SOURCE_REGISTRY).sort();
  const actualSections = uniqueValues(sources, "section", label, failures).sort();
  const missing = expectedSections.filter((section) => !actualSections.includes(section));
  const unexpected = actualSections.filter((section) => !expectedSections.includes(section));
  if (missing.length > 0) failures.push(`${label} missing sections: ${missing.join(", ")}`);
  if (unexpected.length > 0) failures.push(`${label} has unregistered sections: ${unexpected.join(", ")}`);
  for (const source of sources) {
    const sourceLabel = source?.section ?? `unknown ${label}`;
    for (const field of ACTIVE_REQUIRED_FIELDS) {
      if (!nonEmptyString(source?.[field])) failures.push(`${sourceLabel}: ${field} must be recorded`);
    }
    for (const field of IMPLEMENTATION_FIELDS) {
      validateImplementationOwners(source?.[field], sourceLabel, field, projectRoot, failures);
    }
    const registeredIds = PUBLICATION_SOURCE_REGISTRY[sourceLabel]?.sourceIds;
    if (registeredIds !== undefined) {
      const recordedIds = source?.sourceIds;
      if (!Array.isArray(recordedIds) || recordedIds.some((id) => !nonEmptyString(id)) ||
        new Set(recordedIds).size !== recordedIds.length ||
        JSON.stringify([...recordedIds].sort()) !== JSON.stringify([...registeredIds].sort())) {
        failures.push(`${sourceLabel}: sourceIds must match the runtime publication source registry`);
      }
    } else if (source?.sourceIds !== undefined) {
      failures.push(`${sourceLabel}: sourceIds are not declared in the runtime publication source registry`);
    }
  }
}

function validateStaticSources(inventory, projectRoot, failures) {
  if (!Array.isArray(inventory.staticSources)) {
    failures.push("staticSources must be an array");
    return;
  }
  uniqueValues(inventory.staticSources, "section", "static sources", failures);
  for (const source of inventory.staticSources) {
    const label = source?.section ?? "unknown static section";
    for (const field of ["consumer", "sourceClass", "observationPeriod", "automation", "fallback"]) {
      if (!nonEmptyString(source?.[field])) failures.push(`${label}: ${field} must be recorded`);
    }
    if (!repositoryPathExists(source?.consumer, projectRoot)) {
      failures.push(`${label}: consumer path '${source?.consumer ?? "missing"}' does not exist`);
    }
    if (!Array.isArray(source?.publishers) || source.publishers.length === 0) {
      failures.push(`${label}: publishers must be a non-empty array`);
    }
    if (!Array.isArray(source?.publications) || source.publications.length === 0) {
      failures.push(`${label}: publications must be a non-empty array`);
    }
    if (!Array.isArray(source?.sourceUrls) || source.sourceUrls.length === 0 || source.sourceUrls.some((url) => !/^https:\/\//i.test(String(url)))) {
      failures.push(`${label}: sourceUrls must contain HTTPS publisher URLs`);
    }
  }
}

function validateWithdrawnSources(inventory, projectRoot, failures) {
  if (!Array.isArray(inventory.withdrawnSources)) {
    failures.push("withdrawnSources must be an array");
    return new Set();
  }
  const sections = uniqueValues(inventory.withdrawnSources, "section", "withdrawn sources", failures);
  for (const source of inventory.withdrawnSources) {
    const label = source?.section ?? "unknown withdrawn section";
    if (source?.collector !== null || source?.normalizer !== null) {
      failures.push(`${label}: withdrawn sources must have null collector and normalizer`);
    }
    for (const field of WITHDRAWN_REQUIRED_FIELDS) {
      if (!nonEmptyString(source?.[field])) failures.push(`${label}: ${field} must be recorded`);
    }
    if (!repositoryPathExists(source?.consumer, projectRoot)) {
      failures.push(`${label}: consumer path '${source?.consumer ?? "missing"}' does not exist`);
    }
    if (source?.schedule !== "none") failures.push(`${label}: withdrawn sources must not schedule current collection`);
  }
  return new Set(sections);
}

function validateWithdrawnRoutes(inventory, activeSections, withdrawnSections, projectRoot, failures) {
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
    if (!repositoryPathExists(route?.consumer, projectRoot)) {
      failures.push(`${label}: consumer path '${route?.consumer ?? "missing"}' does not exist`);
    }
  }
}

function validateSourceOwnership(inventory, projectRoot = process.cwd()) {
  const failures = [];
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return ["source ownership inventory must be an object"];
  }
  const activeSections = validateActiveSources(inventory, projectRoot, failures);
  if (inventory.publicationSources !== undefined) {
    validateAdditionalSources(inventory.publicationSources, "publicationSources", projectRoot, failures);
  }
  validateStaticSources(inventory, projectRoot, failures);
  const withdrawnSections = validateWithdrawnSources(inventory, projectRoot, failures);
  validateWithdrawnRoutes(inventory, activeSections, withdrawnSections, projectRoot, failures);
  if (inventory.browserConsumer && !repositoryPathExists(inventory.browserConsumer, projectRoot)) {
    failures.push(`browserConsumer '${inventory.browserConsumer}' does not exist`);
  }
  return failures;
}

function main(projectRoot = process.cwd()) {
  const inventoryPath = path.join(projectRoot, INVENTORY_PATH);
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  const failures = validateSourceOwnership(inventory, projectRoot);
  if (failures.length > 0) {
    console.error("Source ownership inventory is invalid:\n");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return false;
  }
  console.log(
    `Source ownership verified for ${inventory.sources.length} active sources, ` +
      `${inventory.withdrawnSources.length} withdrawn sources and ${inventory.withdrawnRoutes.length} withdrawn routes.`,
  );
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

export { validateSourceOwnership, main };
