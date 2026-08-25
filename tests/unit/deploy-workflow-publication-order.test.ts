import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression for production deploy run 32352473618.
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

  it("fails manual recovery when the selected ref is not main", () => {
    expect(workflow).toContain('test "$GITHUB_REF" = "refs/heads/main"');
  });

  // One production slot should represent the newest reviewed release, never a superseded commit.
  it("lets the newest production release supersede obsolete queued or in-progress releases", () => {
    expect(workflow).toContain("group: public-data-production");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).not.toContain("cancel-in-progress: false");
  });

  it("uses one environment-gated production job for both web and data deployment", () => {
    const production = jobBody("deploy-production");

    expect(workflow).not.toContain("\n  deploy-worker:\n");
    expect(workflow).not.toContain("\n  deploy-web:\n");
    expect(production).toContain("needs: validate-and-build");
    expect(production).toContain("name: cloudflare-internal-worker");
    expect(production).toContain("url: https://public-data.org/");
  });

  it("lets OpenNext perform the production Next.js build it adapts", () => {
    const production = jobBody("deploy-production");

    expect(production).toContain("opennextjs-cloudflare build");
    expect(production).not.toContain("--skipNextBuild");
  });

  it("publishes the data plane and bootstrap before the reader-facing web revision", () => {
    const production = jobBody("deploy-production");
    const serverBuild = production.indexOf("npm run build:check");
    const stagedConfig = production.indexOf(
      "cp worker/open-next.config.template open-next.config.ts"
    );
    const openNextBuild = production.indexOf("opennextjs-cloudflare build");
    const queueReconcile = production.indexOf("Reconcile Cloudflare Queue");
    const dataDeploy = production.indexOf("npm run worker:deploy");
    const workerVerify = production.indexOf("scripts/verify-worker-deployment.mjs");
    const bootstrap = production.indexOf("bootstrap-cloudflare-publication.mjs");
    const openNextDeploy = production.indexOf("opennextjs-cloudflare deploy");
    const contextSmoke = production.indexOf(
      "https://public-data.org/section/uk-in-context/"
    );
    const productionVerify = production.indexOf("node scripts/verify-production.mjs");
    const fallbackCandidate = production.indexOf(
      "node scripts/fetch-cloudflare-publication-candidate.mjs"
    );

    expect(serverBuild).toBeGreaterThan(-1);
    expect(queueReconcile).toBeGreaterThan(-1);
    expect(dataDeploy).toBeGreaterThan(queueReconcile);
    expect(workerVerify).toBeGreaterThan(dataDeploy);
    expect(bootstrap).toBeGreaterThan(workerVerify);
    expect(serverBuild).toBeGreaterThan(bootstrap);
    expect(stagedConfig).toBeGreaterThan(serverBuild);
    expect(openNextBuild).toBeGreaterThan(stagedConfig);
    expect(openNextDeploy).toBeGreaterThan(bootstrap);
    expect(contextSmoke).toBeGreaterThan(openNextDeploy);
    expect(productionVerify).toBeGreaterThan(bootstrap);
    expect(fallbackCandidate).toBeGreaterThan(productionVerify);
    expect(production).toContain(
      "CLOUDFLARE_PUBLICATION_OUTPUT: public/data/metrics-snapshot.json"
    );
    expect(production).toContain("NEXT_PUBLIC_COMMIT_SHA: ${{ github.sha }}");
  });

  it("builds section downloads from the bootstrapped publication before web deployment", () => {
    const production = jobBody("deploy-production");
    const bootstrap = production.indexOf(
      "node scripts/bootstrap-cloudflare-publication.mjs",
    );
    const webSnapshot = production.indexOf(
      "node scripts/fetch-public-snapshot-for-web-build.mjs",
    );
    const firstBuild = production.indexOf("npm run build:check");
    const webBuildStep = production.indexOf(
      "Prepare Next.js server build with current evidence downloads",
    );
    const serverBuild = production.indexOf("npm run build:check", webSnapshot);
    const openNextBuild = production.indexOf("opennextjs-cloudflare build");
    const openNextDeploy = production.indexOf("opennextjs-cloudflare deploy");

    expect(bootstrap).toBeGreaterThan(-1);
    expect(webSnapshot).toBeGreaterThan(bootstrap);
    expect(firstBuild).toBeGreaterThan(-1);
    expect(webBuildStep).toBeGreaterThan(webSnapshot);
    expect(serverBuild).toBeGreaterThan(webSnapshot);
    expect(openNextBuild).toBeGreaterThan(serverBuild);
    expect(openNextDeploy).toBeGreaterThan(openNextBuild);
    expect(production).toContain(
      "METRICS_SNAPSHOT_URL: https://public-data.org/data/metrics-snapshot.json",
    );
    expect(production).toContain(
      "PUBLIC_DATA_EXPECTED_REVISION: ${{ github.sha }}",
    );
  });

  it("refreshes Pages as a verified bounded fallback after full production verification", () => {
    const production = jobBody("deploy-production");
    const productionVerify = production.indexOf("node scripts/verify-production.mjs");
    const fallbackCandidate = production.indexOf(
      "node scripts/fetch-cloudflare-publication-candidate.mjs"
    );
    const seedBuild = production.lastIndexOf("npm run build:check");
    const pagesDeploy = production.indexOf("npx wrangler pages deploy ./out");
    const seedVerify = production.indexOf(
      "https://public-data-org.pages.dev/data/sections/gdpTracker.json"
    );

    expect(workflow).not.toContain("\n  deploy-pages-seed:\n");
    expect(fallbackCandidate).toBeGreaterThan(productionVerify);
    expect(seedBuild).toBeGreaterThan(fallbackCandidate);
    expect(pagesDeploy).toBeGreaterThan(seedBuild);
    expect(seedVerify).toBeGreaterThan(pagesDeploy);
    expect(production).toContain("id: pages-seed-candidate");
    expect(production).not.toContain("continue-on-error: true");
    expect(production).not.toContain(
      "if: steps.pages-seed-candidate.outcome == 'success'",
    );
    expect(production).toContain(
      "Fetch verified publication for bounded Pages seed fallback",
    );
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
    const chromeCheck = validation.indexOf("Verify preinstalled Chrome");
    const browserTests = validation.indexOf("Run deterministic browser tests");

    expect(validation).toContain("timeout-minutes: 20");
    expect(tests).toBeGreaterThan(-1);
    expect(staticBuild).toBeGreaterThan(tests);
    expect(adapterInstall).toBeGreaterThan(staticBuild);
    expect(openNextBuild).toBeGreaterThan(adapterInstall);
    expect(chromeCheck).toBeGreaterThan(openNextBuild);
    expect(browserTests).toBeGreaterThan(chromeCheck);
    expect(validation).toContain('PLAYWRIGHT_PORT: "4173"');
    expect(validation).toContain("run: npm run test:e2e");
  });

  it("verifies the data Worker deployment carries the exact release SHA", () => {
    const production = jobBody("deploy-production");
    expect(production).toContain('--tag "$GITHUB_SHA"');
    expect(production).toContain('--var "PUBLIC_DATA_REVISION:$GITHUB_SHA"');
    expect(production).toContain("--json");
    expect(production).toContain("npx wrangler versions list");
    expect(production).toContain("scripts/verify-worker-deployment.mjs \"$GITHUB_SHA\"");
  });
});
