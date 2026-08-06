// @vitest-environment node

import { describe, expect, it } from "vitest";
import { validateSnapshotAge } from "@/scripts/snapshot-canary.mjs";

describe("published snapshot canary", () => {
  it("allows minor clock skew but rejects implausible future timestamps", () => {
    const now = Date.parse("2026-07-15T12:00:00Z");

    expect(() =>
      validateSnapshotAge("2026-07-15T12:04:59Z", now)
    ).not.toThrow();
    expect(() =>
      validateSnapshotAge("2026-07-15T12:05:01Z", now)
    ).toThrow("outside the six-hour canary window");
  });
});
