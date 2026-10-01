import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EvidenceClassBadge from "@/app/components/EvidenceClassBadge";
import { EVIDENCE_CLASS_LABELS, type EvidenceClass } from "@/app/lib/config";

afterEach(() => {
  cleanup();
});

describe("EvidenceClassBadge", () => {
  it("renders the canonical label for every known evidence class", () => {
    const classes = Object.keys(EVIDENCE_CLASS_LABELS) as EvidenceClass[];
    for (const evidenceClass of classes) {
      render(<EvidenceClassBadge evidenceClass={evidenceClass} />);
      expect(screen.getByText(EVIDENCE_CLASS_LABELS[evidenceClass])).toBeInTheDocument();
      cleanup();
    }
  });

  it("does not rank evidence types against each other in its label text", () => {
    // These are evidence TYPES, not a quality ladder: none of the labels may
    // contain scoring/ranking language such as "confidence", "quality" or a score.
    for (const label of Object.values(EVIDENCE_CLASS_LABELS)) {
      expect(label.toLowerCase()).not.toMatch(/confidence|quality|score|grade|rank/);
    }
  });
});
