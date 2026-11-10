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

// Files whose change can break `output: "export"`; only these PRs pay for a second Next build.
const STATIC_EXPORT_SURFACE = new Set([
  "next.config.ts",
  "scripts/build-edition-site.mjs",
  "app/lib/editionManifest.ts",
  "worker/asset-gate.js",
  "worker/static-wrangler.toml",
  "app/compare/page.tsx",
  "app/measure/page.tsx",
  "app/sources/[id]/page.tsx",
]);

function staticExportCheck(files) {
  return files.some((file) => STATIC_EXPORT_SURFACE.has(file));
}

export { isDocumentationOnlyPath, staticExportCheck, validationLane };
