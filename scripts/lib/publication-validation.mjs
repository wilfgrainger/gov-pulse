import { FEED_REGISTRY_VERSION } from "../../worker/feed-registry.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateSnapshot(
  snapshot,
  minimumVerified = 1,
  requiredSections = []
) {
  if (
    !isRecord(snapshot) ||
    !isRecord(snapshot.meta) ||
    snapshot.meta.registryVersion !== FEED_REGISTRY_VERSION ||
    !isRecord(snapshot.meta.sources)
  ) {
    throw new Error("Published snapshot does not match the repository feed registry");
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
        `${section}=${source?.status ?? "unknown"}/${source?.cacheState ?? "unknown"}`
      )
      .join("; ");
    throw new Error(
      `Published snapshot verified ${verifiedSections.length} sections; ${minimumVerified} required. ${diagnostics}`
    );
  }

  const missingRequiredSections = requiredSections.filter(
    (section) => !verifiedSections.includes(section)
  );
  if (missingRequiredSections.length > 0) {
    throw new Error(
      `Published snapshot is missing required sections: ${missingRequiredSections.join(", ")}`
    );
  }

  return verifiedSections;
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

export function validatePublicProjection(snapshot) {
  const meta = snapshot?.meta;
  if (!isRecord(meta) || !isRecord(meta.sources)) {
    throw new Error("Published snapshot does not contain a source manifest");
  }
  if (
    Object.prototype.hasOwnProperty.call(meta, "publicationDiagnostics") ||
    Object.prototype.hasOwnProperty.call(meta, "measureCatalogDiagnostics") ||
    Object.prototype.hasOwnProperty.call(meta, "publicationState") ||
    Object.prototype.hasOwnProperty.call(meta, "missingRequiredSections") ||
    Object.values(meta.sources).some((source) =>
      isRecord(source) && Object.prototype.hasOwnProperty.call(source, "error")
    )
  ) {
    throw new Error("Published snapshot exposes private publication state");
  }

  const projection = meta.publicProjection;
  if (
    !isRecord(projection) ||
    projection.state !== "published" ||
    !Array.isArray(projection.publishedSections) ||
    projection.publishedSections.some((section) => typeof section !== "string")
  ) {
    throw new Error("Published snapshot does not contain a valid public projection");
  }

  const sourceIds = Object.keys(meta.sources).sort();
  const projectionIds = [...projection.publishedSections].sort();
  if (JSON.stringify(sourceIds) !== JSON.stringify(projectionIds)) {
    throw new Error("Published snapshot public projection does not match its source manifest");
  }

  return { publishedSections: projectionIds };
}
