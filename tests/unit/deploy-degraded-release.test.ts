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

describe("degraded evidence stays explicit across release boundaries", () => {
  // The web Worker can serve an explicitly degraded edition, but the fallback
  // boundary must still receive a verified current snapshot before deployment.
  it("deploys the web Worker before validating the bounded static fallback snapshot", () => {
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

  it("requires a verified Pages seed refresh when one evidence source is unavailable", () => {
    const production = productionBody();

    expect(production).toContain("id: pages-seed-candidate");
    expect(production).not.toContain("continue-on-error: true");
    expect(production).not.toContain(
      "if: steps.pages-seed-candidate.outcome == 'success'",
    );
    expect(production).toContain(
      "Fetch verified publication for bounded Pages seed fallback",
    );
  });
});
