const DOC_ONLY_FILES = new Set([
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  ".github/pull_request_template.md",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
]);
const DOC_ONLY_PREFIXES = [".agents/", "docs/", ".github/ISSUE_TEMPLATE/"];

// Markdown and plain-text files use the cheap docs lane unless they are in a
// code-owning location; the file list and count remain visible in the summary.
const DOC_ONLY_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

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
