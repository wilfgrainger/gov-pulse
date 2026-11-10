import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDossier, serializePublicAwardsCsv, type PublicAward } from "@/app/lib/publicMoney";
import { buildSummary, isSupplierPlaceholder } from "@/contracts/government-contracts";

const PLACEHOLDER = "See Contracts Finder Notice for full supplier list";

function award(over: Partial<PublicAward> & { key: string }): PublicAward {
  return {
    rank: 1, ocid: "ocds-h6vhtk-000001", releaseId: "100001-2026", awardId: over.key, title: `Award ${over.key}`,
    buyer: "Buyer A", buyerId: "GB-FTS-1", suppliers: ["Real Ltd"], supplierIds: ["GB-COH-1"], supplierNations: ["Other/Unknown"],
    awardDate: "2026-11-01T00:00:00.000Z", publishedAt: "2026-11-01T00:00:00.000Z", amount: 100, currency: "GBP",
    valueBasis: "contract-value", procurementMethod: "open", procurementMethodDetails: null, mainProcurementCategory: "services",
    framework: false, noticeUrl: "https://www.find-tender.service.gov.uk/Notice/100001-2026",
    procurementUrl: "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-000001", ...over,
  };
}

const placeholderAward = award({ key: "p", amount: 9_500, framework: true, suppliers: [PLACEHOLDER], supplierIds: ["GB-FTS-75189"] });
const spend = award({ key: "s", amount: 400, suppliers: ["A Ltd", "B Ltd"], supplierIds: ["GB-COH-A", "GB-COH-B"] });
const ceilingOnly = (key: string) => award({ key, amount: 25, framework: true, releaseId: "105411-2026" });

function csvRows(csv: string) {
  return csv.split("\n").slice(1).map((line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.slice(0, -1).map((cell) => cell.replace(/,$/, "").replace(/^"|"$/g, "")));
}

describe("supplier placeholders", () => {
  it("matches pointers to another document, not organisations", () => {
    expect(isSupplierPlaceholder(PLACEHOLDER)).toBe(true);
    expect(isSupplierPlaceholder("See attached supplier list")).toBe(true);
    expect(isSupplierPlaceholder("SEE Services")).toBe(false);
    expect(isSupplierPlaceholder("Real Ltd")).toBe(false);
  });

  it("builds no supplier dossier and no named supplier for a placeholder, but keeps the notice", () => {
    expect(buildDossier([placeholderAward], "GB-FTS-75189", "supplier", "publisher-id")).toBeNull();
    expect(buildDossier([placeholderAward], PLACEHOLDER, "supplier", "exact-name")).toBeNull();
    expect(buildDossier([placeholderAward], "p", "notice", "notice")).not.toBeNull();
    expect(buildSummary([spend, placeholderAward]).distinctSuppliers).toBe(2);
    expect(buildSummary([placeholderAward, spend]).topSupplier.name).not.toBe(PLACEHOLDER);
  });

  it("states in the CSV that the supplier list is in the source notice", () => {
    const csv = serializePublicAwardsCsv([placeholderAward]);
    expect(csv).toContain("Supplier list published in the source notice");
    expect(csv).not.toContain("GB-FTS-75189");
  });
});

describe("framework ceilings", () => {
  it("are not summed or ranked as award value", () => {
    const summary = buildSummary([placeholderAward, spend]);
    expect(summary.disclosedValueTotal).toBe(400);
    expect(summary.largestAwardValue).toBe(400);
    expect(summary.frameworkAwards).toBe(1);
    expect(buildDossier([placeholderAward, spend], "GB-FTS-1", "buyer", "publisher-id")!.disclosedTotal).toBe(400);
  });
});

describe("filtered-notices CSV", () => {
  it("value column sums to the displayed award values; multi-supplier award counted once", () => {
    const awards = [placeholderAward, ceilingOnly("c1"), ceilingOnly("c2"), spend];
    const csv = serializePublicAwardsCsv(awards);
    const rows = csvRows(csv);
    expect(rows).toHaveLength(4);
    const header = csv.split("\n")[0].split(",");
    const value = header.indexOf("Recorded value");
    const ceiling = header.indexOf("Framework ceiling");
    expect(rows.reduce((sum, row) => sum + Number(row[value] || 0), 0)).toBe(400);
    // the shared ceiling for notice 105411-2026 appears once, not per supplier row
    expect(rows.filter((row) => row[ceiling] === "25")).toHaveLength(1);
    expect(buildDossier(awards, "GB-FTS-1", "buyer", "publisher-id")!.disclosedTotal).toBe(400);
  });
});

const { snapshot } = vi.hoisted(() => ({ snapshot: { value: null as unknown } }));
vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot: vi.fn(async () => snapshot.value) }));
vi.mock("@/app/lib/gateRoute", () => ({ routeEvidenceHeld: () => false }));
vi.mock("@/contracts/government-contracts", async (orig) => ({
  ...(await orig<object>()),
  isCurrentGovernmentContractsPayload: (value: unknown) => Boolean((value as { available?: boolean } | null)?.available),
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));

describe("dossier routes", () => {
  beforeEach(() => { snapshot.value = { governmentContracts: { available: true, awards: [spend] } }; });

  it("404s unknown buyer and supplier ids", async () => {
    const buyer = (await import("@/app/money/buyer/[id]/page")).default;
    const supplier = (await import("@/app/money/supplier/[id]/page")).default;
    await expect(buyer({ params: Promise.resolve({ id: "nonexistent-zz" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(supplier({ params: Promise.resolve({ id: "nonexistent-zz" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("redirects known ids and stays an honest unavailable state when evidence is unavailable", async () => {
    const buyer = (await import("@/app/money/buyer/[id]/page")).default;
    await expect(buyer({ params: Promise.resolve({ id: "GB-FTS-1" }) })).rejects.toThrow("REDIRECT:/money?dossier=buyer%3Apublisher-id%3AGB-FTS-1");
    snapshot.value = null;
    await expect(buyer({ params: Promise.resolve({ id: "nonexistent-zz" }) })).rejects.toThrow("REDIRECT:/money?dossier=");
  });
});
