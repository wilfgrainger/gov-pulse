import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ComparisonStudio from "@/app/components/ComparisonStudio";
import type { MeasureCatalog, MeasureRecord } from "@/app/lib/measureCatalog";

function measure(id: string): MeasureRecord {
  return {
    id,
    label: `Measure ${id}`,
    evidenceClass: "official-statistics",
    comparisonKey: "monthly-rate",
    cadence: "monthly",
    unit: "%",
    basis: "Monthly published rate",
    geography: { code: "GB", label: "Great Britain" },
    sourceId: `source-${id}`,
    sourceUrl: `https://example.gov.uk/${id}`,
    sourceEditionId: `edition-${id}`,
    observationPeriod: { start: "2026-08-01", end: "2026-08-01", label: "Aug 2026" },
    publishedAt: "2026-09-01T00:00:00.000Z",
    fetchedAt: "2026-09-01T00:00:00.000Z",
    validUntil: "2030-10-01T00:00:00.000Z",
    availability: "current",
    value: 5,
    revisionId: `revision-${id}`,
    points: [{ period: "Aug 2026", observedAt: "2026-08-01", value: 5, valueStatus: "observed", revisionId: `revision-${id}` }],
    caveats: [],
  };
}

function catalog(measures: MeasureRecord[]): MeasureCatalog {
  return {
    schemaVersion: 2,
    editionId: "test-edition",
    generatedAt: "2026-09-01T00:00:00.000Z",
    validUntil: "2030-10-01T00:00:00.000Z",
    measures: Object.fromEntries(measures.map((item) => [item.id, item])),
  };
}

describe("ComparisonStudio overlay", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/compare/");
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("renders isolated publications as visible chart points", () => {
    render(
      <ComparisonStudio
        catalog={catalog([measure("first"), measure("second")])}
        measures={[measure("first"), measure("second")]}
        initial={{ version: 1, measureIds: ["first", "second"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "overlay" }}
        initialError={null}
      />,
    );

    const chart = screen.getByRole("img", { name: /Comparable measures from 2026-08-01 to 2026-08-01/ });
    const points = [...chart.querySelectorAll("circle")];
    expect(points).toHaveLength(2);
    expect(points.map((point) => point.getAttribute("cx"))).toEqual(["480", "480"]);
    expect([...chart.querySelectorAll("text")].slice(0, 5).every((tick) => Number(tick.getAttribute("x")) >= 0)).toBe(true);
  });

  it("explains an empty shared date window instead of presenting a blank overlay", () => {
    render(
      <ComparisonStudio
        catalog={catalog([measure("first"), measure("second")])}
        measures={[measure("first"), measure("second")]}
        initial={{ version: 1, measureIds: ["first", "second"], window: { start: "2025-01-01", end: "2025-12-31" }, mode: "overlay" }}
        initialError={null}
      />,
    );

    expect(screen.getByRole("status").textContent).toMatch(/no numeric observations.*widen the date window/i);
  });

  it("keeps incompatible units in separate panels and disables the shared-axis option", () => {
    const first = measure("first");
    const second = { ...measure("second"), unit: "people", basis: "People in the measured population" };
    render(
      <ComparisonStudio
        catalog={catalog([first, second])}
        measures={[first, second]}
        initial={{ version: 1, measureIds: ["first", "second"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "overlay" }}
        initialError={null}
      />,
    );

    expect(screen.getByRole("radio", { name: "Overlay comparable series" })).toBeDisabled();
    expect(screen.getByText(/do not share.*separate panels/i)).toBeInTheDocument();
  });

  it("keeps the full measure list searchable without placing it ahead of the charts", () => {
    const { container } = render(
      <ComparisonStudio
        catalog={catalog([measure("first"), measure("second")])}
        measures={[measure("first"), measure("second")]}
        initial={{ version: 1, measureIds: ["first"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "panels" }}
        initialError={null}
      />,
    );

    const details = [...container.querySelectorAll("details")].find((element) => element.textContent?.includes("Browse 2 available measures"));
    expect(details?.open).toBe(false);
    if (!details) throw new Error("Measure search disclosure is missing.");
    details.open = true;
    const search = container.querySelector('input[type="search"]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: "first" } });
    expect(details?.textContent).toContain("Showing 1 of 2 available measures.");
    expect(details?.textContent).not.toContain("Measure second");
  });

  it("saves, loads, renames and deletes a browser-local named comparison", () => {
    const { container } = render(
      <ComparisonStudio
        catalog={catalog([measure("first"), measure("second")])}
        measures={[measure("first"), measure("second")]}
        initial={{ version: 1, measureIds: ["first"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "panels" }}
        initialError={null}
      />,
    );
    const nameInput = container.querySelector('input[placeholder="e.g. Regional employment"]') as HTMLInputElement;
    const clickButton = (name: string) => {
      const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === name);
      if (!button) throw new Error(`Missing ${name} button.`);
      fireEvent.click(button);
    };
    fireEvent.change(nameInput, { target: { value: "Employment by month" } });
    clickButton("Save current state");
    expect(container.querySelector('[aria-label="Saved comparisons"] h3')?.textContent).toBe("Employment by month");
    expect(JSON.parse(localStorage.getItem("public-data.org:comparison-workspaces:v1") ?? "{}").workspaces).toHaveLength(1);

    const endDate = container.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
    fireEvent.change(endDate, { target: { value: "2026-09-01" } });
    expect(endDate.value).toBe("2026-09-01");
    clickButton("Load");
    expect(endDate.value).toBe("2026-08-01");

    clickButton("Rename");
    const renameInput = container.querySelectorAll('input[maxlength="80"]')[1] as HTMLInputElement;
    fireEvent.change(renameInput, { target: { value: "Revised employment" } });
    clickButton("Save name");
    expect(container.querySelector('[aria-label="Saved comparisons"] h3')?.textContent).toBe("Revised employment");

    clickButton("Delete");
    expect(container.querySelector('[aria-label="Saved comparisons"] h3')).toBeNull();
    expect(JSON.parse(localStorage.getItem("public-data.org:comparison-workspaces:v1") ?? "{}").workspaces).toHaveLength(0);
  });

  it("restores a valid shared selection and date window on browser navigation", () => {
    const { container } = render(
      <ComparisonStudio
        catalog={catalog([measure("first"), measure("second")])}
        measures={[measure("first"), measure("second")]}
        initial={{ version: 1, measureIds: ["first"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "panels" }}
        initialError={null}
      />,
    );
    window.history.pushState(window.history.state, "", "/compare/?measure=second&start=2026-09-01&end=2026-09-30&mode=panels");
    fireEvent.popState(window);
    expect(container.textContent).toContain("Measure second: comparison panel");
    expect((container.querySelectorAll('input[type="date"]')[0] as HTMLInputElement).value).toBe("2026-09-01");
    expect((container.querySelectorAll('input[type="date"]')[1] as HTMLInputElement).value).toBe("2026-09-30");
  });

  it("restores a shared workspace from the browser URL when static rendering has no server query", async () => {
    window.history.replaceState({}, "", "/compare/?measure=second&start=2026-09-01&end=2026-09-30&mode=panels");
    const { container } = render(
      <ComparisonStudio
        catalog={catalog([measure("first"), measure("second")])}
        measures={[measure("first"), measure("second")]}
        initial={null}
        initialError={null}
      />,
    );

    await waitFor(() => expect(container.textContent).toContain("Measure second: comparison panel"));
    expect((container.querySelectorAll('input[type="date"]')[0] as HTMLInputElement).value).toBe("2026-09-01");
    expect((container.querySelectorAll('input[type="date"]')[1] as HTMLInputElement).value).toBe("2026-09-30");
    expect(window.location.search).toContain("measure=second");
  });

  it("adds user-edited workspace states to browser history for back and forward navigation", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const { container } = render(
      <ComparisonStudio
        catalog={catalog([measure("first"), measure("second")])}
        measures={[measure("first"), measure("second")]}
        initial={{ version: 1, measureIds: ["first"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "panels" }}
        initialError={null}
      />,
    );

    const startDate = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: "2026-07-01" } });
    expect(pushState).toHaveBeenCalled();
    expect(window.location.search).toContain("start=2026-07-01");

    window.history.pushState(window.history.state, "", "/compare/?measure=second&start=2026-09-01&end=2026-09-30&mode=panels");
    fireEvent.popState(window);
    expect(container.textContent).toContain("Measure second: comparison panel");
    expect((container.querySelectorAll('input[type="date"]')[0] as HTMLInputElement).value).toBe("2026-09-01");
    pushState.mockRestore();
  });

  it("reports blocked browser storage without hiding the usable shared comparison", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    render(
      <ComparisonStudio
        catalog={catalog([measure("first")])}
        measures={[measure("first")]}
        initial={{ version: 1, measureIds: ["first"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "panels" }}
        initialError={null}
      />,
    );

    expect(screen.getByRole("alert").textContent).toMatch(/saved workspaces unavailable/i);
    expect(screen.getByRole("heading", { name: "Measure first: comparison panel" })).toBeInTheDocument();
  });

  it("offers one exact-window export for the whole separate-panel workspace", () => {
    render(
      <ComparisonStudio
        catalog={catalog([measure("first"), measure("second")])}
        measures={[measure("first"), measure("second")]}
        initial={{ version: 1, measureIds: ["first", "second"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "panels" }}
        initialError={null}
      />,
    );

    expect(screen.getByRole("region", { name: "Download comparison data" })).toBeInTheDocument();
    expect(screen.getByText(/every selected measure.*date window.*display mode/i)).toBeInTheDocument();
    const downloads = screen.getByRole("region", { name: "Download comparison data" });
    expect(within(downloads).getByRole("button", { name: "CSV" })).toBeInTheDocument();
    expect(within(downloads).getByRole("button", { name: "JSON" })).toBeInTheDocument();
  });

  it("imports a valid workspace through the file control and persists it locally", async () => {
    render(
      <ComparisonStudio
        catalog={catalog([measure("first")])}
        measures={[measure("first")]}
        initial={{ version: 1, measureIds: ["first"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "panels" }}
        initialError={null}
      />,
    );
    const file = new File([""], "comparison.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => JSON.stringify({
      version: 1,
      workspaces: [{
        id: "workspace-import-0001",
        name: "Imported employment",
        workspace: { version: 1, measureIds: ["first"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "panels" },
      }],
    }) });

    fireEvent.change(screen.getByLabelText("Import comparisons"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/imported 1 comparison/i));
    expect(screen.getByRole("heading", { name: "Imported employment" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("public-data.org:comparison-workspaces:v1") ?? "{}").workspaces).toHaveLength(1);
  });
});
