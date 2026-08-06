import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicationLedger, { PUBLICATION_LEDGER } from "@/app/components/PublicationLedger";

describe("PublicationLedger", () => {
  it("publishes a bounded eight-signal release governance registry", () => {
    expect(PUBLICATION_LEDGER).toHaveLength(8);
    expect(new Set(PUBLICATION_LEDGER.map((entry) => entry.id)).size).toBe(8);
  });

  it("uses HTTPS publisher calendar or release-area links", () => {
    expect(PUBLICATION_LEDGER.every((entry) => entry.calendarUrl.startsWith("https://"))).toBe(true);
  });

  it("fails closed when only cadence evidence is available", () => {
    const cadenceOnly = PUBLICATION_LEDGER.filter((entry) => entry.readiness === "Publisher schedule");
    expect(cadenceOnly.map((entry) => entry.id)).toEqual([
      "election-polling",
      "betting-markets",
      "nhs-rtt",
    ]);

    render(<PublicationLedger />);
    expect(screen.getByText(/do not, by themselves, establish that the latest figures are present/i)).toBeInTheDocument();
  });

  it("keeps a revision policy for every row", () => {
    expect(PUBLICATION_LEDGER.every((entry) => entry.revisionPolicy.length > 40)).toBe(true);
  });

  it("records exact migration and NHS contracts", () => {
    expect(PUBLICATION_LEDGER.find((entry) => entry.id === "migration")?.publisher).toBe(
      "Office for National Statistics"
    );
    const nhs = PUBLICATION_LEDGER.find((entry) => entry.id === "nhs-rtt");
    expect(nhs?.signal).toBe("NHS referral-to-treatment waiting times");
    expect(nhs?.revisionPolicy).toMatch(/do not mix A&E, GP, workforce or life-expectancy/i);
  });
});
