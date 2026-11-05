import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HousingAffordabilityVisual from "@/app/components/visuals/HousingAffordabilityVisual";
import SupplierMarketConcentration from "@/app/components/visuals/SupplierMarketConcentration";
import { GovernmentContractsScrutiny } from "@/app/components/GovernmentContractsScrutiny";
import { FALLBACK, type Award, type ContractsPayload } from "@/app/components/GovernmentContractsShared";

afterEach(cleanup);

const housePrice = [
  { period: "May 2026", observedAt: Date.UTC(2026, 4, 31), value: 1.2 },
  { period: "Jun 2026", observedAt: Date.UTC(2026, 5, 30), value: 1.5 },
  { period: "Sep 2026", observedAt: Date.UTC(2026, 8, 30), value: 1.4 },
];
const realPay = [
  { period: "Mar to May 2026", observedAt: Date.UTC(2026, 4, 31), value: 0.8 },
  { period: "Apr to Jun 2026", observedAt: Date.UTC(2026, 5, 30), value: 1.1 },
];

function renderHousing(hp = housePrice, rp = realPay) {
  return render(
    <HousingAffordabilityVisual
      housePrice={hp}
      realPay={rp}
      hpiPeriod="Sep 2026"
      wagesPeriod="Apr to Jun 2026"
    />
  );
}

function award(rank: number, amount: number, suppliers: string[]): Award {
  return {
    rank,
    key: `k${rank}`,
    ocid: `ocds-${rank}`,
    releaseId: `r${rank}`,
    awardId: `a${rank}`,
    title: `Award title ${rank}`,
    buyer: `Buyer ${rank}`,
    buyerId: null,
    suppliers,
    supplierIds: suppliers.map(() => null),
    supplierNations: suppliers.map(() => "England"),
    awardDate: "2026-07-01T00:00:00Z",
    publishedAt: "2026-07-02T00:00:00Z",
    amount,
    currency: "GBP",
    valueBasis: "award-value",
    procurementMethod: null,
    procurementMethodDetails: null,
    mainProcurementCategory: null,
    framework: false,
    noticeUrl: `https://example.test/n/${rank}`,
    procurementUrl: `https://example.test/p/${rank}`,
  };
}

describe("evidence visuals", () => {
  it("housing visual shows house-price change and real-pay growth as two labelled series, each with period and source", () => {
    const { container } = renderHousing();
    expect(screen.queryByText(/Living Standards Index/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Affordability Gap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Affordability Momentum/i)).not.toBeInTheDocument();

    const hpi = screen.getByRole("group", { name: /House price annual change/i });
    expect(hpi).toHaveTextContent("May 2026 to Sep 2026");
    expect(hpi).toHaveTextContent("ONS UK House Price Index");
    expect(hpi).toHaveTextContent("percent");
    const pay = screen.getByRole("group", { name: /Real regular pay growth/i });
    expect(pay).toHaveTextContent("Mar to May 2026 to Apr to Jun 2026");
    expect(pay).toHaveTextContent("ONS Average Weekly Earnings");
    expect(pay).toHaveTextContent("percent");

    // date-spaced: Sep point is further from Jun than Jun from May
    const xs = Array.from(container.querySelectorAll('circle[data-series="house-price"]')).map((c) => Number(c.getAttribute("cx")));
    expect(xs).toHaveLength(3);
    expect(xs[2] - xs[1]).toBeGreaterThan((xs[1] - xs[0]) * 2);

    fireEvent.click(screen.getByRole("button", { name: /table/i }));
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.getByRole("table", { name: /house price annual change/i })).toBeInTheDocument();
  });

  it("a single-point series renders without NaN coordinates", () => {
    const { container } = renderHousing([housePrice[0]], [realPay[0]]);
    expect(container.innerHTML).not.toMatch(/NaN/);
    expect(container.querySelectorAll("circle").length).toBe(2);
    cleanup();
    const empty = renderHousing([], []);
    expect(empty.container.innerHTML).not.toMatch(/NaN/);
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThan(0);
  });

  it("an award with several suppliers is shown once and lists every supplier, with no equal split", () => {
    const awards = [award(1, 900_000_000, ["Alpha Ltd", "Beta plc", "Gamma LLP"]), award(2, 100_000_000, ["Delta Ltd"])];
    render(<SupplierMarketConcentration awards={awards} totalDisclosedValue={1_000_000_000} top10Share={100} valueBasisLabel="award value" />);
    expect(screen.getAllByText("Award title 1")).toHaveLength(1);
    const item = screen.getByText("Award title 1").closest("li")!;
    for (const name of ["Alpha Ltd", "Beta plc", "Gamma LLP"]) expect(within(item).getByText(name)).toBeInTheDocument();
    expect(screen.queryByText(/equal-share|equal share|scenario|leading supplier/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/£300(\.0)?M/);
  });

  it("top-10 award share and top-5 supplier share each carry their own basis label", () => {
    const awards = Array.from({ length: 12 }, (_, i) => award(i + 1, 100 - i, [`Supplier ${i}`]));
    render(<SupplierMarketConcentration awards={awards} totalDisclosedValue={1000} top10Share={91.5} valueBasisLabel="award value" />);
    const top10 = screen.getByText(/Top 10 awards/i).closest("div")!;
    expect(top10).toHaveTextContent("91.5%");
    expect(top10).toHaveTextContent(/of total disclosed award value/i);
    const top5 = screen.getByText(/Top 5 awards/i).closest("div")!;
    expect(top5).toHaveTextContent(/of total disclosed award value/i);
    expect(screen.queryByText(/supplier groups/i)).not.toBeInTheDocument();
  });

  it("scrutiny banner uses neutral wording and no leading-supplier claim", () => {
    const data = {
      ...FALLBACK,
      awards: [award(1, 500, ["Alpha Ltd", "Beta plc"])],
      supplierConcentration: [],
    } as unknown as ContractsPayload;
    render(<GovernmentContractsScrutiny data={data} />);
    expect(screen.getByRole("heading", { name: /Largest awards by disclosed value/i })).toBeInTheDocument();
    expect(screen.queryByText(/scrutiny start|leading supplier/i)).not.toBeInTheDocument();
  });
});
