import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Controls what framer-motion's useReducedMotion reports for each test.
const reducedMotion = { current: false as boolean | null };

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => reducedMotion.current,
  };
});

import Reveal from "@/app/components/Reveal";

afterEach(() => {
  cleanup();
  reducedMotion.current = false;
});

describe("Reveal", () => {
  it("renders its children so content is never gated behind the wrapper", () => {
    reducedMotion.current = true;
    render(
      <Reveal>
        <p>Evidence is always visible.</p>
      </Reveal>,
    );

    expect(screen.getByText("Evidence is always visible.")).toBeInTheDocument();
  });

  it("renders a plain visible element with its children under prefers-reduced-motion", () => {
    reducedMotion.current = true;
    const { container } = render(
      <Reveal as="article" className="evidence-article">
        <span>Reduced-motion content</span>
      </Reveal>,
    );

    const article = container.querySelector("article.evidence-article");
    expect(article).not.toBeNull();
    // The child text is present in the DOM, not hidden pending an animation.
    expect(article).toHaveTextContent("Reduced-motion content");
    expect(screen.getByText("Reduced-motion content")).toBeVisible();
  });

  it("uses the requested element tag and passes className through", () => {
    reducedMotion.current = true;
    const { container } = render(
      <Reveal as="section" className="lead-block">
        <p>Section body</p>
      </Reveal>,
    );

    expect(container.querySelector("section.lead-block")).not.toBeNull();
  });
});
