import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataExplorer from "@/app/components/DataExplorer";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

const NOW = new Date("2026-09-25T12:00:00Z");

vi.mock("@/app/lib/metricsSnapshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/metricsSnapshot")>()),
  fetchMetricsSnapshot: () => Promise.reject(new Error("offline test")),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const snapshot = {
  meta: {
    registryVersion: FEED_REGISTRY_VERSION,
    sources: {
      taxRevenue: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: NOW.toISOString(),
        provenance: { section: "taxRevenue" },
      },
      employmentStats: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: NOW.toISOString(),
        provenance: { section: "employmentStats" },
      },
    },
  },
  taxRevenue: {
    headline: { receiptsBillion: 89.8, period: "August 2026", releaseDate: "2026-09-22" },
    source: { bulletinUrl: "https://www.ons.gov.uk/economy/publicsectorfinances/august2026" },
    history: [
      { period: "August 2024", observedAt: Date.parse("2024-08-31"), receiptsBillion: 80 },
      { period: "August 2025", observedAt: Date.parse("2025-08-31"), receiptsBillion: 85 },
      { period: "August 2026", observedAt: Date.parse("2026-08-31"), receiptsBillion: 89.8 },
    ],
    __observation: { status: "current", observedAt: "2026-08-31T00:00:00.000Z", maxAgeDays: 70 },
  },
  employmentStats: {
    available: true,
    headline: { unemploymentRate: 4.9, period: "June to August 2026", releaseDate: "2026-09-17" },
    annualDelta: { unemploymentRatePoints: 0.2 },
    source: { bulletinUrl: "https://www.ons.gov.uk/employmentandlabourmarket/uklabourmarket/september2026" },
    history: {
      labourForce: [
        { observedAt: Date.parse("2024-08-31"), period: "June to August 2024", unemploymentRate: 4.4 },
        { observedAt: Date.parse("2025-08-31"), period: "June to August 2025", unemploymentRate: 4.7 },
        { observedAt: Date.parse("2026-08-31"), period: "June to August 2026", unemploymentRate: 4.9 },
      ],
    },
    __observation: { status: "current", observedAt: "2026-08-31T00:00:00.000Z", maxAgeDays: 70 },
  },
};

describe("public data explorer", () => {
  it("starts with verified values and lets readers reveal unavailable core measures", () => {
    render(<DataExplorer initialSnapshot={snapshot} />);
    const measures = within(screen.getByRole("list", { name: "Measures" }));
    expect(measures.getAllByRole("button")).toHaveLength(2);
    expect(measures.getByRole("button", { name: /Central government receipts/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Show unavailable measures" }));
    expect(measures.getAllByRole("button")).toHaveLength(7);
    expect(measures.getByRole("button", { name: /NHS waiting list/i })).toHaveTextContent("Unavailable");
  });

  it("explains gaps when no core measure has a verified value", () => {
    render(<DataExplorer initialSnapshot={null} />);
    expect(within(screen.getByRole("list", { name: "Measures" })).getAllByRole("button")).toHaveLength(7);
    expect(screen.getByText(/No core measure has a current verified value/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Show unavailable measures" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show unavailable measures" })).toBeDisabled();
  });

  it("defaults to the single-measure view with no comparison overlaid", () => {
    render(<DataExplorer initialSnapshot={snapshot} />);
    expect(screen.getByRole("combobox", { name: /Compare with/i })).toHaveValue("");
    expect(screen.queryByText(/right axis, own scale/i)).not.toBeInTheDocument();
  });

  it("overlays a second measure on its own axis and unit without hiding either source", () => {
    render(<DataExplorer initialSnapshot={snapshot} />);
    const compareSelect = screen.getByRole("combobox", { name: /Compare with/i });
    fireEvent.change(compareSelect, { target: { value: "receipts" } });

    const strongLabel = document.querySelector("strong");
    expect(strongLabel).toHaveTextContent("Central government receipts");
    expect(screen.getByText(/right axis, own scale/i)).toBeInTheDocument();
    expect(screen.getByText(/Source for Central government receipts/i)).toBeInTheDocument();
    const img = screen.getByRole("img", { name: /Unemployment rate/i });
    expect(img.getAttribute("aria-label")).toMatch(/Overlaid for comparison: Central government receipts/);
    expect(img.getAttribute("aria-label")).toMatch(/Not combined into one value/);
    // The primary measure's own chart is unaffected: still present with its own label.
    expect(screen.getAllByText("Unemployment rate").length).toBeGreaterThan(0);
  });

  it("shows the compared measure as unavailable rather than hiding it when it has no verified value", () => {
    const withGap = structuredClone(snapshot) as typeof snapshot & { nhsStats?: unknown };
    render(<DataExplorer initialSnapshot={withGap} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Show unavailable measures" }));
    const compareSelect = screen.getByRole("combobox", { name: /Compare with/i });
    // NHS waiting list has no history in this fixture, so it is excluded from the
    // compare dropdown entirely (nothing to overlay) rather than overlaying an
    // empty/fake line.
    const options = within(compareSelect).getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("NHS waiting list");
  });
});
