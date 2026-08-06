import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PMApproval from "@/app/components/PMApproval";

afterEach(cleanup);

describe("PMApproval evidence integrity", () => {
  it("withdraws unsupported polling figures and explains the recovery condition", () => {
    render(<PMApproval />);

    expect(
      screen.getByRole("region", {
        name: "No current PM approval series is published by public-data.org.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/could not be reproduced from one consistent primary polling series/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No approval number is being inferred, averaged or carried forward/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Every observation must link to a first-party poll publication/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Keir Starmer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/net approval/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approve:/i)).not.toBeInTheDocument();
  });
});
