import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicMoneyExplorer from "@/app/components/PublicMoneyExplorer";
import type { PublicAward } from "@/app/lib/publicMoney";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/money");
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
  it("loads and displays the source release sequence on demand for the selected OCID", async () => {
    const selected = award("ocds-h6vhtk-111111", 100, "Department A", "Example Ltd");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ocid: selected.ocid,
      source: {
        publisher: "Cabinet Office",
        service: "Find a Tender",
        packageUrl: `https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/${selected.ocid}`,
        documentationUrl: "https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsRecordPackages",
      },
      releases: [{
        id: "003183-2025",
        date: "2025-01-30T10:00:00.000Z",
        tags: ["tender"],
        title: "eDiscovery solution",
        description: null,
        noticeUrl: "https://www.find-tender.service.gov.uk/Notice/003183-2025",
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicMoneyExplorer awards={[selected]} caveats={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open notice dossier" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load source release history" }));

    await waitFor(() => expect(screen.getByRole("region", { name: "Publisher release history" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(`/data/contracts/history.json?ocid=${selected.ocid}`);
    expect(screen.getByRole("link", { name: /003183-2025.*tender/i })).toHaveAttribute("href", "https://www.find-tender.service.gov.uk/Notice/003183-2025");
    expect(screen.getByText("eDiscovery solution")).toBeInTheDocument();
    expect(screen.getByText(/events may be missing if they were not submitted/i)).toBeInTheDocument();
  });

  it("shows source history as unavailable without exposing fetch details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "private source detail" }), { status: 503 })));
    render(<PublicMoneyExplorer awards={[award("ocds-h6vhtk-111111", 100, "Department A", "Example Ltd")]} caveats={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open notice dossier" }));
    fireEvent.click(screen.getByRole("button", { name: "Load source release history" }));

    expect(await screen.findByText(/publisher release history is temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("private source detail")).not.toBeInTheDocument();
  });

  it("restores filters and publisher-ID dossiers from a shared URL", () => {
    const awards = [
      { ...award("ocds-h6vhtk-111111", 100, "Department A", "Old Supplier Name"), supplierIds: ["supplier-001"], buyerId: "buyer-001" },
      ...Array.from({ length: 19 }, (_, index) => ({
        ...award(`ocds-h6vhtk-${String(index + 4).padStart(6, "0")}`, 50 + index, "Department A", `Fixture Supplier ${index + 1}`),
        supplierIds: [`supplier-${String(index + 2).padStart(3, "0")}`],
        buyerId: "buyer-001",
      })),
      { ...award("ocds-h6vhtk-222222", 250, "Department A", "Renamed Supplier"), supplierIds: ["supplier-001"], buyerId: "buyer-001" },
      { ...award("ocds-h6vhtk-333333", 500, "Department B", "Old Supplier Name"), supplierIds: ["supplier-999"], buyerId: "buyer-999" },
    ];
    window.history.replaceState({}, "", "/money?q=Award&buyer=Department%20A&nation=Other%2FUnknown&page=2");

    const first = render(<PublicMoneyExplorer awards={awards} caveats={[]} />);

    expect(screen.getByRole("searchbox", { name: "Search notices" })).toHaveValue("Award");
    expect(screen.getByRole("combobox", { name: "Buyer" })).toHaveValue("Department A");
    expect(screen.getByRole("combobox", { name: "Supplier nation" })).toHaveValue("Other/Unknown");
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Award ocds-h6vhtk-222222")).toBeInTheDocument();
    expect(screen.queryByText("Award ocds-h6vhtk-111111")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open notice dossier" }));
    fireEvent.click(screen.getByRole("button", { name: "Supplier ID: Renamed Supplier · supplier-001" }));

    expect(screen.getByText("2 matched notices · 21 award records in filtered denominator")).toBeInTheDocument();
    expect(window.location.search).toContain("dossier=supplier%3Apublisher-id%3Asupplier-001");
    expect(screen.getByRole("region", { name: "Award-value timeline" })).toHaveTextContent(/111111-2026.*1 Aug 2026.*£100/);

    first.unmount();
    render(<PublicMoneyExplorer awards={awards} caveats={[]} />);

    expect(screen.getByText("2 matched notices · 21 award records in filtered denominator")).toBeInTheDocument();
    expect(screen.getByText("Publisher supplier ID: supplier-001")).toBeInTheDocument();
  });

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
