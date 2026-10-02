import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MeasureLibrary, { type MeasureLibraryItem } from "@/app/components/MeasureLibrary";
import { MEASURES } from "@/app/lib/measureDefinitions";
import type { MeasureRecord } from "@/app/lib/measureCatalog";

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/measure",
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}));

afterEach(cleanup);
beforeEach(() => {
  navigation.params = new URLSearchParams();
  navigation.replace.mockReset();
});

const definition = MEASURES.find((measure) => measure.id === "unemployment")!;
const record = {
  id: "unemployment", label: "Unemployment rate", evidenceClass: "official-statistics",
  comparisonKey: "uk-ilo-unemployment", cadence: "monthly", unit: "%", basis: "Share of the economically active population", geography: { code: "UK", label: "United Kingdom" },
  sourceId: "employmentStats", sourceUrl: "https://www.ons.gov.uk/labour-market", sourceEditionId: "ons-2026-05",
  observationPeriod: { start: "2026-01-01", end: "2026-03-31", label: "Jan to Mar 2026" }, publishedAt: "2026-05-01T00:00:00.000Z", fetchedAt: "2026-05-02T00:00:00.000Z", validUntil: "2026-06-01T00:00:00.000Z", availability: "current", value: 4.8, revisionId: "ons-2026-05",
  points: [{ period: "Jan to Mar 2026", observedAt: "2026-03-31", value: 4.8, valueStatus: "estimate", revisionId: "ons-2026-05" }], caveats: [],
} as MeasureRecord;

const item: MeasureLibraryItem = {
  ...definition,
  publisher: "Office for National Statistics",
  availability: "current",
  observationPeriod: record.observationPeriod.label,
  record,
  availabilityReason: null,
};

describe("measure library", () => {
  it("links a registered measure and shows its verified value and scope", () => {
    render(<MeasureLibrary measures={[item]} />);
    expect(screen.getByRole("link", { name: /Unemployment rate/i })).toHaveAttribute("href", "/measure/unemployment");
    expect(screen.getByText("4.8%")).toBeInTheDocument();
    expect(screen.getByText(/United Kingdom · % · monthly-three-month-average/i)).toBeInTheDocument();
  });

  it("filters the catalog by text and records the filter in shareable URL state", () => {
    const other: MeasureLibraryItem = {
      ...MEASURES.find((measure) => measure.id === "receipts")!,
      publisher: "Office for National Statistics",
      availability: "unavailable",
      observationPeriod: null,
      record: null,
      availabilityReason: "No record passed the source, period and history checks for this edition.",
    };
    render(<MeasureLibrary measures={[item, other]} />);

    fireEvent.change(screen.getByRole("combobox", { name: "topic" }), { target: { value: "Jobs" } });
    expect(screen.getByRole("link", { name: /Unemployment rate/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Central government receipts/i })).not.toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/measure?topic=Jobs", { scroll: false });

    fireEvent.change(screen.getByRole("searchbox", { name: /Search measures/i }), { target: { value: "Statistics" } });
    expect(screen.getByRole("link", { name: /Unemployment rate/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /Search measures/i }), { target: { value: "not a publisher" } });
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(/No measure matches/i);
  });

  it("keeps unavailable definitions discoverable without publishing a value", () => {
    const unavailable: MeasureLibraryItem = {
      ...MEASURES.find((measure) => measure.id === "waitingPathwaysEstimate")!,
      publisher: "NHS England",
      availability: "unavailable",
      observationPeriod: null,
      record: null,
      availabilityReason: "The source section is unavailable in this edition.",
    };
    render(<MeasureLibrary measures={[unavailable]} />);

    expect(screen.getByRole("link", { name: /NHS waiting list/i })).toBeInTheDocument();
    expect(screen.getByText("The source section is unavailable in this edition.")).toBeInTheDocument();
    expect(screen.queryByText(/\b0 pathways\b/)).not.toBeInTheDocument();
  });
});
