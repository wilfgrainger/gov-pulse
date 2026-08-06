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

  it("rebuilds Pages from Cloudflare after Worker publication readiness", () => {
    const pages = jobBody("deploy-pages");

    expect(pages).toContain("needs: [validate-and-build, deploy-worker]");
    const fetchCandidate = pages.indexOf(
      "node scripts/fetch-cloudflare-publication-candidate.mjs"
    );
    const finalBuild = pages.indexOf("npm run build:check");
    const pagesDeploy = pages.indexOf("npx wrangler pages deploy ./out");

    expect(fetchCandidate).toBeGreaterThan(-1);
    expect(finalBuild).toBeGreaterThan(fetchCandidate);
    expect(pagesDeploy).toBeGreaterThan(finalBuild);
    expect(pages).toContain(
      "CLOUDFLARE_PUBLICATION_OUTPUT: public/data/metrics-snapshot.json"
    );
    expect(pages).toContain("NEXT_PUBLIC_COMMIT_SHA: ${{ github.sha }}");
  });

  it("does not promote the earlier validation export as the release artifact", () => {
    expect(workflow).not.toContain("actions/upload-artifact");
    expect(workflow).not.toContain("actions/download-artifact");
    expect(workflow).not.toContain("static-export-${{ github.sha }}");

    const validation = jobBody("validate-and-build");
    expect(validation).toContain("npm run test");
    expect(validation).toContain("npm run build:check");
  });

  it("verifies the Worker deployment carries the exact release SHA", () => {
    const worker = jobBody("deploy-worker");
    expect(worker).toContain('--tag "$GITHUB_SHA"');
    expect(worker).toContain("--json");
    expect(worker).toContain("scripts/verify-worker-deployment.mjs \"$GITHUB_SHA\"");
  });
});
