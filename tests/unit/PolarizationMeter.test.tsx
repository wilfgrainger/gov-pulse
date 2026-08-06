import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PolarizationMeter from "@/app/components/PolarizationMeter";

afterEach(cleanup);

describe("PolarizationMeter evidence integrity", () => {
  it("withdraws the unsupported score and publishes the return conditions", () => {
    render(<PolarizationMeter />);

    expect(
      screen.getByRole("region", {
        name: "The polarization measure remains withdrawn.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/former site score had no reproducible input dataset or published calculation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Define the formula, weighting, missing-data treatment, exclusions and sensitivity checks/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No approval, division or polarization value is being inferred/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("68")).not.toBeInTheDocument();
    expect(screen.queryByText(/24 polls/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /read the evidence and withdrawal policy/i })
    ).toHaveAttribute("href", "/sources");
  });
});
