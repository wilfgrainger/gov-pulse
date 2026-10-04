import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PollingPublicationChart from "@/app/components/PollingPublicationChart";

const polls = [
  {
    id: "yougov-1", pollster: "YouGov", fieldworkStart: "2026-09-01", fieldworkEnd: "2026-09-02", sampleSize: 1200,
    title: "YouGov poll", commissioner: "Publisher", questionText: "Voting intention", publicationDate: "2026-09-03", publicationDateStatus: "published" as const,
    geography: "Great Britain", population: "Adults", mode: "Online panel", sampleSizeNote: null, headlineMethod: "Published intention", sourceUrl: "https://yougov.com/poll.pdf", methodologyUrl: "https://yougov.com/method", uncertainty: null,
    parties: { conservative: 25, labour: 30 },
  },
  {
    id: "ipsos-1", pollster: "Ipsos", fieldworkStart: "2026-09-04", fieldworkEnd: "2026-09-05", sampleSize: 1400,
    title: "Ipsos poll", commissioner: null, questionText: null, publicationDate: null, publicationDateStatus: "not-disclosed" as const,
    geography: "Great Britain", population: "Adults", mode: null, sampleSizeNote: null, headlineMethod: "Published intention", sourceUrl: "https://www.ipsos.com/poll.xlsx", methodologyUrl: "https://www.ipsos.com/method", uncertainty: null,
    parties: { conservative: 23, labour: 32 },
  },
];

const partyMeta = {
  conservative: { label: "Conservative", color: "#135f94" },
  labour: { label: "Labour", color: "#a32035" },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("poll publication party controls", () => {
  it("filters chart rows to the selected party without merging poll publications", () => {
    render(<PollingPublicationChart polls={polls} partyMeta={partyMeta} partyOrder={["conservative", "labour"]} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("Conservative")).toHaveLength(2);
    expect(within(table).getAllByText("Labour")).toHaveLength(2);

    fireEvent.click(screen.getByRole("checkbox", { name: "Show Conservative" }));

    expect(within(table).queryByText("Conservative")).toBeNull();
    expect(within(table).getAllByText("Labour")).toHaveLength(2);
    expect(within(table).getAllByText("YouGov")).toHaveLength(1);
    expect(within(table).getAllByText("Ipsos")).toHaveLength(1);
  });

  it("renders one percent suffix on each share axis tick", async () => {
    class MockResizeObserver {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 640, height: 340 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 640,
      height: 340,
    } as DOMRect);

    render(<PollingPublicationChart polls={polls} partyMeta={partyMeta} partyOrder={["conservative", "labour"]} />);

    const ticks = await waitFor(() => {
      const renderedTicks = document.querySelectorAll(
        ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
      );
      expect(renderedTicks.length).toBeGreaterThan(0);
      return Array.from(renderedTicks, (tick) => tick.textContent?.trim() ?? "");
    });

    expect(
      ticks.every((label) => /^-?\d+(?:[.,]\d+)?%$/.test(label)),
      `Rendered y-axis ticks: ${ticks.join(", ")}`,
    ).toBe(true);
  });
});
