import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PublicationOffline from "@/app/components/PublicationOffline";

afterEach(cleanup);

describe("PublicationOffline", () => {
  it("keeps the general copy when no feed is named", () => {
    render(<PublicationOffline />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Data publications are temporarily offline");
  });

  it("names the held publication when other evidence is published", () => {
    render(<PublicationOffline heldFeeds={["nhsStats"]} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/is temporarily offline/);
    expect(heading).not.toHaveTextContent("Data publications are temporarily offline");
    expect(screen.getByText(/Other verified publications remain available/)).toBeInTheDocument();
  });

  it("respects an explicit title", () => {
    render(<PublicationOffline title="Custom" heldFeeds={["nhsStats"]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Custom");
  });
});
