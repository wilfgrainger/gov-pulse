import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/deploy.yml"),
  "utf8",
);

function jobBody(name: string) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name} job`);
  const nextJobPattern = /\n  [A-Za-z0-9_-]+:\n/g;
  nextJobPattern.lastIndex = start + marker.length;
  const nextJob = nextJobPattern.exec(workflow)?.index ?? -1;
  return workflow.slice(start, nextJob < 0 ? undefined : nextJob);
}

describe("degraded evidence must not block application releases", () => {
  // Worker deploy and live route verification must succeed independently of
  // the separately gated Pages fallback publication.
  it("deploys Workers before running the Pages fallback boundary", () => {
    const webWorker = jobBody("deploy_web_worker");
    const dataWorker = jobBody("deploy_data_worker");
    const verification = jobBody("verify_production");
    const pages = jobBody("publish_pages");

    expect(webWorker).toContain("opennextjs-cloudflare deploy");
    expect(dataWorker).toContain("npm run worker:deploy");
    expect(verification).toContain("npm run test:release");
    expect(pages).toContain("needs: [release_gate, deploy_web_worker, deploy_data_worker, verify_production, recover_evidence]");
    expect(pages).toContain("npm run pages:build");
    expect(pages).toContain("Trigger the main-only Pages deploy hook");
  });

  it("keeps a complete Pages seed refresh optional when one evidence source is unavailable", () => {
    const pages = jobBody("publish_pages");

    expect(pages).toContain("needs.deploy_web_worker.outputs.publications_paused == 'true'");
    expect(pages).toContain("inputs.refresh_pages_seed == true");
    expect(pages).toContain("anyPublicationEnabled()");
    expect(pages).toContain("CLOUDFLARE_PAGES_DEPLOY_HOOK_URL");
    expect(pages).not.toContain("CLOUDFLARE_API_TOKEN");
  });
});
