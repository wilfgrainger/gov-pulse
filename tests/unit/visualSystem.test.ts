import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("consumer visual system", () => {
  it("uses a calm page surface and flat editorial evidence panels", () => {
    expect(css).toContain("--background: #f7f3eb");
    expect(css).toContain("--surface: #ffffff");
    expect(css).toContain("--foreground: #172234");
    expect(css).toContain('--font-editorial: Georgia, "Times New Roman", serif');
    expect(css).not.toMatch(/Bebas Neue|IBM Plex Mono/);
    expect(css).toMatch(/\.dashboard-card\s*\{[\s\S]*border-top:\s*1px solid var\(--foreground\) !important/);
    expect(css).toMatch(/\.dashboard-card\s*\{[\s\S]*border-radius:\s*0/);
    expect(css).toMatch(/\.dashboard-card\s*\{[\s\S]*box-shadow:\s*none/);
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

  it("reserves hard offset shadows for deliberate emphasis rather than evidence panels", () => {
    const dashboardCardBlock = css.match(/\.dashboard-card\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(dashboardCardBlock).not.toContain("4px 4px 0");
    expect(dashboardCardBlock).not.toContain("8px 8px 0");
    expect(dashboardCardBlock).toContain("box-shadow: none");
  });
});
