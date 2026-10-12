import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { FEED_REGISTRY, PUBLICATION_SOURCE_REGISTRY } from "../worker/feed-registry.js";
import { FEED_CATALOG } from "../contracts/source-catalog.js";
import { PUBLICATION_STATES } from "../contracts/publication-policy.js";

const INVENTORY_PATH = "docs/architecture/source-ownership.json";
const ACTIVE_REQUIRED_FIELDS = ["collector", "normalizer", "entrypoint", "schedule", "storage", "fallback"];
const IMPLEMENTATION_FIELDS = ["collector", "normalizer", "entrypoint"];
const PUBLICATION_CONFIG_PATH = "config/publications.json";
const PUBLIC_SURFACES_PATH = "contracts/public-surfaces.json";

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

function loadJson(relativePath, projectRoot) {
  return JSON.parse(fs.readFileSync(path.resolve(projectRoot, relativePath), "utf8"));
}

function rejectLegacyWithdrawnInventory(inventory, failures) {
  for (const field of ["withdrawnSources", "withdrawnRoutes"]) {
    if (Object.hasOwn(inventory, field)) {
      failures.push(
        `${field} is no longer supported; retired products are removed from runtime ownership and ` +
          `recorded as publication decisions in ${PUBLICATION_CONFIG_PATH}`,
      );
    }
  }
}

function inventoryMembership(inventory) {
  const membership = new Map();
  for (const [list, label] of [["sources", "sources"], ["publicationSources", "publicationSources"], ["staticSources", "staticSources"]]) {
    if (!Array.isArray(inventory[list])) continue;
    for (const source of inventory[list]) {
      const section = source?.section;
      if (!nonEmptyString(section)) continue;
      membership.set(section, [...(membership.get(section) ?? []), label]);
    }
  }
  return membership;
}

// Every catalogued source must be owned by exactly one inventory list, and
// every inventoried section must be a catalogued source.
function validateCatalogCoverage(membership, catalog, failures) {
  for (const [section, lists] of membership) {
    if (lists.length > 1) failures.push(`${section}: inventoried more than once (${lists.join(", ")})`);
    if (!Object.hasOwn(catalog, section)) failures.push(`${section}: not declared in the canonical source catalog`);
  }
  for (const id of Object.keys(catalog)) {
    if (!membership.has(id)) failures.push(`${id}: canonical source is not inventoried`);
  }
}

// Every inventoried source needs exactly one explicit published / held /
// retired decision. Retired products are removed from runtime ownership, so a
// retired decision must not keep a source in the inventory.
function validatePublicationDecisions(membership, publicationConfig, failures) {
  const publications = publicationConfig?.publications;
  if (!publications || typeof publications !== "object" || Array.isArray(publications)) {
    failures.push(`${PUBLICATION_CONFIG_PATH}: publications must be an object`);
    return null;
  }
  for (const [id, decision] of Object.entries(publications)) {
    if (!PUBLICATION_STATES.includes(decision?.state)) {
      failures.push(`${id}: publication state must be one of ${PUBLICATION_STATES.join(", ")}`);
    }
    if (!nonEmptyString(decision?.reasonCode) || !nonEmptyString(decision?.reason)) {
      failures.push(`${id}: publication decision must record reasonCode and reason`);
    }
    if (decision?.sections !== undefined &&
      (!Array.isArray(decision.sections) || decision.sections.some((route) => !nonEmptyString(route)))) {
      failures.push(`${id}: publication sections must be an array of route ids`);
    }
  }
  for (const section of membership.keys()) {
    const decision = publications[section];
    if (!decision) {
      failures.push(`${section}: no publication decision (published, held or retired) is recorded`);
    } else if (decision.state === "retired") {
      failures.push(`${section}: retired sources must be removed from source ownership`);
    }
  }
  return publications;
}

// Every public topic route is claimed by exactly one publication decision, and
// every route a decision claims is a reviewed public topic.
function validateRoutes(publications, surfaces, failures) {
  if (!publications) return;
  if (!Array.isArray(surfaces?.topics)) {
    failures.push(`${PUBLIC_SURFACES_PATH}: topics must be an array`);
    return;
  }
  const topicIds = surfaces.topics.map((topic) => topic?.id);
  if (new Set(topicIds).size !== topicIds.length) failures.push(`${PUBLIC_SURFACES_PATH}: topics must contain unique id values`);
  for (const topic of surfaces.topics) {
    if (topic?.status !== "active") {
      failures.push(`${topic?.id ?? "unknown topic"}: public topic status must be active; retired routes are removed`);
    }
  }

  const owners = new Map();
  for (const [id, decision] of Object.entries(publications)) {
    for (const route of Array.isArray(decision?.sections) ? decision.sections : []) {
      owners.set(route, [...(owners.get(route) ?? []), id]);
    }
  }
  for (const [route, ids] of owners) {
    if (ids.length > 1) failures.push(`route '${route}': claimed by more than one publication decision (${ids.join(", ")})`);
    if (!topicIds.includes(route)) failures.push(`route '${route}': not a reviewed public topic`);
  }
  for (const route of topicIds) {
    if (!owners.has(route)) failures.push(`route '${route}': no publication decision owns this route`);
  }
}

function validateSourceOwnership(
  inventory,
  projectRoot = process.cwd(),
  {
    publicationConfig = loadJson(PUBLICATION_CONFIG_PATH, projectRoot),
    surfaces = loadJson(PUBLIC_SURFACES_PATH, projectRoot),
    catalog = FEED_CATALOG,
  } = {},
) {
  const failures = [];
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return ["source ownership inventory must be an object"];
  }
  validateActiveSources(inventory, projectRoot, failures);
  validateAdditionalSources(inventory.publicationSources, "publicationSources", projectRoot, failures);
  validateStaticSources(inventory, projectRoot, failures);
  rejectLegacyWithdrawnInventory(inventory, failures);
  const membership = inventoryMembership(inventory);
  validateCatalogCoverage(membership, catalog, failures);
  const publications = validatePublicationDecisions(membership, publicationConfig, failures);
  validateRoutes(publications, surfaces, failures);
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
    `Source ownership verified for ${inventory.sources.length} feed sources, ` +
      `${inventory.publicationSources.length} publication sources and ${inventory.staticSources.length} static sources, ` +
      "each with one publication decision and one owner per public route.",
  );
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

export { validateSourceOwnership, main };
