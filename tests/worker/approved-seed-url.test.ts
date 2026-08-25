import { describe, expect, it } from "vitest";
import { approvedSeedUrl, DEFAULT_SEED_URL } from "@/worker/approved-seed-url";

describe("Pages seed URL boundary", () => {
  it("uses the exact configured Pages seed URL", () => {
    expect(approvedSeedUrl()).toBe(DEFAULT_SEED_URL);
    expect(approvedSeedUrl(DEFAULT_SEED_URL)).toBe(DEFAULT_SEED_URL);
  });

  it.each([
    "http://public-data-org.pages.dev/data/metrics-snapshot.json",
    "https://attacker.example/data/metrics-snapshot.json",
    `${DEFAULT_SEED_URL}?redirect=https://attacker.example`,
    `${DEFAULT_SEED_URL}#fragment`,
    "https://user:pass@public-data-org.pages.dev/data/metrics-snapshot.json",
  ])("rejects an unapproved seed URL: %s", (value) => {
    expect(approvedSeedUrl(value)).toBeNull();
  });
});
