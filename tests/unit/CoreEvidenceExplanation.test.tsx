import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";

afterEach(() => cleanup());

describe("CoreEvidenceExplanation", () => {
  it("renders the five-part editorial contract with a direct source and date", () => {
    render(
      <CoreEvidenceExplanation
        idPrefix="example"
        why={<p>This evidence informs a public decision without proving a cause.</p>}
        definition={<p>A precisely named public measure.</p>}
        unit="Percentage"
        geography="United Kingdom"
        interpretation={<p>Higher and lower values have a defined, limited meaning.</p>}
        caveat={<p>The estimate can be revised.</p>}
        sourceLabel="Official publisher release"
        sourceUrl="https://example.gov.uk/release"
        sourceDate="Published 15 July 2026 · observation period June 2026"
      />
    );

    expect(screen.getByRole("heading", { name: "Why it matters" })).toBeInTheDocument();
    expect(screen.getByText("Explain this number")).toBeInTheDocument();
    expect(screen.getByText("Definition")).toBeInTheDocument();
    expect(screen.getByText("Unit and geography")).toBeInTheDocument();
    expect(screen.getByText("How to interpret it")).toBeInTheDocument();
    expect(screen.getByText("Important caveat")).toBeInTheDocument();
    expect(screen.getByText("Source and date")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Official publisher release" })).toHaveAttribute(
      "href",
      "https://example.gov.uk/release"
    );
    expect(screen.getByText(/Published 15 July 2026/i)).toBeInTheDocument();
  });
});
