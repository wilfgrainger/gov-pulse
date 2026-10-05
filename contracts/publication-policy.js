import PUBLICATION_CONFIG from "../config/publications.json" with { type: "json" };
import definitions from "./measure-definitions.json" with { type: "json" };

/** @typedef {{publications: Record<string, {enabled: boolean, sections?: string[]}>}} PublicationConfig */
/** @param {string} id @param {PublicationConfig} config */
function publicationEnabled(id, config = PUBLICATION_CONFIG) {
  return Object.hasOwn(config.publications, id) && config.publications[id]?.enabled === true;
}
/** @param {PublicationConfig} config */
function anyPublicationEnabled(config = PUBLICATION_CONFIG) {
  return Object.values(config.publications).some((entry) => entry.enabled === true);
}
/** @param {string} id @param {PublicationConfig} config */
function sectionPublication(id, config = PUBLICATION_CONFIG) {
  return Object.entries(config.publications).find(([, entry]) => entry.sections?.includes(id))?.[0] ?? "";
}
/** @param {string} path @param {PublicationConfig} config */
function publicationRouteEnabled(path, config = PUBLICATION_CONFIG) {
  const pathname = path.split("?")[0].replace(/\/$/, "");
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "section") return publicationEnabled(sectionPublication(parts[1], config), config);
  if (parts[0] === "money") return publicationEnabled("governmentContracts", config);
  if (parts[0] === "editions") return publicationEnabled("editionArchive", config);
  if (parts[0] === "stories") return publicationEnabled({ "household-budgets": "storyHouseholdBudgets", "public-finances": "storyPublicFinances" }[parts[1]] ?? "", config);
  if (parts[0] === "measure" && parts[1]) return publicationEnabled(definitions.measures.find((entry) => entry.id === parts[1])?.section ?? "", config);
  if (parts[0] === "sources" && parts[1]) return publicationEnabled(parts[1], config);
  if (parts[0] === "calendar") return publicationEnabled("releaseCalendar", config) || publicationEnabled("nhsReleaseCalendar", config);
  if (["explore", "measure", "compare", "briefing", "cost-of-living", "sources"].includes(parts[0]) || parts.length === 0) return anyPublicationEnabled(config);
  return true;
}

/** @param {any} catalog @param {PublicationConfig} config */
function filterPublicationCatalog(catalog, config = PUBLICATION_CONFIG) {
  if (!catalog?.measures) return null;
  return { ...catalog, measures: Object.fromEntries(Object.entries(catalog.measures).filter(([, measure]) => publicationEnabled(measure.sourceId, config))) };
}
/** @param {any} summary @param {PublicationConfig} config */
function filterPublicationSummary(summary, config = PUBLICATION_CONFIG, catalog = null) {
  const changes = (summary?.changes ?? []).filter((change) => publicationEnabled(catalog?.measures?.[change.measureId]?.sourceId ?? definitions.measures.find((measure) => measure.id === change.measureId)?.section ?? "", config));
  return { id: summary.id, publishedAt: summary.publishedAt, ...(summary.asOf ? { asOf: summary.asOf } : {}), ...(summary.previousEditionId !== undefined ? { previousEditionId: summary.previousEditionId } : {}),
    ...(changes.length === summary.changes?.length && summary.summaryCorrection ? { summaryCorrection: summary.summaryCorrection } : {}),
    sourceEditionIds: [...new Set(changes.map((change) => change.nextSourceEditionId))], changes };
}
/** @param {any} input @param {PublicationConfig} config */
function filterPublicationSnapshot(input, config = PUBLICATION_CONFIG) {
  if (!input?.meta?.sources) return null;
  const sources = Object.fromEntries(Object.entries(input.meta.sources).filter(([id]) => publicationEnabled(id, config)));
  if (Object.keys(sources).length === 0) return null;
  const snapshot = { meta: { registryVersion: input.meta.registryVersion, generatedAt: input.meta.generatedAt, sources,
    ...(input.meta.publicationState ? { publicationState: input.meta.publicationState } : {}),
    ...(input.meta.missingRequiredSections ? { missingRequiredSections: input.meta.missingRequiredSections.filter((id) => publicationEnabled(id, config)) } : {}),
    verifiedSections: (input.meta.verifiedSections ?? []).filter((id) => Object.hasOwn(sources, id)),
    measureCatalog: filterPublicationCatalog(input.meta.measureCatalog, config),
    ...(publicationEnabled("editionArchive", config) && input.meta.editionSummary ? { editionSummary: filterPublicationSummary(input.meta.editionSummary, config, input.meta.measureCatalog) } : {}),
  } };
  for (const id of Object.keys(sources)) if (Object.hasOwn(input, id)) snapshot[id] = structuredClone(input[id]);
  return snapshot;
}

export { PUBLICATION_CONFIG, publicationEnabled, anyPublicationEnabled, sectionPublication, publicationRouteEnabled, filterPublicationCatalog, filterPublicationSummary, filterPublicationSnapshot };
