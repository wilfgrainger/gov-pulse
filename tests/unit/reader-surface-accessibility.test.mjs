import fs from "node:fs";
import { describe, expect, it } from "vitest";

function source(path) {
  return fs.readFileSync(path, "utf8");
}

describe("V1 reader accessibility and evidence framing", () => {
  it("provides one shared bypass link and focusable main target on every route shell", () => {
    expect(source("app/layout.tsx")).toContain("Skip to main content");
    for (const path of [
      "app/page.tsx",
      "app/section/[id]/page.tsx",
      "app/sources/page.tsx",
      "app/(publication)/[trust]/page.tsx",
    ]) {
      expect(source(path)).toContain('id="main-content"');
      expect(source(path)).toContain("tabIndex={-1}");
    }
  });

  it("keeps high-frequency controls usable at touch size and cues wide tables", () => {
    expect(source("app/components/SocialShare.tsx")).toContain("min-h-11");
    expect(source("app/components/InternationalComparison.tsx")).toContain(
      "Scroll horizontally to compare all columns",
    );
    expect(source("app/components/NationalEvidenceEdition.tsx")).toContain(
      "signal.caveat",
    );
  });

  it("does not label a crime caveat as its measure definition", () => {
    const crime = source("app/components/CrimeStatistics.tsx");
    expect(crime).toContain("definitionFor");
    expect(crime).not.toContain("definition={<p>{module.caveat}</p>}");
  });

  it("uses neutral scrutiny language and honest chart loading language", () => {
    expect(source("app/components/GovernmentContracts.tsx")).not.toContain("UK DOGE");
    expect(source("app/components/GovernmentContracts.tsx")).toContain("Independent scrutiny");
    expect(source("app/components/ClientOnlyChart.tsx")).toContain("Loading interactive chart");
  });
});
