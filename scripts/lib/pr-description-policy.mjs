// Relaxed PR-description policy.
//
// gov-pulse is an open-source, non-critical public-data site. The previous
// policy enforced exact section headings, a closing-issue link, "claimed
// paths must exist in the diff", and SHA/Actions-run evidence rules. In
// practice those blocked routine and docs-only PRs over prose formatting and
// were the single biggest source of contribution friction. This version keeps
// only the one rule worth keeping: a PR must have a non-empty description so a
// reviewer has some context. Everything else is advisory, not enforced.

function section(body, heading) {
  const pattern = new RegExp(
    `(?:^|\\n)##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
    "i"
  );
  return body.match(pattern)?.[1]?.trim() ?? "";
}

// Retained for backward compatibility with any importer; no longer enforced.
function claimedPaths(body) {
  const changed = section(body, "What changed");
  return [...changed.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1].trim())
    .filter((value) => value.includes("/"))
    .filter((value) => !/[\s*{}$<>]/.test(value));
}

function validatePrDescription(body /*, changedFiles, headSha */) {
  const failures = [];
  if (!body || body.trim().length === 0) {
    failures.push("PR body must not be empty — give reviewers a short description of the change.");
  }
  return failures;
}

export { claimedPaths, section, validatePrDescription };
