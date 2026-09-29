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

// Any Markdown or plain-text file anywhere in the tree is documentation: it
// cannot change application behaviour, so it does not need the full build/test
// lane. This widens the cheap "docs" lane to cover root-level planning docs
// (north_star.md, roadmap.md, tasks.md) and any *.md/*.txt added later, which
// previously fell into the expensive "full" lane for no benefit.
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
