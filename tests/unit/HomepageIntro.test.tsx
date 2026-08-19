import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomepageIntro from "@/app/components/HomepageIntro";

afterEach(() => cleanup());

describe("HomepageIntro", () => {
  it("explains the publication to a first-time visitor without an instruction panel", () => {
    render(<HomepageIntro />);

    expect(screen.getByRole("heading", { level: 1, name: "Britain, in evidence." })).toBeInTheDocument();
    expect(screen.getByText(/latest important public figures/i)).toBeInTheDocument();
    expect(screen.getByText(/linked to the original publication/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Office for National Statistics" })).toHaveAttribute("href", "https://www.ons.gov.uk/");
    expect(screen.queryByText(/how to read a figure/i)).not.toBeInTheDocument();
  });

  it("puts today's evidence first and keeps source access visible", () => {
    render(<HomepageIntro />);

    expect(screen.getByRole("link", { name: /read today's edition/i })).toHaveAttribute("href", "#national-signals");
    expect(screen.getByRole("link", { name: "Check sources and dates" })).toHaveAttribute("href", "/sources");
  });
});
