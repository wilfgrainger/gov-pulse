import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicMoneyExplorer from "@/app/components/PublicMoneyExplorer";
import type { PublicAward } from "@/app/lib/publicMoney";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function award(key: string, amount: number, buyer: string, supplier: string): PublicAward {
  return {
    rank: 1,
    key,
    ocid: `ocds-h6vhtk-${key}`,
    releaseId: `${key.slice(-6)}-2026`,
    awardId: key,
    title: `Award ${key}`,
    buyer,
    suppliers: [supplier],
    supplierNations: ["Other/Unknown"],
    awardDate: "2026-08-01T00:00:00.000Z",
    publishedAt: "2026-08-02T00:00:00.000Z",
    amount,
    currency: "GBP",
    procurementMethod: "open",
    procurementMethodDetails: null,
    mainProcurementCategory: "services",
    framework: false,
    noticeUrl: `https://www.find-tender.service.gov.uk/Notice/${key.slice(-6)}-2026`,
    procurementUrl: `https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-${key}`,
  };
}

describe("PublicMoneyExplorer name-matched dossiers", () => {
  it("offers bounded exact-name groups with totals and clear identity caveats", () => {
    render(
      <PublicMoneyExplorer
        awards={[
          award("ocds-h6vhtk-111111", 100, "Department A", "Example Ltd"),
          award("ocds-h6vhtk-222222", 250, "Department A", "Example Ltd"),
          award("ocds-h6vhtk-333333", 500, "Department B", "Example Ltd"),
        ]}
        caveats={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Download filtered notices CSV" })).toBeEnabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Open notice dossier" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Exact supplier name: Example Ltd" }));

    expect(screen.getByText("£850")).toBeInTheDocument();
    expect(screen.getByText("3 matched notices · 3 award records in filtered denominator")).toBeInTheDocument();
    expect(screen.getByText(/exact disclosed supplier string only/i)).toBeInTheDocument();
    expect(screen.getByText(/does not prove a shared legal entity/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Notice .*2026/ })).toHaveLength(3);

    fireEvent.change(screen.getByRole("combobox", { name: "Buyer" }), { target: { value: "Department A" } });
    expect(screen.getByText("£350")).toBeInTheDocument();
    expect(screen.queryByText("£850")).not.toBeInTheDocument();
    expect(screen.getByText("2 matched notices · 2 award records in filtered denominator")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Notice .*2026/ })).toHaveLength(2);
  });

  it("downloads only notices in the current buyer filter", async () => {
    const urlApi = {
      createObjectURL: vi.fn(() => "blob:filtered-awards"),
      revokeObjectURL: vi.fn(),
    };
    vi.stubGlobal("URL", urlApi);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(
      <PublicMoneyExplorer
        awards={[
          award("ocds-h6vhtk-111111", 100, "Department A", "Example Ltd"),
          award("ocds-h6vhtk-222222", 250, "Department A", "Example Ltd"),
          award("ocds-h6vhtk-333333", 500, "Department B", "Other Ltd"),
        ]}
        caveats={[]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Buyer" }), { target: { value: "Department A" } });
    fireEvent.click(screen.getByRole("button", { name: "Download filtered notices CSV" }));

    expect(urlApi.createObjectURL).toHaveBeenCalledOnce();
    expect((clickSpy.mock.instances[0] as HTMLAnchorElement | undefined)?.download).toBe("public-money-filtered-awards.csv");
    const exportedBlob = urlApi.createObjectURL.mock.calls[0][0] as Blob;
    const csv = await exportedBlob.text();
    expect(csv).toContain("111111-2026");
    expect(csv).toContain("222222-2026");
    expect(csv).not.toContain("333333-2026");
    expect(csv).toContain("https://www.find-tender.service.gov.uk/Notice/111111-2026");
  });
});
