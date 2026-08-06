import fs from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("steering and public evidence composition", () => {
  it("keeps the production architecture Cloudflare-only", () => {
    const progress = source(".agents/PROGRESS.md");
    const agents = source("AGENTS.md");
    const combined = `${progress}\n${agents}`;

    expect(combined).toMatch(/Cloudflare Pages/);
    expect(combined).toMatch(/same-origin/);
    expect(combined).toMatch(/Do not (introduce|add) Vercel/i);
    expect(progress).not.toMatch(/GitHub Pages/);
  });

  it("keeps crime and public-money evidence directly discoverable", () => {
    const edition = source("app/components/NationalEvidenceEdition.tsx");
    const presentation = source("app/lib/nationalEvidence.ts");
    const sections = source("app/lib/sections.ts");

    expect(presentation).toContain('href: "/section/crime-stats"');
    expect(presentation).toContain('label: "Crime statistics"');
    expect(presentation).toContain('href: "/section/government-contracts"');
    expect(presentation).toContain('label: "Government contracts"');
    expect(edition).toContain("DIRECT_EVIDENCE_LINKS");
    expect(sections).toMatch(/id:\s*["']crime-stats["']/);
    expect(sections).toMatch(/id:\s*["']government-contracts["']/);
  });

  it("records the V2 publication-first homepage decision", () => {
    const page = source("app/page.tsx");

    expect(source("AGENTS.md")).toMatch(/combined national score/i);
    expect(page).toContain("NationalEvidenceEdition");
    expect(page).not.toContain("EvidenceGroup");
    expect(page).not.toContain("NationalSignalsOverview");
  });

  it("protects crime and public-money evidence boundaries", () => {
    const backlog = source("docs/source-repair-backlog.md");

    expect(source("AGENTS.md")).toMatch(/synthetic crime total/i);
    expect(source("AGENTS.md")).toMatch(/waste, fraud/i);
    expect(backlog).toMatch(/Crime publication discovery/);
    expect(backlog).toMatch(/Deepen government-contract scrutiny/);
    expect(backlog).toMatch(/Find a Tender top-100 award publication/);
    expect(backlog).not.toMatch(/Issue #243 defines the new source contract/);
  });

  it("records the verified procurement release state", () => {
    const progress = source(".agents/PROGRESS.md");

    expect(source("AGENTS.md")).toMatch(/government contracts/i);
    expect(progress).toContain("origin/main");
    expect(progress).toMatch(/deployed at `?[0-9a-f]{40}`?/i);
    expect(progress).toMatch(/site is live and ready/i);
  });
});
