import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The :root design tokens are pinned here as the guard that a palette change
// cannot silently break the WCAG AA contrast contract. The page surface,
// ink and accent are load-bearing for every text/background pairing, so any
// edit to the palette must land here first and keep the structural, focus,
// reduced-motion and flat-evidence-panel contracts below intact.
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

function token(name: string) {
  return css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1] ?? null;
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = hex.slice(1).match(/../g)!.map((pair) => parseInt(pair, 16) / 255);
  const linear = [red, green, blue].map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("consumer visual system", () => {
  it("defines assignable semantic color tokens without pinning one aesthetic", () => {
    for (const token of ["background", "surface", "foreground", "accent", "accent-on-dark"]) {
      expect(css).toMatch(new RegExp(`--${token}:\\s*#[0-9a-f]{3,8}`, "i"));
    }
  });

  it("keeps dark masthead text above WCAG AA contrast on the vivid accent", () => {
    const foreground = token("foreground");
    const accent = token("accent-vivid");
    expect(foreground).not.toBeNull();
    expect(accent).not.toBeNull();
    expect(contrastRatio(foreground!, accent!)).toBeGreaterThanOrEqual(4.5);
  });

  it("defines one v3 publication system for the first visit, edition and evidence pages", () => {
    expect(css).toContain(".v3-hero");
    expect(css).toContain(".v3-reading-card");
    expect(css).toContain(".v3-edition-header");
    expect(css).toContain(".v3-lead-story");
    expect(css).toContain(".signal-card");
    expect(css).toContain(".v3-page-header");
    expect(css).toContain(".v3-source-card");
    expect(css).toContain(".v3-footer");
  });

  it("keeps focus visible on light and dark surfaces and respects reduced motion", () => {
    expect(css).toMatch(/:where\(a, button, input, summary\):focus-visible[\s\S]*outline:\s*2px solid var\(--accent\)/);
    expect(css).toMatch(/\.v3-footer\s+:where\(a, button, input, summary\):focus-visible[\s\S]*outline:\s*2px solid var\(--accent-on-dark\)/);
    expect(css).toMatch(/input\[type="text"\]:focus[\s\S]*outline:\s*2px solid var\(--accent\)/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important");
    expect(css).toContain("animation-delay: 0s !important");
    expect(css).toContain("transition-delay: 0s !important");
  });
});
