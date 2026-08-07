import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const workflowDirectory = join(root, ".github", "workflows");
const deploymentWorkflow = join(workflowDirectory, "deploy.yml");
const webWorkerConfig = join(root, "worker", "web-wrangler.toml");
const openNextConfig = join(root, "worker", "open-next.config.ts");
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
      `${cnamePath} must not exist: public-data.org is hosted by Cloudflare Workers, not GitHub Pages.`
    );
  }
}

if (!existsSync(webWorkerConfig)) {
  violations.push("worker/web-wrangler.toml is required for the request-time frontend.");
} else {
  requireText(
    webWorkerConfig,
    /name\s*=\s*"public-data-web"/,
    "The web Worker must use the public-data-web service name."
  );
  requireText(
    webWorkerConfig,
    /pattern\s*=\s*"public-data\.org\/\*"/,
    "The web Worker must own the public-data.org catch-all route."
  );
}

if (!existsSync(openNextConfig)) {
  violations.push("worker/open-next.config.ts is required for the pinned OpenNext build.");
} else {
  requireText(
    openNextConfig,
    /static-assets-incremental-cache/,
    "OpenNext must use the free, read-only static-assets incremental cache."
  );
}

if (!existsSync(deploymentWorkflow)) {
  violations.push(".github/workflows/deploy.yml is required for the Cloudflare production release.");
} else {
  requireText(
    deploymentWorkflow,
    /npm install --no-save --package-lock=false @opennextjs\/cloudflare@1\.20\.2/,
    "The production workflow must install the exact pinned OpenNext adapter without lockfile churn."
  );
  requireText(
    deploymentWorkflow,
    /cp worker\/open-next\.config\.ts open-next\.config\.ts/,
    "The production workflow must stage the reviewed OpenNext config at the project root."
  );
  requireText(
    deploymentWorkflow,
    /npx --no-install opennextjs-cloudflare deploy[\s\S]*--config worker\/web-wrangler\.toml/,
    "The production workflow must deploy the Next.js frontend with the staged pinned OpenNext adapter."
  );
  requireText(
    deploymentWorkflow,
    /npx wrangler pages deploy \.\/out/,
    "The production workflow must retain the bounded Cloudflare Pages seed fallback."
  );
  requireText(
    deploymentWorkflow,
    /--project-name public-data-org/,
    "The Pages seed must target the public-data-org Cloudflare Pages project."
  );
  requireText(
    deploymentWorkflow,
    /node scripts\/verify-production\.mjs "https:\/\/public-data\.org\/"/,
    "The production workflow must verify the request-time public-data.org revision."
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
  "Cloudflare hosting boundary verified: request-time web Worker + exact data Worker routes + bounded Pages seed; GitHub Pages publication is absent."
);
