import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CountryComparisonFigures from "@/app/components/CountryComparisonFigures";
import { COMPARISON_MEASURE_ORDER, type ComparisonMeasure } from "@/app/lib/internationalComparison";

const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/compare/");
  vi.restoreAllMocks();
  if (createObjectUrlDescriptor) Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (revokeObjectUrlDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

function measures(): Record<string, ComparisonMeasure> {
  const source = {
    publisher: "SIPRI",
    url: "https://www.sipri.org/databases/milex",
    series: "Military expenditure, current US dollars",
    additionalSources: [{ publisher: "World Bank", url: "https://api.worldbank.org/v2/country/GBR/indicator/SP.POP.TOTL", series: "Population" }],
  };
  return Object.fromEntries(COMPARISON_MEASURE_ORDER.map((id) => [id, {
    id,
    label: id,
    definition: "USD per resident",
    unit: "USD per resident",
    rankDirection: "highest-first",
    observationYear: 2024,
    comparableCountryCount: 3,
    countries: [
      { country: "GBR", value: 100, rank: 1, observationYear: 2024, valueType: "estimate", source },
      { country: "USA", value: 90, rank: 2, observationYear: 2024, valueType: "estimate", source },
      { country: "DEU", value: 80, rank: 3, observationYear: 2024, valueType: "estimate", source },
    ],
    countryHistory: [
      { country: "GBR", value: 60, rank: 1, observationYear: 2023, valueType: "historical", source },
      { country: "USA", value: 50, rank: 2, observationYear: 2023, valueType: "historical", source },
      { country: "DEU", value: 40, rank: 3, observationYear: 2023, valueType: "historical", source },
    ],
  }]));
}

describe("shareable country comparison controls", () => {
  it("offers and shares a source-retained common year and exports the selected observations with both sources", async () => {
    render(<CountryComparisonFigures measures={measures()} />);
    await waitFor(() => expect(screen.getByLabelText("Comparison year")).toHaveValue("latest"));
    expect(screen.getByRole("option", { name: "2023 · Historical observation" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Comparison year"), { target: { value: "2023" } });

    await waitFor(() => expect(new URL(window.location.href).searchParams.get("year")).toBe("2023"));
    expect(screen.getByRole("status")).toHaveTextContent(/common year 2023/);
    expect(screen.getAllByText("US$60")).toHaveLength(2);

    let exportedBlob: Blob | null = null;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => { exportedBlob = blob; return "blob:country-comparison"; }),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    await waitFor(() => expect(exportedBlob).toBeInstanceOf(Blob));
    const json = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(exportedBlob!);
    });
    const exported = JSON.parse(json);
    expect(exported.observationWindow.start.period).toBe("2023");
    expect(exported.observations.map((item: { details: { country: string }; values: Record<string, number> }) => [item.details.country, Object.values(item.values)[0]])).toEqual([
      ["GBR", 60], ["USA", 50], ["DEU", 40],
    ]);
    expect(exported.sourceCitation).toContain("Visible denominator: 3 of 3");
    expect(exported.sourceCitation).toContain("https://www.sipri.org/databases/milex");
    expect(exported.sourceCitation).toContain("https://api.worldbank.org/v2/country/GBR/indicator/SP.POP.TOTL");

    fireEvent.change(screen.getByLabelText("Comparison year"), { target: { value: "latest" } });
    await waitFor(() => expect(new URL(window.location.href).searchParams.has("year")).toBe(false));
    expect(screen.getByLabelText("Comparison year")).toHaveValue("latest");
  });

  it("restores URL state and records measure and peer-preset changes", async () => {
    window.history.replaceState({}, "", "/compare/?measure=taxRevenue&countries=GBR%2CUSA&types=estimate");
    render(<CountryComparisonFigures measures={measures()} />);

    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("taxRevenue"));
    expect(screen.getByLabelText("United Kingdom · UK")).toBeChecked();
    expect(screen.getByLabelText("United States")).toBeChecked();
    expect(screen.getByLabelText("Germany")).not.toBeChecked();

    fireEvent.change(screen.getByLabelText("Measure"), { target: { value: "defenceSpending" } });
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("measure")).toBe("defenceSpending"));
    fireEvent.click(screen.getByRole("button", { name: "UK + Europe" }));
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("countries")).toBe("GBR,DEU,FRA,ITA,ESP,IRL,NLD,CHE,POL"));
  });

  it("follows browser back and forward state changes", async () => {
    render(<CountryComparisonFigures measures={measures()} />);
    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("governmentDebt"));

    window.history.replaceState({}, "", "/compare/?measure=healthcareSpending&countries=GBR%2CDEU&types=estimate");
    fireEvent(window, new PopStateEvent("popstate"));

    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("healthcareSpending"));
    expect(screen.getByLabelText("United Kingdom · UK")).toBeChecked();
    expect(screen.getByLabelText("Germany")).toBeChecked();
    expect(screen.getByLabelText("United States")).not.toBeChecked();
  });
});
