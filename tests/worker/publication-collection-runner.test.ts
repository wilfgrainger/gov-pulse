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

  describe("dual write to per-feed records", () => {
    function kvStore() {
      const store = new Map<string, string>();
      const put = vi.fn(async (key: string, value: string) => { store.set(key, value); });
      const get = vi.fn(async (key: string) => {
        const raw = store.get(key);
        return raw === undefined ? null : JSON.parse(raw);
      });
      return { env: { METRICS_CACHE: { get, put } }, store, put };
    }
    const gdp = (fetchedAt: string) => ({
      section: "gdpTracker",
      data: { headline: { monthlyGrowth: 0.1, period: "May 2026" } },
      source: { status: "ok", cacheState: "fresh", fetchedAt, source: "ONS" },
      fetchedAt,
    });

    it("writes the v20 feed record alongside the legacy fragment", async () => {
      const { env, store } = kvStore();
      const record = gdp(new Date().toISOString());
      mocks.refreshSectionPayload.mockResolvedValue(record);

      await storeSectionFragment("gdpTracker", env, {}, "run-1");

      expect(JSON.parse(store.get("v20:feed:gdpTracker")!).record).toEqual(record);
      expect(JSON.parse(store.get(sectionFragmentKey("gdpTracker"))!)).toEqual(record);
    });

    it("keeps the legacy result when the feed record write fails", async () => {
      const { env, store, put } = kvStore();
      const record = gdp(new Date().toISOString());
      mocks.refreshSectionPayload.mockResolvedValue(record);
      put.mockImplementation(async (key: string, value: string) => {
        if (key.startsWith("v20:feed:")) throw new Error("feed write failed");
        store.set(key, value);
      });

      await expect(storeSectionFragment("gdpTracker", env, {}, "run-1")).resolves.toEqual(record);
      expect(store.has(sectionFragmentKey("gdpTracker"))).toBe(true);
    });

    it("kv budget > dual-write healthy run writes at most 50", async () => {
      const { env, put } = kvStore();
      const generic = ["gdpTracker", "sentimentPulse", "employmentStats", "taxRevenue",
        "nationalDebt", "migrationStats", "housePriceIndex", "realWages"];
      for (const section of generic) {
        mocks.refreshSectionPayload.mockResolvedValueOnce({
          ...gdp(new Date().toISOString()), section,
        });
        await storeSectionFragment(section, env, {}, "run-1");
      }
      mocks.collectExternalSection.mockResolvedValueOnce({
        ...gdp(new Date().toISOString()), section: "electionPolling",
      });
      await storeExternalSection("electionPolling", env, { runId: "run-1" });
      // run fragment + legacy global + v20 feed record per feed
      expect(put.mock.calls.length).toBe(9 * 3);
      expect(put.mock.calls.length).toBeLessThanOrEqual(50);
    });
  });
});
