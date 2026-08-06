const REQUIRED_HEADINGS = ["What changed", "Public impact", "Validation"];
const EVIDENCE_CLAIM = /\b(passed|succeeded|green|deployed|released|production-verified|verified in production)\b/i;
const SHA = /\b[0-9a-f]{40}\b/gi;
const ACTIONS_RUN = /https:\/\/github\.com\/[^\s)]+\/actions\/runs\/\d+/i;

function section(body, heading) {
  const pattern = new RegExp(
    `(?:^|\\n)##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
    "i"
  );
  return body.match(pattern)?.[1]?.trim() ?? "";
}

function claimedPaths(body) {
  const changed = section(body, "What changed");
  return [...changed.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1].trim())
    .filter(
      (value) =>
        value.includes("/") ||
        /^(?:package(?:-lock)?\.json|README\.md|\.nvmrc|\.editorconfig|\.gitattributes)$/i.test(
          value
        )
    )
    .filter((value) => !/[\s*{}$<>]/.test(value));
}

function validatePrDescription(body, changedFiles, headSha = "") {
  const failures = [];
  if (!/(?:closes|fixes|resolves)\s*:?\s*#\d+/i.test(body)) {
    failures.push("PR body must link a closing issue with Closes/Fixes/Resolves #<number>");
  }
  for (const heading of REQUIRED_HEADINGS) {
    if (!section(body, heading)) failures.push(`PR body is missing a non-empty '## ${heading}' section`);
  }

  const changed = new Set(changedFiles);
  for (const path of claimedPaths(body)) {
    const exact = changed.has(path);
    const directory = path.endsWith("/") && [...changed].some((file) => file.startsWith(path));
    if (!exact && !directory) {
      failures.push(`'${path}' is claimed under What changed but is absent from the diff`);
    }
  }

  const validation = section(body, "Validation");
  const normalizedHead = String(headSha).toLowerCase();
  const mentionedShas = [...validation.matchAll(SHA)].map((match) => match[0].toLowerCase());
  const claimsCompletion = EVIDENCE_CLAIM.test(validation);

  if (claimsCompletion) {
    if (!normalizedHead || !mentionedShas.includes(normalizedHead)) {
      failures.push(
        `Completed validation claims must include the exact current head SHA${normalizedHead ? ` ${normalizedHead}` : ""}`
      );
    }
    if (!ACTIONS_RUN.test(validation)) {
      failures.push("Completed validation claims must include a GitHub Actions run URL");
    }
    if (/\b(failed|skipped)\b/i.test(validation)) {
      failures.push("Completed validation claims cannot summarise failed or skipped gates as passed");
    }
  }

  if (normalizedHead && mentionedShas.length > 0 && !mentionedShas.includes(normalizedHead)) {
    failures.push(`Validation evidence is stale; the current PR head is ${normalizedHead}`);
  }

  return failures;
}

export { claimedPaths, section, validatePrDescription };
