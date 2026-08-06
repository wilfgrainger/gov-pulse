import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAVEATS,
  EVIDENCE_POLICY,
  buildGovernmentContractsPayload,
  buildSummary,
} from "../../contracts/government-contracts.js";
import {
  mergeGovernmentContracts,
  selectPayload,
} from "../../scripts/merge-government-contracts-snapshot.mjs";

const NOW = new Date("2026-07-18T12:00:00.000Z");

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

function currentPayload() {
  const awards = Array.from({ length: 100 }, (_, index) => {
    const ocid = `ocds-h6vhtk-${(index + 1).toString(16).padStart(8, "0")}`;
    const releaseId = `${String(200000 + index)}-2026`;
    const awardId = `award-${index + 1}`;
    return {
      rank: index + 1,
      key: `${ocid}:${awardId}`,
      ocid,
      releaseId,
      awardId,
      title: `Government award ${index + 1}`,
      buyer: `Buyer ${(index % 10) + 1}`,
      suppliers: [`Supplier ${(index % 20) + 1}`],
      awardDate: "2026-07-10T09:00:00.000Z",
      publishedAt: "2026-07-10T12:00:00.000Z",
      amount: 500_000_000 - index * 1_000_000,
      currency: "GBP" as const,
      procurementMethod: "open",
      procurementMethodDetails: "Open procedure",
      mainProcurementCategory: "services",
      framework: false,
      noticeUrl: `https://www.find-tender.service.gov.uk/Notice/${releaseId}`,
      procurementUrl: `https://www.find-tender.service.gov.uk/procurement/${ocid}`,
    };
  });
  return buildGovernmentContractsPayload(
    {
      available: true,
      generatedAt: NOW.toISOString(),
      window: {
        updatedFrom: "2026-07-11T00:00:00.000Z",
        updatedTo: "2026-07-17T23:59:59.000Z",
        label: "11 Jul 2026 to 17 Jul 2026",
        basis:
          "Find a Tender award-stage releases from the latest complete seven-day UTC window, collected in six-hour slices",
      },
      source: {},
      summary: buildSummary(awards),
      awards,
      dataQuality: {
        pagesFetched: 28,
        requestsMade: 28,
        releasesSeen: 100,
        awardsSeen: 100,
        validComparableAwards: 100,
        excludedMissingValue: 0,
        excludedNonGbp: 0,
        excludedMissingBuyer: 0,
        excludedMissingSupplier: 0,
        excludedMalformed: 0,
        duplicatesRemoved: 0,
      },
      caveats: [...CAVEATS],
      evidencePolicy: { ...EVIDENCE_POLICY },
    },
    NOW
  );
}

describe("government contracts publication", () => {
  it("selects a current collection before a seed", () => {
    const candidate = currentPayload();
    const olderSeed = { governmentContracts: currentPayload() };

    expect(selectPayload(candidate, olderSeed, NOW)?.provenance).toBe(
      "current-collection"
    );
  });

  it("publishes through the same-origin metrics snapshot", () => {
    const selected = { payload: currentPayload(), provenance: "current-collection" };
    const snapshot = {
      meta: {
        sources: {},
        verifiedSections: ["crimeStatistics"],
      },
    };

    const merged = mergeGovernmentContracts(snapshot, selected, NOW);

    expect(merged.governmentContracts.awards).toHaveLength(100);
    expect(merged.meta.sources.governmentContracts.status).toBe("ok");
    expect(merged.meta.sources.governmentContracts.publicationRequirement).toBe(
      "optional"
    );
    expect(merged.meta.verifiedSections).toContain("governmentContracts");
  });

  it("records an explicit unavailable state instead of partial evidence", () => {
    const snapshot = {
      governmentContracts: currentPayload(),
      meta: {
        sources: { governmentContracts: { status: "ok" } },
        verifiedSections: ["governmentContracts"],
      },
    };

    const merged = mergeGovernmentContracts(snapshot, null, NOW);

    expect(merged.governmentContracts).toBeUndefined();
    expect(merged.meta.sources.governmentContracts.status).toBe("error");
    expect(merged.meta.sources.governmentContracts.cacheState).toBe("missing");
    expect(merged.meta.verifiedSections).not.toContain("governmentContracts");
  });

  it("connects the section to navigation, direct evidence links and deployment", () => {
    const sectionContent = source("app/lib/sectionContent.ts");
    const sections = source("app/lib/sections.ts");
    const presentation = source("app/lib/nationalEvidence.ts");
    const edition = source("app/components/NationalEvidenceEdition.tsx");
    const workflow = source(".github/workflows/deploy.yml");

    expect(sectionContent).toMatch(/["']government-contracts["']:\s*\{/);
    expect(sectionContent).toContain("GovernmentContracts");
    expect(sections).toMatch(/id:\s*["']government-contracts["']/);
    expect(presentation).toContain('href: "/section/government-contracts"');
    expect(presentation).toContain('label: "Government contracts"');
    expect(edition).toContain("DIRECT_EVIDENCE_LINKS");
    expect(workflow).toContain("Deploy Cloudflare data Worker");
    expect(workflow).toContain("public-data-jobs");
    expect(workflow).toContain("fetch-cloudflare-publication-candidate.mjs");
    expect(workflow).toContain(
      "CLOUDFLARE_PUBLICATION_OUTPUT: public/data/metrics-snapshot.json"
    );
    expect(workflow).not.toContain("prepare-government-contracts-ingest.mjs");
    expect(workflow).not.toContain("merge-government-contracts-snapshot.mjs");
  });

  it("keeps UK DOGE independent and evidence-led", () => {
    const component = source("app/components/GovernmentContracts.tsx");

    expect(component).toContain('id="uk-doge"');
    expect(component).toMatch(/not a government body/i);
    expect(component).toMatch(/not affiliated with the US Department of Government Efficiency/i);
    expect(component).toMatch(/not findings of waste, fraud or savings/i);
  });
});
