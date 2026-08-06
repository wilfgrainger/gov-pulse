import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomepageIntro from "@/app/components/HomepageIntro";

afterEach(() => cleanup());

describe("HomepageIntro", () => {
  it("explains the publication to a first-time visitor without requiring backstory", () => {
    render(<HomepageIntro />);

    expect(screen.getByRole("heading", { level: 1, name: "Britain, in evidence." })).toBeInTheDocument();
    expect(screen.getByText(/latest important public figures/i)).toBeInTheDocument();
    expect(screen.getByText(/linked to the original publication/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Number, period, source." })).toBeInTheDocument();
    expect(screen.getByText(/no combined national score/i)).toBeInTheDocument();
    expect(screen.getByText(/missing evidence stays missing/i)).toBeInTheDocument();
  });

  it("puts today's evidence first and keeps source access visible", () => {
    render(<HomepageIntro />);

    expect(screen.getByRole("link", { name: /read today's edition/i })).toHaveAttribute("href", "#national-signals");
    expect(screen.getByRole("link", { name: "Check sources and dates" })).toHaveAttribute("href", "/sources");
  });

  it("states the three evidence promises before the edition", () => {
    render(<HomepageIntro />);

    expect(screen.getByRole("list", { name: "Evidence promises" })).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Comparable")).toBeInTheDocument();
    expect(screen.getByText("Traceable")).toBeInTheDocument();
  });
});
