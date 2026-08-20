import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/deploy.yml"),
  "utf8",
);

function productionBody() {
  const marker = "\n  deploy-production:\n";
  const start = workflow.indexOf(marker);
  if (start < 0) throw new Error("Missing deploy-production job");
  return workflow.slice(start);
}

describe("degraded evidence must not block application releases", () => {
  it("deploys the web Worker before requiring a complete static fallback snapshot", () => {
    const production = productionBody();
    const webDeploy = production.indexOf("opennextjs-cloudflare deploy");
    const productionVerify = production.indexOf("node scripts/verify-production.mjs");
    const fallbackCandidate = production.indexOf(
      "node scripts/fetch-cloudflare-publication-candidate.mjs",
    );

    expect(webDeploy).toBeGreaterThan(-1);
    expect(productionVerify).toBeGreaterThan(webDeploy);
    expect(fallbackCandidate).toBeGreaterThan(productionVerify);
  });

  it("keeps a complete Pages seed refresh optional when one evidence source is unavailable", () => {
    const production = productionBody();

    expect(production).toContain("id: pages-seed-candidate");
    expect(production).toContain("continue-on-error: true");
    expect(production).toContain(
      "if: steps.pages-seed-candidate.outcome == 'success'",
    );
  });
});
