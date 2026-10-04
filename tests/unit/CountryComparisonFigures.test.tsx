import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    comparableCountryCount: id === "governmentDebt" ? 0 : id === "defenceSpending" ? 3 : 2,
    countries: [
      { country: "GBR", value: id === "governmentDebt" ? null : 100, rank: id === "governmentDebt" ? null : 1, observationYear: 2024, valueType: "estimate", source },
      { country: "USA", value: id === "governmentDebt" ? null : 90, rank: id === "governmentDebt" ? null : 2, observationYear: 2024, valueType: "estimate", source },
      { country: "DEU", value: id === "governmentDebt" ? null : 80, rank: id === "governmentDebt" ? null : 3, observationYear: 2024, valueType: "estimate", source },
    ],
    countryHistory: [
      { country: "GBR", value: 60, rank: 1, observationYear: 2023, valueType: "historical", source },
      { country: "USA", value: 50, rank: 2, observationYear: 2023, valueType: "historical", source },
      { country: "DEU", value: 40, rank: 3, observationYear: 2023, valueType: "historical", source },
    ],
  }]));
}

describe("shareable country comparison controls", () => {
  it("starts on the measure with the strongest published country coverage", async () => {
    render(<CountryComparisonFigures measures={measures()} />);

    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("defenceSpending"));
    expect(screen.getByRole("status")).toHaveTextContent("Visible denominator: 3 of 3");
  });

  it("exports explicit unavailable country rows when no values match", async () => {
    const publishedMeasures = measures();
    publishedMeasures.governmentDebt = {
      ...publishedMeasures.governmentDebt,
      countries: publishedMeasures.governmentDebt.countries.map((row) => ({
        ...row,
        observationYear: 2026,
        exclusionReason: "source-unavailable",
      })),
      countryHistory: [],
    };
    render(<CountryComparisonFigures measures={publishedMeasures} />);
    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("defenceSpending"));
    fireEvent.change(screen.getByLabelText("Measure"), { target: { value: "governmentDebt" } });

    await waitFor(() => expect(screen.getAllByRole("status")[0]).toHaveTextContent("Visible denominator: 0 of 3"));
    expect(screen.getByRole("button", { name: "JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSV" })).toBeInTheDocument();
    expect(screen.queryByText("Download chart as image:")).not.toBeInTheDocument();

    let exportedBlob: Blob | null = null;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => { exportedBlob = blob; return "blob:country-comparison-unavailable"; }),
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
    expect(exported.sourceCitation).toContain("Visible denominator: 0 of 3");
    expect(exported.sourceCitation).toContain("no values matched the selected filters");
    expect(exported.observations.map((item: { observedAt: string | null; values: Record<string, number | null>; details: Record<string, unknown> }) => [
      item.observedAt,
      Object.values(item.values)[0],
      item.details.includedInDenominator,
      item.details.exclusionReason,
    ])).toEqual([
      [null, null, "no", "The source is unavailable"],
      [null, null, "no", "The source is unavailable"],
      [null, null, "no", "The source is unavailable"],
    ]);

    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    await waitFor(() => expect(exportedBlob).toBeInstanceOf(Blob));
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(exportedBlob!);
    });
    expect(csv).toContain("Visible denominator: 0 of 3");
    expect(csv).toContain("The source is unavailable");
  });

  it("shows the published numeric value in the table while keeping chart labels rounded", async () => {
    const publishedMeasures = measures();
    publishedMeasures.defenceSpending = {
      ...publishedMeasures.defenceSpending,
      countries: publishedMeasures.defenceSpending.countries.map((row) =>
        row.country === "GBR" ? { ...row, value: 1969.5458592202074 } : row,
      ),
    };
    render(<CountryComparisonFigures measures={publishedMeasures} />);

    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("defenceSpending"));

    const table = screen.getByRole("table", { name: "Exact selected country observations and denominator" });
    expect(within(table).getByRole("row", { name: /United Kingdom · UK/ })).toHaveTextContent("US$1,969.5458592202074");
    expect(screen.getByText("US$1,970 · 1")).toBeInTheDocument();
  });

  it("translates source exclusion codes into a reader-facing reason", async () => {
    const publishedMeasures = measures();
    const defence = publishedMeasures.defenceSpending;
    publishedMeasures.defenceSpending = {
      ...defence,
      countries: [
        ...defence.countries,
        {
          country: "CHN",
          value: null,
          rank: null,
          observationYear: 2024,
          valueType: "estimate",
          source: null,
          exclusionReason: "not-covered-by-comparable-donor-series",
        },
      ],
    };
    render(<CountryComparisonFigures measures={publishedMeasures} />);
    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("defenceSpending"));

    const excluded = screen.getByText("1 excluded country records");
    fireEvent.click(excluded);

    const details = excluded.closest("details");
    expect(details).toHaveTextContent("China:");
    expect(details).toHaveTextContent("Not covered by the comparable donor series");
    expect(details).not.toHaveTextContent("not-covered-by-comparable-donor-series");
  });

  it("keeps the selected year clear when status filters leave no values", async () => {
    render(<CountryComparisonFigures measures={measures()} />);
    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("defenceSpending"));

    fireEvent.change(screen.getByLabelText("Comparison year"), { target: { value: "2023" } });
    fireEvent.click(screen.getByLabelText("Historical observation"));

    await waitFor(() => expect(screen.getAllByRole("status")[0]).toHaveTextContent("common year 2023"));
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("no values match the selected filters");
    expect(screen.getAllByRole("status")[0]).not.toHaveTextContent("mixed evidence status");
    expect(screen.getAllByRole("status")[0]).not.toHaveTextContent("latest source years may differ");
  });

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
    await waitFor(() => expect(new URL(window.location.href).searchParams.has("measure")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "UK + Europe" }));
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("countries")).toBe("GBR,DEU,FRA,ITA,ESP,IRL,NLD,CHE,POL"));
  });

  it("follows browser back and forward state changes", async () => {
    render(<CountryComparisonFigures measures={measures()} />);
    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("defenceSpending"));

    window.history.replaceState({}, "", "/compare/?measure=healthcareSpending&countries=GBR%2CDEU&types=estimate");
    fireEvent(window, new PopStateEvent("popstate"));

    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("healthcareSpending"));
    expect(screen.getByLabelText("United Kingdom · UK")).toBeChecked();
    expect(screen.getByLabelText("Germany")).toBeChecked();
    expect(screen.getByLabelText("United States")).not.toBeChecked();
  });

  it("replaces URL state restored from a shared link but pushes reader-made changes", async () => {
    window.history.replaceState({}, "", "/compare/");
    window.history.pushState({}, "", "/compare/?measure=defenceSpending&countries=GBR%2CUSA%2CCHN%2CRUS%2CUKR%2CDEU%2CFRA%2CITA%2CESP%2CIRL%2CNLD%2CCHE%2CPOL&types=historical%2Cestimate%2Cprojection&year=latest");
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<CountryComparisonFigures measures={measures()} />);
    await waitFor(() => expect(screen.getByLabelText("Comparison year")).toHaveValue("latest"));
    await waitFor(() => expect(window.location.search).toBe(""));

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Comparison year"), { target: { value: "2023" } });
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("year")).toBe("2023"));
    expect(pushState).toHaveBeenCalledTimes(1);

    replaceState.mockClear();
    window.history.replaceState({}, "", "/compare/?measure=healthcareSpending&countries=GBR%2CUSA&types=estimate&year=latest");
    replaceState.mockClear();
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByLabelText("Measure")).toHaveValue("healthcareSpending"));
    await waitFor(() => expect(window.location.search).toBe("?measure=healthcareSpending&countries=GBR%2CUSA&types=estimate"));

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});
