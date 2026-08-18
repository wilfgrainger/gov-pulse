import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const workflowDirectory = join(root, ".github", "workflows");
const deploymentWorkflow = join(workflowDirectory, "deploy.yml");
const violations = [];

function repositoryPath(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function requireText(path, pattern, message) {
  const content = readFileSync(path, "utf8");
  if (!pattern.test(content)) violations.push(message);
}

for (const cnamePath of ["CNAME", "docs/CNAME", "public/CNAME"]) {
  if (existsSync(join(root, cnamePath))) {
    violations.push(
      `${cnamePath} must not exist: public-data.org is hosted by Cloudflare Pages, not GitHub Pages.`
    );
  }
}

if (!existsSync(deploymentWorkflow)) {
  violations.push(".github/workflows/deploy.yml is required for the Cloudflare production release.");
} else {
  requireText(
    deploymentWorkflow,
    /npx wrangler pages deploy \.\/out/,
    "The production workflow must deploy the static export with Wrangler Pages."
  );
  requireText(
    deploymentWorkflow,
    /--project-name public-data-org/,
    "The production workflow must target the public-data-org Cloudflare Pages project."
  );
  requireText(
    deploymentWorkflow,
    /node scripts\/verify-production\.mjs "https:\/\/public-data\.org\/"/,
    "The production workflow must verify the deployed public-data.org revision."
  );
}

if (existsSync(workflowDirectory)) {
  for (const name of readdirSync(workflowDirectory)) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;

    const path = join(workflowDirectory, name);
    const content = readFileSync(path, "utf8");
    const githubPagesMarkers = [
      "actions/configure-pages@",
      "actions/jekyll-build-pages@",
      "actions/upload-pages-artifact@",
      "actions/deploy-pages@",
      "pages: write",
      "environment: github-pages",
      "name: github-pages",
    ];

    for (const marker of githubPagesMarkers) {
      if (content.includes(marker)) {
        violations.push(
          `${repositoryPath(path)} contains ${marker}; GitHub Pages must not publish public-data.org.`
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Cloudflare hosting boundary check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  "Cloudflare hosting boundary verified: Worker + Pages deployment is configured and GitHub Pages publication is absent."
);
