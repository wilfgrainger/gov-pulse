// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshInternationalComparison: vi.fn().mockResolvedValue({ updated: true, due: false }),
}));

vi.mock("@/worker/international-comparison-publication.js", () => mocks);

import { processQueueJob } from "@/worker/queued-publication-entry";

afterEach(() => vi.resetAllMocks());

describe("international comparison queue refresh", () => {
  it("forwards an explicit forced refresh to the isolated comparison publisher", async () => {
    const env = {};
    const fetchImpl = vi.fn();
    const now = new Date("2026-10-03T12:00:00.000Z");

    await processQueueJob(
      { type: "refresh-international-comparison", force: true },
      env,
      {},
      { fetchImpl, now },
    );

    expect(mocks.refreshInternationalComparison).toHaveBeenCalledWith(env, {
      fetchImpl,
      now,
      force: true,
    });
  });
});
