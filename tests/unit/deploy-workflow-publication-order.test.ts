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

  it("deploys the request-time web Worker only after data publication readiness", () => {
    const web = jobBody("deploy-web");

    expect(web).toContain("needs: [validate-and-build, deploy-worker]");
    const adapterInstall = web.indexOf("npm ci --prefix worker");
    const fetchCandidate = web.indexOf(
      "node scripts/fetch-cloudflare-publication-candidate.mjs"
    );
    const serverBuild = web.indexOf("npm run build:check");
    const stagedConfig = web.indexOf(
      "cp worker/open-next.config.template open-next.config.ts"
    );
    const openNextBuild = web.indexOf("opennextjs-cloudflare build");
    const openNextDeploy = web.indexOf("opennextjs-cloudflare deploy");
    const productionVerify = web.indexOf("node scripts/verify-production.mjs");

    expect(adapterInstall).toBeGreaterThan(-1);
    expect(fetchCandidate).toBeGreaterThan(adapterInstall);
    expect(serverBuild).toBeGreaterThan(fetchCandidate);
    expect(stagedConfig).toBeGreaterThan(serverBuild);
    expect(openNextBuild).toBeGreaterThan(stagedConfig);
    expect(openNextDeploy).toBeGreaterThan(openNextBuild);
    expect(productionVerify).toBeGreaterThan(openNextDeploy);
    expect(web).toContain(
      "CLOUDFLARE_PUBLICATION_OUTPUT: public/data/metrics-snapshot.json"
    );
    expect(web).toContain("NEXT_PUBLIC_COMMIT_SHA: ${{ github.sha }}");
  });

  it("updates Pages only as a bounded seed after the web Worker is verified", () => {
    const pages = jobBody("deploy-pages-seed");

    expect(pages).toContain("needs: [validate-and-build, deploy-worker, deploy-web]");
    expect(pages).toContain("STATIC_EXPORT: \"true\"");
    expect(pages).toContain("npx wrangler pages deploy ./out");
    expect(pages).toContain("https://public-data-org.pages.dev/data/sections/gdpTracker.json");
    expect(pages).not.toContain("verify-production.mjs \"https://public-data.org/\"");
  });

  it("validates from source and a locked OpenNext toolchain instead of promoting an earlier artifact", () => {
    expect(workflow).not.toContain("actions/upload-artifact");
    expect(workflow).not.toContain("actions/download-artifact");
    expect(workflow).not.toContain("static-export-${{ github.sha }}");

    const validation = jobBody("validate-and-build");
    const tests = validation.indexOf("npm run test");
    const staticBuild = validation.indexOf("npm run build:check");
    const adapterInstall = validation.indexOf("npm ci --prefix worker");
    const openNextBuild = validation.indexOf("opennextjs-cloudflare build");

    expect(tests).toBeGreaterThan(-1);
    expect(staticBuild).toBeGreaterThan(tests);
    expect(adapterInstall).toBeGreaterThan(staticBuild);
    expect(openNextBuild).toBeGreaterThan(adapterInstall);
  });

  it("verifies the data Worker deployment carries the exact release SHA", () => {
    const worker = jobBody("deploy-worker");
    expect(worker).toContain('--tag "$GITHUB_SHA"');
    expect(worker).toContain("--json");
    expect(worker).toContain("scripts/verify-worker-deployment.mjs \"$GITHUB_SHA\"");
  });
});
