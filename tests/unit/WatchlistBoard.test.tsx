import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WatchlistBoard from "@/app/components/WatchlistBoard";
import type { MeasureCatalog, MeasureRecord } from "@/app/lib/measureCatalog";
import { buildWatchEvidenceReference } from "@/app/lib/watchlist";

const record = (value = 2, edition = "edition-1", validUntil = "2027-01-01T00:00:00.000Z"): MeasureRecord => ({
  id: "measure-0", label: "Measure zero", evidenceClass: "official-statistics", comparisonKey: "measure-0", cadence: "monthly", unit: "%", basis: "A named measure",
  geography: { code: "GB", label: "Great Britain" }, sourceId: "publisher", sourceUrl: "https://example.org/release", sourceEditionId: edition,
  observationPeriod: { start: "2026-01-01", end: "2026-01-31", label: "January 2026" }, publishedAt: "2026-02-01T00:00:00.000Z", fetchedAt: "2026-02-02T00:00:00.000Z", validUntil,
  availability: "current", value, revisionId: `revision-${value}`,
  points: [{ period: "January 2026", observedAt: "2026-01-31", value, valueStatus: "observed", revisionId: `revision-${value}` }], caveats: [],
});

const catalog = (measure: MeasureRecord): MeasureCatalog => ({
  schemaVersion: 2, editionId: `catalog-${measure.sourceEditionId}`, generatedAt: "2026-02-02T00:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z",
  measures: { [measure.id]: measure },
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("watchlist change indicators", () => {
  it("persists, exports and imports measure IDs without exporting evidence values", async () => {
    const first = record();
    const second = { ...record(4), id: "measure-1", label: "Measure one", sourceEditionId: "edition-1" };
    const measures = { ...catalog(first).measures, [second.id]: second };
    const fullCatalog = { ...catalog(first), measures };
    render(<WatchlistBoard catalog={fullCatalog} measures={[first, second]} />);

    const checkbox = await screen.findByLabelText(/Measure zero/);
    fireEvent.click(checkbox);
    await waitFor(() => expect(JSON.parse(localStorage.getItem("public-data.org:watchlist:v1") ?? "{}").measureIds).toEqual([first.id]));

    let exportedBlob: Blob | null = null;
    const createUrl = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => { exportedBlob = blob; return "blob:watchlist"; });
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Export IDs" }));
    expect(createUrl).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledOnce();
    expect((await exportedBlob!.text())).toContain('"measureIds": [\n    "measure-0"\n  ]');
    expect(await exportedBlob!.text()).not.toContain("value");

    const importControl = screen.getByLabelText("Import IDs") as HTMLInputElement;
    const file = new File([JSON.stringify({ version: 1, measureIds: [second.id] })], "watchlist.json", { type: "application/json" });
    Object.defineProperty(importControl, "files", { configurable: true, value: [file] });
    fireEvent.change(importControl);
    await waitFor(() => expect(JSON.parse(localStorage.getItem("public-data.org:watchlist:v1") ?? "{}").measureIds).toEqual([second.id]));
    createUrl.mockRestore();
    download.mockRestore();
  });

  it("shows evidence changes since last visit without storing raw values", async () => {
    const previous = record();
    const reference = await buildWatchEvidenceReference(previous);
    localStorage.setItem("public-data.org:watchlist:v1", JSON.stringify({ version: 1, measureIds: [previous.id] }));
    localStorage.setItem("public-data.org:watchlist-evidence:v1", JSON.stringify({ version: 1, measures: { [previous.id]: reference } }));

    const next = record(3, "edition-2");
    render(<WatchlistBoard catalog={catalog(next)} measures={[next]} />);

    expect(await screen.findByText("Evidence changed since your last visit.")).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem("public-data.org:watchlist-evidence:v1") ?? "{}");
    expect(stored.measures[previous.id]).not.toHaveProperty("value");
    expect(JSON.stringify(stored)).not.toContain("\"value\":3");
  });

  it("separates a new source edition from a change to tracked evidence", async () => {
    const previous = record();
    const reference = await buildWatchEvidenceReference(previous);
    localStorage.setItem("public-data.org:watchlist:v1", JSON.stringify({ version: 1, measureIds: [previous.id] }));
    localStorage.setItem("public-data.org:watchlist-evidence:v1", JSON.stringify({ version: 1, measures: { [previous.id]: reference } }));

    const next = record(2, "edition-2");
    render(<WatchlistBoard catalog={catalog(next)} measures={[next]} />);

    expect(await screen.findByText("New source edition; tracked evidence unchanged.")).toBeTruthy();
  });

  it("does not compare an expired value as current evidence", async () => {
    const previous = record();
    const reference = await buildWatchEvidenceReference(previous);
    localStorage.setItem("public-data.org:watchlist:v1", JSON.stringify({ version: 1, measureIds: [previous.id] }));
    localStorage.setItem("public-data.org:watchlist-evidence:v1", JSON.stringify({ version: 1, measures: { [previous.id]: reference } }));

    const expired = record(2, "edition-1", "2026-02-10T00:00:00.000Z");
    render(<WatchlistBoard catalog={catalog(expired)} measures={[expired]} />);

    expect(await screen.findByText("Current evidence is unavailable; no comparison was made.")).toBeTruthy();
  });
});
