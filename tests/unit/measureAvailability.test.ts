import { describe, expect, it } from "vitest";
import { MEASURES } from "@/app/lib/measureDefinitions";
import { measureAvailabilityReason, measurePublisher } from "@/app/lib/measureAvailability";

const nhsMeasure = MEASURES.find(({ id }) => id === "waitingPathwaysEstimate")!;

describe("measure availability explanation", () => {
  it("keeps series-level publishers distinct inside a multi-source section", () => {
    const bankRate = MEASURES.find(({ id }) => id === "bankRate")!;
    expect(measurePublisher(bankRate, {
      status: "ok",
      provenance: { upstreams: [{ publisher: "Office for National Statistics" }] },
    })).toBe("Bank of England");
  });

  it("names the official publisher when its section is absent", () => {
    expect(measureAvailabilityReason(nhsMeasure, { snapshotAvailable: true })).toBe(
      "NHS England evidence is unavailable in this edition; no value is shown.",
    );
  });

  it("distinguishes adapter failures from a missing source section", () => {
    expect(measureAvailabilityReason(nhsMeasure, {
      snapshotAvailable: true,
      source: { status: "ok" },
    })).toBe("No record passed the source, period and history checks for this edition.");
  });

  it("explains when no national edition is available", () => {
    expect(measureAvailabilityReason(nhsMeasure, { snapshotAvailable: false })).toBe(
      "No current national evidence edition is available.",
    );
  });
});
