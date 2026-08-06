import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EchoChamberMap from "@/app/components/EchoChamberMap";

afterEach(cleanup);

describe("EchoChamberMap evidence integrity", () => {
  it("withdraws unsupported relationship coefficients and explains the recovery condition", () => {
    render(<EchoChamberMap />);

    expect(
      screen.getByRole("region", {
        name: "The policy relationship matrix remains withdrawn.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/without committed respondent-level inputs, named variables, survey coverage, weighting, exclusions or a reproducible calculation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No relationship strength, ideological cluster or causal link is being inferred/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Define the correlation or association statistic/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/strong positive/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NHS Funding/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.62/)).not.toBeInTheDocument();
  });
});
