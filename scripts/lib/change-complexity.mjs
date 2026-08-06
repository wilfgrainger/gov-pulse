const SOURCE_LINE_EXEMPT_PREFIXES = ["data/", "public/data/"];

function concernForPath(file) {
  if (file === "package.json" || file === "package-lock.json") return "dependencies";
  if (file.startsWith(".github/")) return "delivery";
  if (file.startsWith(".agents/") || file.startsWith("docs/")) return "governance";
  if (file.startsWith("app/")) return "application";
  if (file.startsWith("worker/")) return "worker";
  if (file.startsWith("scripts/")) return "tooling";
  if (file.startsWith("tests/")) return "tests";
  if (file.startsWith("data/") || file.startsWith("public/data/")) return "evidence-data";
  return "repository";
}

function isSourceLineExempt(file) {
  return SOURCE_LINE_EXEMPT_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function assessChanges(entries) {
  const concerns = new Set(entries.map((entry) => concernForPath(entry.path)));
  const sourceAdditions = entries
    .filter((entry) => !entry.binary && !isSourceLineExempt(entry.path))
    .reduce((total, entry) => total + entry.additions, 0);
  const lockfile = entries.find((entry) => entry.path === "package-lock.json");
  const largest = [...entries]
    .sort(
      (left, right) =>
        right.additions + right.deletions - (left.additions + left.deletions)
    )
    .slice(0, 8);

  const violations = [];
  if (entries.length > 30) violations.push(`changes ${entries.length} files (limit 30)`);
  if (concerns.size > 5) {
    violations.push(
      `mixes ${concerns.size} concern groups (limit 5): ${[...concerns].sort().join(", ")}`
    );
  }
  if (sourceAdditions > 2500) {
    violations.push(`adds ${sourceAdditions} non-data source lines (limit 2500)`);
  }
  if (lockfile && lockfile.additions + lockfile.deletions > 1000) {
    violations.push(
      `rewrites ${lockfile.additions + lockfile.deletions} lockfile lines (limit 1000)`
    );
  }

  return {
    fileCount: entries.length,
    concerns: [...concerns].sort(),
    sourceAdditions,
    largest,
    violations,
  };
}

export { assessChanges, concernForPath };
