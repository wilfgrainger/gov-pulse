import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DataExplorer from "@/app/components/DataExplorer";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

vi.mock("@/app/lib/metricsSnapshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/metricsSnapshot")>()),
  fetchMetricsSnapshot: () => Promise.reject(new Error("offline test")),
}));

afterEach(() => cleanup());

const snapshot = {
  meta: {
    registryVersion: FEED_REGISTRY_VERSION,
    sources: {
      taxRevenue: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: new Date().toISOString(),
        provenance: { section: "taxRevenue" },
      },
    },
  },
  taxRevenue: {
    headline: { receiptsBillion: 89.8, period: "August 2026", releaseDate: "2026-09-22" },
    source: { bulletinUrl: "https://www.ons.gov.uk/economy/publicsectorfinances/august2026" },
    __observation: { status: "current", observedAt: "2026-08-31T00:00:00.000Z", maxAgeDays: 70 },
  },
};

describe("public data explorer", () => {
  it("starts with verified values and lets readers reveal unavailable core measures", () => {
    render(<DataExplorer initialSnapshot={snapshot} />);
    const measures = within(screen.getByRole("list", { name: "Measures" }));
    expect(measures.getAllByRole("button")).toHaveLength(1);
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
});
