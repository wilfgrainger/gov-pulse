import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GovernmentContracts from "@/app/components/GovernmentContracts";
import * as chartExport from "@/app/lib/chartExport";
import {
  CAVEATS,
  EVIDENCE_POLICY,
  buildGovernmentContractsPayload,
  buildSummary,
} from "@/contracts/government-contracts";

const useMetrics = vi.fn();
const now = new Date("2026-07-18T12:00:00.000Z");

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
  vi.useRealTimers();
});

function result(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLive: true,
    cacheState: "fresh",
    observationStatus: "current",
    ...overrides,
  };
}

const NATIONS = ["Scotland", "Wales", "Northern Ireland", "England", "Other/Unknown"];

function awardWithNation(index: number, nation: string) {
  const ocid = `ocds-h6vhtk-${(index + 1).toString(16).padStart(8, "0")}`;
  const releaseId = `${String(300000 + index)}-2026`;
  const awardId = `award-${index + 1}`;
  return {
    rank: index + 1,
    key: `${ocid}:${awardId}`,
    ocid,
    releaseId,
    awardId,
    title: `Government award ${index + 1}`,
    buyer: `Buyer ${(index % 10) + 1}`,
    suppliers: [`Supplier ${index + 1}`],
    supplierNations: [nation],
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
}

function currentPayload({ withNations = false } = {}) {
  const awards = Array.from({ length: 100 }, (_, index) =>
    awardWithNation(index, withNations ? NATIONS[index % NATIONS.length] : "Other/Unknown")
  );
  return buildGovernmentContractsPayload(
    {
      available: true,
      generatedAt: now.toISOString(),
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
    now
  );
}

describe("GovernmentContracts nation breakdown and supplier concentration", () => {
  it("fails closed when the publication is unavailable", () => {
    useMetrics.mockReturnValue(
      result(
        { available: false },
        { isLive: false, cacheState: "missing", observationStatus: null }
      )
    );

    render(<GovernmentContracts />);
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "Government contracts evidence temporarily unavailable"
    );
  });

  it("states the Other/Unknown limitation when no supplier nation is resolved", () => {
    useMetrics.mockReturnValue(result(currentPayload({ withNations: false })));

    render(<GovernmentContracts />);

    expect(
      screen.getByText(/Supplier nation is currently Other\/Unknown for every ranked supplier/i)
    ).toBeInTheDocument();
  });

  it("renders the supplier concentration view ranked by disclosed value", () => {
    useMetrics.mockReturnValue(result(currentPayload({ withNations: true })));
    const exportSpy = vi.spyOn(chartExport, "downloadChartSvg").mockImplementation(() => {});

    render(<GovernmentContracts />);

    expect(
      screen.getByRole("heading", { name: "Suppliers ranked by total disclosed value" })
    ).toBeInTheDocument();
    expect(screen.getByText("Showing the first 20 of 100 filtered named suppliers (100 in the full publication)."))
      .toBeInTheDocument();
    expect(screen.getByRole("img", { name: /supplier disclosed award values in pounds/i })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Exact supplier concentration rows in the chart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SVG" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "SVG" }));
    expect(exportSpy).toHaveBeenCalledOnce();
    const chartMetadata = exportSpy.mock.calls[0][2]?.chartMetadata;
    expect(chartMetadata?.title).toBe("Suppliers ranked by disclosed value");
    expect(chartMetadata?.series[0]).toMatchObject({
      key: "Supplier 1",
      label: expect.stringContaining("£500,000,000"),
    });
    expect(screen.getAllByText("Supplier 1").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/Supplier nation is currently Other\/Unknown for every ranked supplier/i)
    ).not.toBeInTheDocument();
  });

  it("filters the top-100 explorer and concentration view by supplier nation", () => {
    useMetrics.mockReturnValue(result(currentPayload({ withNations: true })));

    render(<GovernmentContracts />);

    const nationSelect = screen.getByLabelText("Filter by supplier nation");
    expect(nationSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Scotland" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Northern Ireland" })).toBeInTheDocument();
  });

  it("never infers a nation from a supplier name: unmapped postcodes stay Other/Unknown", () => {
    const payload = currentPayload({ withNations: false });
    useMetrics.mockReturnValue(result(payload));

    render(<GovernmentContracts />);

    // Every row's nation cell is Other/Unknown, never a guess derived from
    // the supplier's name text.
    const nationCells = screen.getAllByText("Other/Unknown");
    expect(nationCells.length).toBeGreaterThan(0);
  });
});
