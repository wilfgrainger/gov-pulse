import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { readPublicSurfaces } from "./lib/public-surfaces.mjs";

const root = process.cwd();
const workflowDirectory = join(root, ".github", "workflows");
const deploymentWorkflow = join(workflowDirectory, "deploy.yml");
const violations = [];
const surfaces = readPublicSurfaces(root);

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
      `${cnamePath} must not exist: public-data.org must not be published through GitHub Pages.`
    );
  }
}

if (!existsSync(deploymentWorkflow)) {
  violations.push(".github/workflows/deploy.yml is required for the Cloudflare production release.");
} else {
  requireText(
    deploymentWorkflow,
    /opennextjs-cloudflare deploy/,
    "The production workflow must deploy the request-time web Worker with OpenNext."
  );
  requireText(
    deploymentWorkflow,
    /npm run worker:deploy/,
    "The production workflow must deploy the public data Worker."
  );
  requireText(
    deploymentWorkflow,
    /if: github\.event_name == 'workflow_dispatch' && inputs\.refresh_pages_seed/,
    "Cloudflare Pages may only be refreshed through its explicit manual fallback input."
  );
  if (!Array.isArray(surfaces.workerRoutes) || surfaces.workerRoutes.length < 3) {
    violations.push("The approved public Worker route manifest is missing or incomplete.");
  }
  requireText(
    deploymentWorkflow,
    /npm run test:release -- "https:\/\/public-data\.org\/"/,
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
  "Cloudflare hosting boundary verified: request-time site and data are deployed as Workers; Pages is a manual fallback and GitHub Pages publication is absent."
);
