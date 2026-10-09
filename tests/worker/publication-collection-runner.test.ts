// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshSectionPayload: vi.fn(),
  collectExternalSection: vi.fn(),
}));

vi.mock("@/worker/publication-entry", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, refreshSectionPayload: mocks.refreshSectionPayload };
});

vi.mock("@/worker/live-feed-collectors", () => ({
  collectExternalSection: mocks.collectExternalSection,
}));

import {
  PUBLICATION_SECTION_PREFIX,
  sectionFragmentKey,
  storeExternalSection,
  storeSectionFragment,
} from "@/worker/publication-collection-runner";

function environment() {
  const put = vi.fn(async () => undefined);
  return { env: { METRICS_CACHE: { put } }, put };
}

describe("publication collection runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores generic section records under the canonical fragment key", async () => {
    const { env, put } = environment();
    const record = { section: "gdpTracker", data: { value: 1 } };
    mocks.refreshSectionPayload.mockResolvedValue(record);

    await expect(storeSectionFragment("gdpTracker", env, {})).resolves.toEqual(record);

    expect(mocks.refreshSectionPayload).toHaveBeenCalledWith("gdpTracker", env, {});
    expect(put).toHaveBeenCalledWith(
      `${PUBLICATION_SECTION_PREFIX}gdpTracker`,
      JSON.stringify(record),
      undefined,
    );
  });

  it("stores external collector records through the same fragment namespace", async () => {
    const { env, put } = environment();
    const record = { section: "electionPolling", data: { value: 2 } };
    mocks.collectExternalSection.mockResolvedValue(record);

    await expect(
      storeExternalSection("electionPolling", env, { now: new Date("2026-10-06T10:00:00.000Z") }),
    ).resolves.toEqual(record);

    expect(put).toHaveBeenCalledWith(
      sectionFragmentKey("electionPolling"),
      JSON.stringify(record),
      undefined,
    );
  });

  it("rejects sections routed to the wrong collector type before collecting", async () => {
    const { env } = environment();

    await expect(storeSectionFragment("electionPolling", env, {}))
      .rejects.toThrow(/outside the generic publication set/);
    await expect(storeExternalSection("gdpTracker", env, {}))
      .rejects.toThrow(/outside the external publication set/);

    expect(mocks.refreshSectionPayload).not.toHaveBeenCalled();
    expect(mocks.collectExternalSection).not.toHaveBeenCalled();
  });

  it("has one deterministic fragment key per section", () => {
    expect(sectionFragmentKey("nationalDebt")).toBe(
      "v12:publication:section:nationalDebt"
    );
  });
});
