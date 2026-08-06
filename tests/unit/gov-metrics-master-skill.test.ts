import fs from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("agent guidance", () => {
  it("uses Graphite Mountain as the sole repository method", () => {
    const agents = source("AGENTS.md");

    expect(agents).toMatch(/Graphite Mountain.*only/i);
    expect(agents).toMatch(/sequential review/i);
    expect(agents).not.toMatch(/Cave Pony.*sole|Ponytail.*primary|Caveman.*skill/i);
  });

  it("keeps the complete architecture in the root guide", () => {
    const agents = source("AGENTS.md");

    expect(agents).toMatch(/Cron -> Queue jobs -> source collectors/i);
    expect(agents).toContain("same-origin");
    expect(agents).toContain("metrics-snapshot.json");
    expect(agents).toMatch(/repository map/i);
  });

  it("keeps the public-evidence and platform boundaries", () => {
    const combined = source("AGENTS.md");

    for (const boundary of [
      "official primary",
      "fail closed",
      "observation period",
      "publication date",
      "same-origin",
      "Cloudflare Free",
      "accessibility",
      "untrusted input",
      "exact-head",
    ]) {
      expect(combined.toLowerCase()).toContain(boundary.toLowerCase());
    }

    expect(combined).toMatch(/never publish a combined crime total/i);
    expect(combined).toMatch(/Do not add Vercel/i);
  });

  it("keeps standing guidance bounded", () => {
    expect(source("AGENTS.md").split("\n").length).toBeLessThanOrEqual(220);
  });
});
