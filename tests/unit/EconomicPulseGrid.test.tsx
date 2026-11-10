import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EconomicPulseGrid from "@/app/components/visuals/EconomicPulseGrid";

afterEach(() => cleanup());

describe("EconomicPulseGrid controls", () => {
  it("exposes each expandable indicator as a button with pressed state", () => {
    render(
      <EconomicPulseGrid
        series={[
          {
            id: "inflation",
            title: "Consumer Prices Index inflation",
            shortTitle: "Inflation",
            unit: "%",
            currentValue: 3.4,
            previousValue: 3.2,
            annualDelta: 0.2,
            observationPeriod: "August 2026",
            publisher: "Office for National Statistics",
            seriesCode: "D7G7",
            history: [
              { date: "July 2026", value: 3.2 },
              { date: "August 2026", value: 3.4 },
            ],
            color: "#dc2626",
          },
        ]}
      />,
    );

    const card = screen.getByRole("button", { name: /Inflation/ });
    expect(card).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: /Historical Publication Points/ })).toBeInTheDocument();
  });

  it("shows the annual change in percentage points and counts the series shown", () => {
    const item = (id: string, annualDelta: number | null) => ({
      id, title: id, shortTitle: id, unit: "%", currentValue: 3.4, previousValue: 3.0, annualDelta,
      observationPeriod: "August 2026", publisher: "ONS", seriesCode: id,
      history: [{ date: "July 2026", value: 3.0 }, { date: "August 2026", value: 3.4 }], color: "#dc2626",
    });
    render(<EconomicPulseGrid series={[item("a", -0.3), item("b", 0), item("c", null)]} />);
    expect(screen.getByText("-0.3 pp on a year earlier")).toBeInTheDocument();
    expect(screen.getByText("0.0 pp on a year earlier")).toBeInTheDocument();
    expect(screen.queryByText(/MoM/)).toBeNull();
    expect(screen.getByRole("heading", { name: /3 Key Series/ })).toBeInTheDocument();
  });
});
