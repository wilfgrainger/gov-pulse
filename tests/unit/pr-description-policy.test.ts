import { describe, expect, it } from "vitest";
import {
  claimedPaths,
  validatePrDescription,
} from "@/scripts/lib/pr-description-policy.mjs";

const head = "0123456789abcdef0123456789abcdef01234567";
const stale = "f".repeat(40);
const run = "https://github.com/wilfgrainger/gov-metrics/actions/runs/123456";
const validBody = `Closes #206

## What changed

- adds \`scripts/check-pr-description.mjs\`;
- updates \`.github/workflows/pr-validation.yml\`.

## Why

Keep descriptions grounded.

## Public impact

None.

## Validation

Exact-head checks are required before merge.
`;

describe("PR description policy", () => {
  it("accepts issue-linked descriptions whose claimed paths are changed", () => {
    expect(
      validatePrDescription(
        validBody,
        ["scripts/check-pr-description.mjs", ".github/workflows/pr-validation.yml"],
        head
      )
    ).toEqual([]);
  });

  it("rejects paths described as changed when absent from the diff", () => {
    const failures = validatePrDescription(
      validBody,
      ["scripts/check-pr-description.mjs"],
      head
    );

    expect(failures.join(" ")).toContain(".github/workflows/pr-validation.yml");
  });

  it("requires the current head and Actions run for completed claims", () => {
    const noEvidence = validBody.replace(
      "Exact-head checks are required before merge.",
      "All checks passed and the release was deployed."
    );
    expect(validatePrDescription(noEvidence, claimedPaths(noEvidence), head).join(" ")).toMatch(
      /exact current head SHA/i
    );

    const staleEvidence = validBody.replace(
      "Exact-head checks are required before merge.",
      `All checks passed for ${stale} at ${run}.`
    );
    const failures = validatePrDescription(staleEvidence, claimedPaths(staleEvidence), head);
    expect(failures.join(" ")).toMatch(/exact current head SHA/i);
    expect(failures.join(" ")).toMatch(/stale/i);
  });

  it("accepts completed evidence only for the exact current head", () => {
    const body = validBody.replace(
      "Exact-head checks are required before merge.",
      `All checks passed for ${head} at ${run}.`
    );

    expect(validatePrDescription(body, claimedPaths(body), head)).toEqual([]);
  });

  it("rejects passed summaries that also contain failed or skipped gates", () => {
    const body = validBody.replace(
      "Exact-head checks are required before merge.",
      `Checks passed for ${head} at ${run}, but E2E was skipped.`
    );

    expect(validatePrDescription(body, claimedPaths(body), head).join(" ")).toMatch(
      /failed or skipped/i
    );
  });
});
