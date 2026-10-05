import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NationalEvidenceEdition from "@/app/components/NationalEvidenceEdition";
import type { NationalEvidenceEdition as Edition, SignalPresentation } from "@/app/lib/nationalEvidence";

afterEach(() => {
  cleanup();
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function signal(overrides: Partial<SignalPresentation> = {}): SignalPresentation {
  return {
    id: "national-debt",
    anchorId: "national-debt",
    title: "National debt",
    kicker: "Public finances",
    href: "/section/national-debt",
    evidenceClass: "official-data",
    geography: "United Kingdom",
    state: "current",
    value: "93.8% of GDP",
    comparison: "Debt stock £2.99tn · annual change +£78.5bn",
    period: "August 2026",
    publishedAt: "22 Sept 2026",
    sourceUrl: "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf",
    history: [
      { observedAt: Date.UTC(2025, 7, 31), value: 95.1 },
      { observedAt: Date.UTC(2026, 7, 31), value: 93.8 },
    ],
    leadHeadline: "UK public sector net debt was 93.8% of GDP in August 2026.",
    leadSummary: "The same release puts the debt stock at £2.99tn.",
    caveat: "This is a dated stock, not a real-time counter.",
    ...overrides,
  };
}

function edition(lead: SignalPresentation | null): Edition {
  return {
    generatedAt: "5 Oct 2026",
    lead,
    signals: lead ? [lead] : [],
    counts: {
      current: lead?.state === "current" ? 1 : 0,
      "update-due": lead?.state === "update-due" ? 1 : 0,
      unavailable: lead ? 0 : 1,
    },
  };
}

describe("Lead card and history card", () => {
  it("renders separate lead and history cards for a current debt lead", () => {
    render(<NationalEvidenceEdition initialEdition={edition(signal())} />);

    const lead = screen.getByTestId("lead-card");
    const history = screen.getByTestId("history-card");

    expect(lead).toHaveAttribute("data-evidence-state", "current");
    expect(lead).toHaveAttribute("data-signal-id", "national-debt");
    expect(lead).toHaveTextContent("93.8% of GDP");
    expect(lead).toHaveTextContent("UK public sector net debt was 93.8% of GDP in August 2026.");
    expect(lead).toHaveTextContent("United Kingdom · August 2026 · published 22 Sept 2026");
    expect(lead).toHaveTextContent("This is a dated stock, not a real-time counter.");
    expect(screen.getByRole("link", { name: /Understand this figure/i })).toHaveAttribute(
      "href",
      "/section/national-debt"
    );
    expect(screen.getByRole("link", { name: /Primary source/i })).toHaveAttribute(
      "href",
      "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf"
    );

    expect(history).toHaveAttribute("data-evidence-state", "current");
    expect(history).toHaveTextContent("National debt over recent observations");
    expect(history).toHaveTextContent("2 verified points");
    expect(history).toHaveTextContent("Latest in this series: 93.8% of GDP");
    expect(screen.getByRole("link", { name: /Full chart and source notes/i })).toHaveAttribute(
      "href",
      "/section/national-debt"
    );
  });

  it("fails closed on the history card when the lead has fewer than two verified points", () => {
    render(
      <NationalEvidenceEdition
        initialEdition={edition(
          signal({
            history: [{ observedAt: Date.UTC(2026, 7, 31), value: 93.8 }],
          })
        )}
      />
    );

    expect(screen.getByTestId("lead-card")).toHaveTextContent("93.8% of GDP");
    expect(screen.getByTestId("history-card")).toHaveTextContent("Comparable history unavailable");
    expect(screen.getByTestId("history-card")).not.toHaveTextContent("verified points from");
  });

  it("shows unavailable lead and history cards when no current lead exists", () => {
    render(<NationalEvidenceEdition initialEdition={edition(null)} />);

    expect(screen.getByTestId("lead-card")).toHaveTextContent("No current lead figure is available.");
    expect(screen.getByTestId("history-card")).toHaveTextContent("History unavailable");
    expect(screen.queryByText("% of GDP")).not.toBeInTheDocument();
  });
});
