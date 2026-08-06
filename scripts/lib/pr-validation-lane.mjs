const DOC_ONLY_FILES = new Set([
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  ".github/pull_request_template.md",
]);
const DOC_ONLY_PREFIXES = [".agents/", "docs/", ".github/ISSUE_TEMPLATE/"];

function isDocumentationOnlyPath(file) {
  return (
    DOC_ONLY_FILES.has(file) ||
    DOC_ONLY_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
}

function validationLane(files) {
  if (files.length > 0 && files.every(isDocumentationOnlyPath)) return "docs";
  return "full";
}

export { isDocumentationOnlyPath, validationLane };
