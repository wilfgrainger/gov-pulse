import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/deploy.yml"),
  "utf8"
);

function jobBody(name: string) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) throw new Error(`Missing workflow job ${name}`);

  const remainder = workflow.slice(start + marker.length);
  const nextJob = remainder.search(/\n  [a-z0-9-]+:\n/);
  const end =
    nextJob < 0 ? workflow.length : start + marker.length + nextJob;
  return workflow.slice(start, end);
}

describe("production publication order", () => {
  it("keeps recurring evidence work out of GitHub Actions", () => {
    expect(workflow).not.toMatch(/^\s*schedule:/m);
    expect(workflow).not.toContain("cron:");
  });

  it("uses one environment-gated production job for both web and data deployment", () => {
    const production = jobBody("deploy-production");

    expect(workflow).not.toContain("\n  deploy-worker:\n");
    expect(workflow).not.toContain("\n  deploy-web:\n");
    expect(production).toContain("needs: validate-and-build");
    expect(production).toContain("name: cloudflare-internal-worker");
    expect(production).toContain("url: https://public-data.org/");
  });

  it("puts the reader-facing web revision live before refreshing the data plane", () => {
    const production = jobBody("deploy-production");
    const fetchCandidate = production.indexOf(
      "node scripts/fetch-cloudflare-publication-candidate.mjs"
    );
    const serverBuild = production.indexOf("npm run build:check");
    const stagedConfig = production.indexOf(
      "cp worker/open-next.config.template open-next.config.ts"
    );
    const openNextBuild = production.indexOf("opennextjs-cloudflare build");
    const openNextDeploy = production.indexOf("opennextjs-cloudflare deploy");
    const contextSmoke = production.indexOf(
      "https://public-data.org/section/uk-in-context/"
    );
    const dataDeploy = production.indexOf("npm run worker:deploy");
    const workerVerify = production.indexOf("scripts/verify-worker-deployment.mjs");
    const bootstrap = production.indexOf("bootstrap-cloudflare-publication.mjs");
    const productionVerify = production.indexOf("node scripts/verify-production.mjs");

    expect(fetchCandidate).toBeGreaterThan(-1);
    expect(serverBuild).toBeGreaterThan(fetchCandidate);
    expect(stagedConfig).toBeGreaterThan(serverBuild);
    expect(openNextBuild).toBeGreaterThan(stagedConfig);
    expect(openNextDeploy).toBeGreaterThan(openNextBuild);
    expect(contextSmoke).toBeGreaterThan(openNextDeploy);
    expect(dataDeploy).toBeGreaterThan(contextSmoke);
    expect(workerVerify).toBeGreaterThan(dataDeploy);
    expect(bootstrap).toBeGreaterThan(workerVerify);
    expect(productionVerify).toBeGreaterThan(bootstrap);
    expect(production).toContain(
      "CLOUDFLARE_PUBLICATION_OUTPUT: public/data/metrics-snapshot.json"
    );
    expect(production).toContain("NEXT_PUBLIC_COMMIT_SHA: ${{ github.sha }}");
  });

  it("refreshes Pages only as a bounded fallback after full production verification", () => {
    const production = jobBody("deploy-production");
    const productionVerify = production.indexOf("node scripts/verify-production.mjs");
    const seedBuild = production.lastIndexOf("npm run build:check");
    const pagesDeploy = production.indexOf("npx wrangler pages deploy ./out");
    const seedVerify = production.indexOf(
      "https://public-data-org.pages.dev/data/sections/gdpTracker.json"
    );

    expect(workflow).not.toContain("\n  deploy-pages-seed:\n");
    expect(seedBuild).toBeGreaterThan(productionVerify);
    expect(pagesDeploy).toBeGreaterThan(seedBuild);
    expect(seedVerify).toBeGreaterThan(pagesDeploy);
    expect(production).toContain("STATIC_EXPORT: \"true\"");
  });

  it("validates from source and a locked OpenNext toolchain without Actions artifact storage", () => {
    expect(workflow).not.toContain("actions/upload-artifact");
    expect(workflow).not.toContain("actions/download-artifact");
    expect(workflow).not.toContain("static-export-${{ github.sha }}");

    const validation = jobBody("validate-and-build");
    const tests = validation.indexOf("npm run test");
    const staticBuild = validation.indexOf("npm run build:check");
    const adapterInstall = validation.indexOf("npm ci --prefix worker");
    const openNextBuild = validation.indexOf("opennextjs-cloudflare build");

    expect(validation).toContain("timeout-minutes: 20");
    expect(tests).toBeGreaterThan(-1);
    expect(staticBuild).toBeGreaterThan(tests);
    expect(adapterInstall).toBeGreaterThan(staticBuild);
    expect(openNextBuild).toBeGreaterThan(adapterInstall);
  });

  it("verifies the data Worker deployment carries the exact release SHA", () => {
    const production = jobBody("deploy-production");
    expect(production).toContain('--tag "$GITHUB_SHA"');
    expect(production).toContain("--json");
    expect(production).toContain("scripts/verify-worker-deployment.mjs \"$GITHUB_SHA\"");
  });
});
