import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageHeader from "@/app/components/PageHeader";

describe("PageHeader", () => {
  it("renders optional route-specific context beside the editorial introduction", () => {
    render(
      <PageHeader
        eyebrow="Primary polling evidence"
        title="Election polling"
        subtitle="Verified pollster releases, shown one at a time."
        current="Politics"
        context={
          <aside aria-label="Polling evidence guide">
            <p>Publication date controls a 14-day evidence window.</p>
          </aside>
        }
      />
    );

    expect(screen.getByRole("heading", { name: "Election polling" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Polling evidence guide" })).toBeInTheDocument();
    expect(screen.getByText(/14-day evidence window/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveClass("text-[var(--muted)]");
    expect(screen.getByText("Verified pollster releases, shown one at a time.")).toHaveClass("text-[var(--muted)]");
  });
});
