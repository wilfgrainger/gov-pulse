import { describe, expect, it } from "vitest";
import {
  durationSeconds,
  median,
  stepSeconds,
} from "@/scripts/lib/workflow-cost.mjs";

describe("workflow cost reporting", () => {
  it("calculates valid durations and rejects incomplete timestamps", () => {
    expect(durationSeconds("2026-07-18T10:00:00Z", "2026-07-18T10:01:30Z")).toBe(90);
    expect(durationSeconds("invalid", "2026-07-18T10:01:30Z")).toBeNull();
  });

  it("calculates medians for odd and even samples", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([])).toBeNull();
  });

  it("extracts only named setup-step durations", () => {
    const jobs = [
      {
        steps: [
          {
            name: "Install dependencies",
            started_at: "2026-07-18T10:00:00Z",
            completed_at: "2026-07-18T10:00:20Z",
          },
          {
            name: "Lint",
            started_at: "2026-07-18T10:00:20Z",
            completed_at: "2026-07-18T10:00:30Z",
          },
        ],
      },
    ];

    expect(stepSeconds(jobs, ["Install dependencies"])).toEqual([20]);
  });
});
