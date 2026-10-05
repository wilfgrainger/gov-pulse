import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PublicationOffline from "@/app/components/PublicationOffline";
import HomepageIntro from "@/app/components/HomepageIntro";

const editionLook = ["edition-look.css","edition-look-tokens.css","edition-look-chrome.css","edition-look-cards.css","edition-look-states.css"].map((f) => readFileSync(resolve(process.cwd(), "app", f), "utf8")).join("\n");
const socialScript = readFileSync(resolve(process.cwd(), "scripts/generate-social-cards.mjs"), "utf8");

afterEach(() => cleanup());

describe("Premium look", () => {
  it("locks ink paper, single vermillion accent, and Familjen display tokens", () => {
    expect(editionLook).toMatch(/--background:\s*#0c0f12/);
    expect(editionLook).toMatch(/--surface:\s*#f6f2ea/);
    expect(editionLook).toMatch(/--accent:\s*#e8352e/);
    expect(editionLook).toContain("var(--font-display-file)");
    expect(editionLook).toContain("font-variant-numeric: tabular-nums");
    expect(editionLook).toContain(".premium-lead");
    expect(editionLook).toContain(".edition-masthead-shell");
    expect(editionLook).toContain("prefers-reduced-motion");
    expect(editionLook).not.toMatch(/linear-gradient\([^)]*#4d43a5/);
    expect(editionLook).not.toContain("glass");
  });

  it("designs the offline shell with the same masthead doors", () => {
    render(<PublicationOffline />);
    expect(screen.getByRole("navigation", { name: "Edition" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Latest" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Look up" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("status")).toHaveTextContent(/Reverifying/i);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });

  it("keeps the homepage hero asymmetric and uncentred", () => {
    const { container } = render(<HomepageIntro />);
    expect(container.querySelector(".premium-hero")).toBeTruthy();
    expect(container.querySelector(".premium-hero__meta")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Britain, in evidence." })).toBeInTheDocument();
    expect(editionLook).toContain(".home-front-page");
    expect(editionLook).toContain(".front-page-edition-bar");
  });

  it("matches social cards to the ink masthead", () => {
    expect(socialScript).toContain("#0c0f12");
    expect(socialScript).toContain("#e8352e");
    expect(socialScript).not.toContain("#294466");
    expect(socialScript).not.toContain("linearGradient");
  });
});
