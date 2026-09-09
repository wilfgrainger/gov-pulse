import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomepageIntro from "@/app/components/HomepageIntro";

afterEach(() => cleanup());

describe("HomepageIntro", () => {
  it("explains the publication to a first-time visitor without an instruction panel", () => {
    render(<HomepageIntro />);

    expect(screen.getByRole("heading", { level: 1, name: "Britain, in evidence." })).toBeInTheDocument();
    expect(screen.getByText(/What changed, what it means/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "official sources" })).toHaveAttribute("href", "https://www.ons.gov.uk/");
    expect(screen.queryByText(/how to read a figure/i)).not.toBeInTheDocument();
  });

  it("puts today's evidence first and keeps source access visible", () => {
    render(<HomepageIntro />);

    expect(screen.getByRole("link", { name: /Explore 27 measures/i })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Sources and dates" })).toHaveAttribute("href", "/sources");
  });
});
