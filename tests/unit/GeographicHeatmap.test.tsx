import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GeographicHeatmap from "@/app/components/GeographicHeatmap";

afterEach(cleanup);

describe("GeographicHeatmap evidence integrity", () => {
  it("withdraws every unsupported regional value and ranking", () => {
    render(<GeographicHeatmap />);

    expect(
      screen.getByRole("region", {
        name: "The UK regional comparison has been withdrawn.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/embedded unemployment, recorded-crime and election values without reproducible row-level sources/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Identify every area with an official statistical geography code/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not carrying forward any regional unemployment, crime, voting or income value/i)
    ).toBeInTheDocument();

    expect(screen.queryByText(/Where is unemployment highest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/North East records the highest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ONS Labour Force Survey, Q3 2025/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Home Office, year ending September 2025/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crime" })).not.toBeInTheDocument();
  });
});
