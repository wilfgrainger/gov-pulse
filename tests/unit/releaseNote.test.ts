import { describe, expect, it } from "vitest";
import { buildReleaseNote } from "@/app/lib/releaseNote";

const NOW = new Date("2026-05-25T00:00:00Z");

describe("buildReleaseNote", () => {
  it("produces a release-count, direction and consecutive-run sentence from history alone", () => {
    const note = buildReleaseNote({
      measureLabel: "Net migration",
      latestValueDisplay: "171,000",
      latestPeriod: "the year ending December 2025",
      releaseDate: "2026-05-21",
      history: [
        { observedAt: Date.UTC(2023, 0, 0), value: 500_000 },
        { observedAt: Date.UTC(2024, 0, 0), value: 331_000 },
        { observedAt: Date.UTC(2025, 0, 0), value: 171_000 },
      ],
      now: NOW,
    });

    expect(note.sentences).toEqual([
      "This is release 3 of net migration in the retained history, covering the year ending December 2025 (published 4 days ago).",
      "Net migration fell to 171,000, a change of -48.3% from the prior comparable period.",
      "This is the 2nd consecutive period of decline.",
    ]);
  });

  it("omits the consecutive-run clause when there are fewer than 3 comparable points", () => {
    const note = buildReleaseNote({
      measureLabel: "Monthly GDP growth",
      latestValueDisplay: "+0.2%",
      latestPeriod: "March 2026",
      releaseDate: "2026-05-14",
      history: [
        { observedAt: Date.UTC(2026, 1, 1), value: 0.1 },
        { observedAt: Date.UTC(2026, 2, 1), value: 0.2 },
      ],
      now: NOW,
    });

    expect(note.sentences.some((s) => s.includes("consecutive"))).toBe(false);
    expect(note.sentences).toContain(
      "Monthly GDP growth rose to +0.2%, a change of +100.0% from the prior comparable period."
    );
  });

  it("omits the consecutive-run clause when the latest step reverses the prior run", () => {
    const note = buildReleaseNote({
      measureLabel: "The unemployment rate",
      latestValueDisplay: "4.5%",
      latestPeriod: "Jan-Mar 2026",
      releaseDate: "2026-05-14",
      history: [
        { observedAt: Date.UTC(2025, 10, 1), value: 4.0 },
        { observedAt: Date.UTC(2025, 11, 1), value: 4.2 },
        { observedAt: Date.UTC(2026, 0, 1), value: 4.3 },
        { observedAt: Date.UTC(2026, 1, 1), value: 4.1 },
        { observedAt: Date.UTC(2026, 2, 1), value: 4.5 },
      ],
      now: NOW,
    });

    // Steps are: rise, rise, fall, rise. The latest step is a rise, but the
    // immediately preceding step was a fall, so the current run length is 1
    // and no consecutive-run clause should be produced.
    expect(note.sentences.some((s) => s.includes("consecutive"))).toBe(false);
  });

  it("adds the provisional clause only when explicitly true, and omits it otherwise", () => {
    const base = {
      measureLabel: "Net migration",
      latestValueDisplay: "171,000",
      latestPeriod: "the year ending December 2025",
      releaseDate: "2026-05-21",
      history: [
        { observedAt: Date.UTC(2024, 0, 0), value: 331_000 },
        { observedAt: Date.UTC(2025, 0, 0), value: 171_000 },
      ],
      now: NOW,
    };

    expect(buildReleaseNote({ ...base, provisional: true }).text).toContain(
      "This release is provisional and may be revised in a later publication."
    );
    expect(buildReleaseNote({ ...base, provisional: false }).text).not.toContain("provisional");
    expect(buildReleaseNote(base).text).not.toContain("provisional");
  });

  it("reports an unchanged value without inventing a direction", () => {
    const note = buildReleaseNote({
      measureLabel: "Monthly GDP growth",
      latestValueDisplay: "+0.0%",
      latestPeriod: "April 2026",
      releaseDate: "2026-06-11",
      history: [
        { observedAt: Date.UTC(2026, 2, 1), value: 0.2 },
        { observedAt: Date.UTC(2026, 3, 1), value: 0.2 },
      ],
      now: NOW,
    });

    expect(note.sentences).toContain("Monthly GDP growth was unchanged from the prior comparable period, at +0.0%.");
  });

  it("returns no sentences at all when history and release date are both unusable", () => {
    const note = buildReleaseNote({
      measureLabel: "Net migration",
      latestValueDisplay: "171,000",
      latestPeriod: "the year ending December 2025",
      releaseDate: "not-a-date",
      history: [],
      now: NOW,
    });

    expect(note.sentences).toEqual([]);
    expect(note.text).toBe("");
  });

  it("never divides by a zero prior value", () => {
    const note = buildReleaseNote({
      measureLabel: "Net migration",
      latestValueDisplay: "50,000",
      latestPeriod: "the year ending December 2025",
      releaseDate: "2026-05-21",
      history: [
        { observedAt: Date.UTC(2024, 0, 0), value: 0 },
        { observedAt: Date.UTC(2025, 0, 0), value: 50_000 },
      ],
      now: NOW,
    });

    expect(note.sentences.some((s) => s.includes("change of"))).toBe(false);
  });
});
