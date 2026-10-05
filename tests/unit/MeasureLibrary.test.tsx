import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MeasureLibrary, { type MeasureLibraryItem } from "@/app/components/MeasureLibrary";
import { MEASURES } from "@/app/lib/measureDefinitions";
import type { MeasureRecord } from "@/app/lib/measureCatalog";

vi.mock("next/navigation", () => ({ usePathname: () => "/measure" }));

afterEach(cleanup);
beforeEach(() => {
  window.history.replaceState({}, "", "/measure");
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

    fireEvent.click(screen.getByRole("button", { name: "Jobs" }));
    expect(screen.getByRole("link", { name: /Unemployment rate/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Central government receipts/i })).not.toBeInTheDocument();
    expect(window.location.search).toBe("?topic=Jobs");

    fireEvent.change(screen.getByRole("searchbox", { name: /Search measures/i }), { target: { value: "Statistics" } });
    expect(screen.getByRole("link", { name: /Unemployment rate/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /Search measures/i }), { target: { value: "not a publisher" } });
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(/No measure matches/i);
  });

  it("shares topic, publisher, geography, frequency, unit and availability filters", () => {
    const finance: MeasureLibraryItem = {
      ...MEASURES.find((measure) => measure.id === "receipts")!,
      publisher: "HM Treasury",
      availability: "historical",
      observationPeriod: "2026 financial year",
      record: null,
      availabilityReason: "The retained publication is historical.",
    };
    render(<MeasureLibrary measures={[item, finance]} />);

    fireEvent.click(screen.getByRole("button", { name: finance.topic }));
    expect(screen.getByRole("link", { name: /Central government receipts/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Unemployment rate/i })).not.toBeInTheDocument();

    const advanced = screen.getByText("Advanced filters").closest("summary");
    expect(advanced).not.toBeNull();
    fireEvent.click(advanced!);

    const filters = [
      ["publisher", finance.publisher],
      ["geography", finance.geography],
      ["Frequency", finance.cadence],
      ["unit", finance.unit],
    ] as const;

    for (const [label, value] of filters) {
      fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } });
      expect(screen.getByRole("link", { name: /Central government receipts/i })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Unemployment rate/i })).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Historical" }));

    expect(window.location.search).toBe(
      `?topic=Public+finances&publisher=HM+Treasury&geography=United+Kingdom&cadence=monthly&unit=%C2%A3bn&availability=historical`,
    );
  });

  it("keeps topic and availability primary while secondary filters live behind advanced disclosure", () => {
    const unavailable: MeasureLibraryItem = {
      ...MEASURES.find((measure) => measure.id === "waitingPathwaysEstimate")!,
      publisher: "NHS England",
      availability: "unavailable",
      observationPeriod: null,
      record: null,
      availabilityReason: "The source section is unavailable in this edition.",
    };
    render(<MeasureLibrary measures={[item, unavailable]} />);

    expect(screen.getByRole("group", { name: "Topic" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jobs" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("group", { name: "Availability" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Current" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Unavailable" })).toHaveAttribute("aria-pressed", "false");

    const advanced = screen.getByText("Advanced filters").closest("summary");
    expect(advanced).not.toBeNull();
    fireEvent.click(advanced!);
    expect(screen.getByRole("combobox", { name: "publisher" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "geography" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Frequency" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "unit" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "topic" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "availability" })).not.toBeInTheDocument();
  });

  it("renders shared measure filters from the server-provided query", () => {
    const finance: MeasureLibraryItem = {
      ...MEASURES.find((measure) => measure.id === "receipts")!,
      publisher: "HM Treasury",
      availability: "historical",
      observationPeriod: null,
      record: null,
      availabilityReason: "The retained publication is historical.",
    };
    const initialSearch = "publisher=HM+Treasury&availability=historical";
    window.history.replaceState({}, "", `/measure?${initialSearch}`);
    render(<MeasureLibrary measures={[item, finance]} initialSearch={initialSearch} />);

    expect(screen.getByRole("link", { name: /Central government receipts/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Unemployment rate/i })).not.toBeInTheDocument();
  });

  it("restores shared filters after browser back or forward navigation", () => {
    const finance: MeasureLibraryItem = {
      ...MEASURES.find((measure) => measure.id === "receipts")!,
      publisher: "HM Treasury",
      availability: "historical",
      observationPeriod: null,
      record: null,
      availabilityReason: "The retained publication is historical.",
    };
    const initialSearch = "publisher=HM+Treasury";
    window.history.replaceState({}, "", `/measure?${initialSearch}`);
    render(<MeasureLibrary measures={[item, finance]} initialSearch={initialSearch} />);
    expect(screen.queryByRole("link", { name: /Unemployment rate/i })).not.toBeInTheDocument();

    window.history.pushState({}, "", "/measure?topic=Jobs");
    fireEvent.popState(window);

    expect(screen.getByRole("link", { name: /Unemployment rate/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Central government receipts/i })).not.toBeInTheDocument();
  });



  it("does not connect across missing observations in atlas sparklines", () => {
    const gapped: MeasureLibraryItem = {
      ...item,
      record: {
        ...record,
        points: [
          { period: "January 2026", observedAt: "2026-01-31", value: 4.7, valueStatus: "estimate", revisionId: "r1" },
          { period: "February 2026", observedAt: "2026-02-28", value: null, valueStatus: "estimate", revisionId: "r1" },
          { period: "March 2026", observedAt: "2026-03-31", value: 4.8, valueStatus: "estimate", revisionId: "r1" },
        ],
      } as MeasureRecord,
    };
    const { container } = render(<MeasureLibrary measures={[gapped]} />);
    const sparkline = container.querySelector(".measure-atlas-card__sparkline");
    expect(sparkline).not.toBeNull();
    expect(sparkline?.querySelectorAll("polyline")).toHaveLength(0);
    expect(sparkline?.querySelectorAll("circle")).toHaveLength(2);
  });

  it("defaults to an atlas view, can switch to list view, and separates unavailable definitions", () => {
    const unavailable: MeasureLibraryItem = {
      ...MEASURES.find((measure) => measure.id === "waitingPathwaysEstimate")!,
      publisher: "NHS England",
      availability: "unavailable",
      observationPeriod: null,
      record: null,
      availabilityReason: "The source section is unavailable in this edition.",
    };
    render(<MeasureLibrary measures={[item, unavailable]} />);

    expect(screen.getByRole("button", { name: "Atlas view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("measure-results")).toHaveAttribute("data-view", "atlas");
    expect(screen.getByRole("heading", { name: "Verified and retained measures" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unavailable in this edition" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("measure-results")).toHaveAttribute("data-view", "list");
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
