import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SourceDetailPage from "@/app/sources/[id]/page";

const { readServerMetricsSnapshot, readEditionSummaries } = vi.hoisted(() => ({
  readServerMetricsSnapshot: vi.fn(),
  readEditionSummaries: vi.fn(),
}));

vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot }));
vi.mock("@/app/lib/serverEditionArchive", () => ({ readEditionSummaries }));

afterEach(() => cleanup());

const measure = (id: string, publisher: string, sourceUrl: string, value: number) => ({
  id,
  label: id === "inflation" ? "CPI inflation" : "Official Bank Rate",
  evidenceClass: id === "bankRate" ? "official-policy" : "official-statistics",
  publisher,
  comparisonKey: id,
  cadence: "monthly",
  unit: "%",
  basis: id,
  geography: { code: "UK", label: "United Kingdom" },
  sourceId: "sentimentPulse",
  sourceUrl,
  sourceEditionId: `${id}-edition-2026-09`,
  observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "August 2026" },
  publishedAt: "2026-09-16T00:00:00.000Z",
  fetchedAt: "2026-09-16T01:00:00.000Z",
  validUntil: "2026-12-01T00:00:00.000Z",
  availability: "current",
  value,
  revisionId: `${id}-revision-1`,
  points: [{ period: "August 2026", observedAt: "2026-08-31", value, valueStatus: "observed", revisionId: `${id}-revision-1` }],
  caveats: [],
});

function snapshot() {
  return {
    meta: {
      measureCatalog: {
        schemaVersion: 2,
        editionId: "catalog-2026-09",
        generatedAt: "2026-09-16T01:00:00.000Z",
        validUntil: null,
        measures: {
          bankRate: measure("bankRate", "Bank of England", "https://www.bankofengland.co.uk/bank-rate", 3.75),
          inflation: measure("inflation", "Office for National Statistics", "https://www.ons.gov.uk/inflation", 3.1),
        },
      },
      sources: {
        sentimentPulse: {
          status: "ok",
          fetchedAt: "2026-09-16T01:00:00.000Z",
          provenance: {
            evidenceClass: "official-data",
            upstreams: [
              { publisher: "Office for National Statistics", url: "https://www.ons.gov.uk/inflation" },
              { publisher: "Bank of England", url: "https://www.bankofengland.co.uk/bank-rate" },
            ],
          },
        },
      },
    },
  };
}

beforeEach(() => {
  readServerMetricsSnapshot.mockResolvedValue(snapshot());
  readEditionSummaries.mockResolvedValue([]);
});

describe("SourceDetailPage", () => {
  it("renders the requested publisher record instead of the first measure in a shared collection", async () => {
    const page = await SourceDetailPage({
      params: Promise.resolve({ id: "sentimentPulse" }),
      searchParams: Promise.resolve({ measure: "inflation" }),
    });
    render(page);

    expect(screen.getByRole("heading", { level: 1, name: "CPI inflation" })).toBeInTheDocument();
    expect(screen.getByText("Evidence class").nextElementSibling).toHaveTextContent("Official statistics");
    expect(screen.getByText("Office for National Statistics", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open primary publication" }).parentElement).toHaveTextContent(
      "edition inflation-edition-2026-09",
    );
    expect(screen.getByRole("link", { name: "Open primary publication" })).toHaveAttribute("href", "https://www.ons.gov.uk/inflation");
    expect(screen.queryByText("Official Bank Rate", { selector: "p" })).not.toBeInTheDocument();
    expect(screen.getByText("Measures").nextElementSibling).toHaveTextContent("1");
  });

  it("keeps the legacy collection route clearly grouped and shows each measure's own publisher", async () => {
    const page = await SourceDetailPage({
      params: Promise.resolve({ id: "sentimentPulse" }),
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByRole("heading", { level: 1, name: "Series-level economic indicators" })).toBeInTheDocument();
    expect(screen.getByText("Evidence class").nextElementSibling).toHaveTextContent("Mixed: Official policy, Official statistics");
    expect(screen.getByText("CPI inflation")).toBeInTheDocument();
    expect(screen.getByText("Official Bank Rate")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Primary publication" })).toHaveLength(2);
  });
});
