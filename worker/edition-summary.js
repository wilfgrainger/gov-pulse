function changedFields(previous, next, fields) {
  return fields.filter(([, get]) => JSON.stringify(get(previous)) !== JSON.stringify(get(next))).map(([path]) => path);
}

const METHOD_FIELDS = [
  ["comparisonKey", (measure) => measure.comparisonKey],
  ["evidenceClass", (measure) => measure.evidenceClass],
  ["cadence", (measure) => measure.cadence],
  ["unit", (measure) => measure.unit],
  ["basis", (measure) => measure.basis],
  ["geography.code", (measure) => measure.geography.code],
  ["geography.label", (measure) => measure.geography.label],
];

const METADATA_FIELDS = [
  ["label", (measure) => measure.label],
  ["publisher", (measure) => measure.publisher ?? null],
  ["sourceId", (measure) => measure.sourceId],
  ["sourceUrl", (measure) => measure.sourceUrl],
  ["publishedAt", (measure) => measure.publishedAt],
  ["note", (measure) => measure.note ?? null],
  ["caveats", (measure) => measure.caveats ?? []],
  ["observationPeriod.label", (measure) => measure.observationPeriod.label],
];

function pointIdentity(measure, point) {
  return [measure.id, measure.geography.code, point.period, point.observedAt, measure.unit, measure.comparisonKey, measure.basis].join("\u001f");
}

function changeRecord(kind, measureId, previous, next, priorPoint = null, nextPoint = null, fields = []) {
  return {
    measureId,
    kind,
    observedAt: nextPoint?.observedAt ?? priorPoint?.observedAt ?? null,
    period: nextPoint?.period ?? priorPoint?.period ?? null,
    previousSourceEditionId: previous?.sourceEditionId ?? null,
    nextSourceEditionId: next.sourceEditionId,
    previousRevisionId: priorPoint?.revisionId ?? previous?.revisionId ?? null,
    nextRevisionId: nextPoint?.revisionId ?? next.revisionId,
    previousSourcePublishedAt: previous?.publishedAt ?? null,
    nextSourcePublishedAt: next.publishedAt,
    previousSourceUrl: previous?.sourceUrl ?? null,
    nextSourceUrl: next.sourceUrl,
    previousUnit: previous?.unit ?? null,
    nextUnit: next.unit,
    previous: priorPoint?.value ?? null,
    next: nextPoint?.value ?? null,
    ...(fields.length ? { changedFields: fields } : {}),
  };
}

function buildEditionSummary(previous, next) {
  const changes = [];
  const previousMeasures = previous?.measures ?? {};
  for (const [measureId, current] of Object.entries(next.measures ?? {})) {
    const old = previousMeasures[measureId];
    if (!old) {
      const latest = current.points?.at(-1);
      if (previous && latest) changes.push(changeRecord("new-observation", measureId, null, current, null, latest));
      continue;
    }
    const methods = changedFields(old, current, METHOD_FIELDS);
    const metadata = changedFields(old, current, METADATA_FIELDS);
    if (methods.length) changes.push(changeRecord("method-change", measureId, old, current, null, null, methods));
    if (metadata.length) changes.push(changeRecord("metadata-change", measureId, old, current, null, null, metadata));
    if (methods.length) {
      continue;
    }
    const oldPoints = new Map((old.points ?? []).map((point) => [pointIdentity(old, point), point]));
    for (const point of current.points ?? []) {
      const prior = oldPoints.get(pointIdentity(current, point));
      if (!prior) {
        changes.push(changeRecord("new-observation", measureId, old, current, null, point));
        continue;
      }
      // A fresh source edition alone does not prove that an observation changed.
      // Point-level revision identities remain attached when publishers disclose them,
      // but value equality is the release-independent signal used for this summary.
      if (prior.value === point.value) continue;
      changes.push(changeRecord("revision", measureId, old, current, prior, point));
    }
  }
  const measures = Object.values(next.measures ?? {});
  return {
    id: next.editionId,
    previousEditionId: previous?.editionId ?? null,
    publishedAt: measures.map((measure) => measure.publishedAt).sort().at(-1) ?? next.generatedAt,
    sourceEditionIds: [...new Set(measures.map((measure) => measure.sourceEditionId))].sort(),
    changes: changes.sort((left, right) => (right.observedAt ?? "").localeCompare(left.observedAt ?? "") || left.measureId.localeCompare(right.measureId) || (left.period ?? "").localeCompare(right.period ?? "")),
  };
}

export { buildEditionSummary };
