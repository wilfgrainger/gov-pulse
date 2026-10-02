const DOC_ONLY_FILES = new Set([
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  ".github/pull_request_template.md",
]);
const DOC_ONLY_PREFIXES = [];

// Only prose files use the cheap lane. Executable or machine-readable files in
// documentation and agent directories still run the full quality checks.
const DOC_ONLY_EXTENSIONS = new Set([".md", ".markdown"]);

function extensionOf(file) {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot).toLowerCase();
}

function isDocumentationOnlyPath(file) {
  return (
    DOC_ONLY_FILES.has(file) ||
    DOC_ONLY_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    DOC_ONLY_EXTENSIONS.has(extensionOf(file))
  );
}

function validationLane(files) {
  if (files.length > 0 && files.every(isDocumentationOnlyPath)) return "docs";
  return "full";
}

export { isDocumentationOnlyPath, validationLane };
