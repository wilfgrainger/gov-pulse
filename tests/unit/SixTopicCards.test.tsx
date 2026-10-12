import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NationalEvidenceEdition from "@/app/components/NationalEvidenceEdition";
import { selectNationalEvidenceEdition } from "@/app/lib/nationalEvidence";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

afterEach(() => {
  cleanup();
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const NOW = "2026-10-05T09:00:00.000Z";

// Mirrors production today: only nationalDebt is published, with the August
// 2026 ONS generator figures (HF6W £2,985.5bn, HF6X 93.8%) released on
// 22 September 2026. Every other topic has no published source.
function debtOnlySnapshot() {
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: NOW,
      sources: { nationalDebt: { status: "ok", cacheState: "fresh", fetchedAt: NOW } },
    },
    nationalDebt: {
      baseDebt: 2_985_500_000_000,
      baseDate: Date.parse("2026-08-31T00:00:00.000Z"),
      observationPeriod: "2026 AUG",
      publicationDate: "2026-09-22",
      debtToGdp: 93.8,
      history: [
        { observedAt: Date.parse("2026-07-31"), debtToGdp: 93.9 },
        { observedAt: Date.parse("2026-08-31"), debtToGdp: 93.8 },
      ],
    },
  };
}

describe("Six topic cards", () => {
  it("renders exactly six topic cards in reading order", () => {
    render(<NationalEvidenceEdition initialEdition={selectNationalEvidenceEdition(debtOnlySnapshot())} />);
    const cards = within(screen.getByTestId("topic-cards")).getAllByTestId("signal-card");
    expect(cards).toHaveLength(6);
    expect(cards.map((card) => card.querySelector(".eyebrow")?.textContent)).toEqual([
      "Prices", "Jobs", "Debt", "Rents", "NHS", "Contracts",
    ]);
  });

  it("shows the verified debt figure and labels the other five unavailable, never zero", () => {
    render(<NationalEvidenceEdition initialEdition={selectNationalEvidenceEdition(debtOnlySnapshot())} />);
    const cards = within(screen.getByTestId("topic-cards")).getAllByTestId("signal-card");
    const debt = cards.find((card) => card.getAttribute("href") === "/section/national-debt");
    expect(debt?.getAttribute("data-evidence-state")).toBe("current");
    expect(debt?.textContent).toContain("93.8% of GDP");
    expect(debt?.textContent).toContain("Published 22 Sept 2026");

    const others = cards.filter((card) => card !== debt);
    expect(others).toHaveLength(5);
    for (const card of others) {
      expect(card.getAttribute("data-evidence-state")).toBe("unavailable");
      expect(card.textContent).toContain("Current value unavailable");
      expect(card.textContent).toContain("No older value is substituted.");
      expect(card.textContent).not.toMatch(/(^|\D)0(\.0)?%/);
    }
  });

  it("keeps the NHS waiting list card unavailable while NHS England evidence is missing", () => {
    render(<NationalEvidenceEdition initialEdition={selectNationalEvidenceEdition(debtOnlySnapshot())} />);
    const nhs = within(screen.getByTestId("topic-cards"))
      .getAllByTestId("signal-card")
      .find((card) => card.getAttribute("href") === "/section/nhs");
    expect(nhs?.getAttribute("data-evidence-state")).toBe("unavailable");
    expect(nhs?.textContent).toContain("NHS waiting list");
    expect(nhs?.textContent).toContain("England");
    expect(nhs?.textContent).not.toMatch(/pathways/);
  });


  it("uses editorial card sizes based on evidence richness", () => {
    render(<NationalEvidenceEdition initialEdition={selectNationalEvidenceEdition(debtOnlySnapshot())} />);
    const cards = within(screen.getByTestId("topic-cards")).getAllByTestId("signal-card");
    const debt = cards.find((card) => card.getAttribute("href") === "/section/national-debt");
    expect(debt?.getAttribute("data-card-size")).toBe("feature");
    expect(cards.filter((card) => card !== debt).every((card) => card.getAttribute("data-card-size") === "compact")).toBe(true);
  });

  it("keeps debt as the lead while the other topics are unavailable", () => {
    const edition = selectNationalEvidenceEdition(debtOnlySnapshot());
    expect(edition.lead?.id).toBe("national-debt");
    expect(edition.counts).toEqual({ current: 1, "update-due": 0, unavailable: 5 });
  });

  it("renders six unavailable cards when there is no compatible snapshot", () => {
    render(<NationalEvidenceEdition initialEdition={selectNationalEvidenceEdition(null)} />);
    const cards = within(screen.getByTestId("topic-cards")).getAllByTestId("signal-card");
    expect(cards).toHaveLength(6);
    expect(cards.every((card) => card.getAttribute("data-evidence-state") === "unavailable")).toBe(true);
  });
});
