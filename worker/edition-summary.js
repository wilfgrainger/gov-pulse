function methodChanged(previous, next) {
  return previous.comparisonKey !== next.comparisonKey || previous.evidenceClass !== next.evidenceClass ||
    previous.cadence !== next.cadence || previous.unit !== next.unit || previous.basis !== next.basis ||
    previous.geography.code !== next.geography.code || previous.geography.label !== next.geography.label;
}

function buildEditionSummary(previous, next) {
  const changes = [];
  const previousMeasures = previous?.measures ?? {};
  for (const [measureId, current] of Object.entries(next.measures ?? {})) {
    const old = previousMeasures[measureId];
    if (!old) {
      const latest = current.points?.at(-1);
      if (previous && latest) changes.push({
        measureId, kind: "new-observation", observedAt: latest.observedAt, period: latest.period,
        previousSourceEditionId: null, nextSourceEditionId: current.sourceEditionId,
        previousRevisionId: null, nextRevisionId: latest.revisionId, previous: null, next: latest.value,
      });
      continue;
    }
    const isMethodChange = methodChanged(old, current);
    const oldPoints = new Map((old.points ?? []).map((point) => [point.period, point]));
    for (const point of current.points ?? []) {
      const prior = oldPoints.get(point.period);
      if (!prior) {
        changes.push({
          measureId, kind: isMethodChange ? "method-change" : "new-observation", observedAt: point.observedAt, period: point.period,
          previousSourceEditionId: old.sourceEditionId, nextSourceEditionId: current.sourceEditionId,
          previousRevisionId: null, nextRevisionId: point.revisionId, previous: null, next: point.value,
        });
        continue;
      }
      // A fresh source edition alone does not prove that an observation changed.
      // Point-level revision identities remain attached when publishers disclose them,
      // but value equality is the release-independent signal used for this summary.
      if (prior.value === point.value && !isMethodChange) continue;
      changes.push({
        measureId, kind: isMethodChange ? "method-change" : "revision", observedAt: point.observedAt, period: point.period,
        previousSourceEditionId: old.sourceEditionId, nextSourceEditionId: current.sourceEditionId,
        previousRevisionId: prior.revisionId, nextRevisionId: point.revisionId,
        previous: prior.value, next: point.value,
      });
    }
  }
  const measures = Object.values(next.measures ?? {});
  return {
    id: next.editionId,
    publishedAt: measures.map((measure) => measure.publishedAt).sort().at(-1) ?? next.generatedAt,
    sourceEditionIds: [...new Set(measures.map((measure) => measure.sourceEditionId))].sort(),
    changes: changes.sort((left, right) => (left.observedAt ?? "").localeCompare(right.observedAt ?? "") || left.measureId.localeCompare(right.measureId) || (left.period ?? "").localeCompare(right.period ?? "")),
  };
}

export { buildEditionSummary };
