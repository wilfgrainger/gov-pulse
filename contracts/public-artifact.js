function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const PRIVATE_META_FIELDS = Object.freeze([
  "publicationDiagnostics",
  "measureCatalogDiagnostics",
  "publicationState",
  "missingRequiredSections",
  "publicationMode",
  "freeTierBudget",
]);

function publicArtifactProblem(snapshot, options = {}) {
  if (!isRecord(snapshot) || !isRecord(snapshot.meta) || !isRecord(snapshot.meta.sources)) {
    return "Published snapshot does not contain a source manifest";
  }

  if (
    typeof options.registryVersion === "string" &&
    snapshot.meta.registryVersion !== options.registryVersion
  ) {
    return "Published snapshot does not match the repository feed registry";
  }

  for (const field of PRIVATE_META_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(snapshot.meta, field)) {
      return "Published snapshot exposes private publication state";
    }
  }

  if (
    Object.values(snapshot.meta.sources).some((source) =>
      isRecord(source) && Object.prototype.hasOwnProperty.call(source, "error")
    )
  ) {
    return "Published snapshot exposes private publication state";
  }

  const projection = snapshot.meta.publicProjection;
  if (
    !isRecord(projection) ||
    projection.state !== "published" ||
    !Array.isArray(projection.publishedSections) ||
    projection.publishedSections.length === 0 ||
    projection.publishedSections.some((section) => typeof section !== "string" || !section)
  ) {
    return "Published snapshot does not contain a valid public projection";
  }

  const sourceIds = Object.keys(snapshot.meta.sources).sort();
  const projectionIds = [...projection.publishedSections].sort();
  if (
    sourceIds.length === 0 ||
    new Set(projectionIds).size !== projectionIds.length ||
    JSON.stringify(sourceIds) !== JSON.stringify(projectionIds)
  ) {
    return "Published snapshot public projection does not match its source manifest";
  }

  for (const section of sourceIds) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, section)) {
      return "Published snapshot public projection is missing a published section";
    }
  }

  return null;
}

function validatePublicArtifact(snapshot, options = {}) {
  const problem = publicArtifactProblem(snapshot, options);
  if (problem) throw new Error(problem);
  return {
    publishedSections: Object.keys(snapshot.meta.sources).sort(),
  };
}

function isPublicArtifact(snapshot, options = {}) {
  return publicArtifactProblem(snapshot, options) === null;
}

export {
  PRIVATE_META_FIELDS,
  isPublicArtifact,
  isRecord,
  publicArtifactProblem,
  validatePublicArtifact,
};
