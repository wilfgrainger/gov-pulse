function durationSeconds(startedAt, completedAt) {
  const start = Date.parse(startedAt ?? "");
  const end = Date.parse(completedAt ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 1000);
}

function median(values) {
  const ordered = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (ordered.length === 0) return null;
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle];
  return Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

function stepSeconds(jobs, names) {
  const accepted = new Set(names);
  return jobs.flatMap((job) =>
    (job.steps ?? [])
      .filter((step) => accepted.has(step.name))
      .map((step) => durationSeconds(step.started_at, step.completed_at))
      .filter(Number.isFinite)
  );
}

export { durationSeconds, median, stepSeconds };
