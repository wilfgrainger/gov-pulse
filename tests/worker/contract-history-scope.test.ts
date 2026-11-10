// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENT_RECORD_KEY } from "@/feeds/government-contracts/parse.js";
import { contractHistoryResponse } from "@/worker/public-data-entry";

const PUBLISHED = "ocds-h6vhtk-030512";
const env = (key: string, value: unknown) => ({
  METRICS_CACHE: { get: vi.fn(async (name: string) => (name === key ? value : null)) },
});
const record = { section: "governmentContracts", data: { awards: [{ ocid: PUBLISHED }] } };
const call = (ocid: string, e: unknown) => {
  const url = new URL(`https://public-data.org/data/contracts/history.json?ocid=${ocid}`);
  return contractHistoryResponse(new Request(url), url, e);
};

afterEach(() => vi.unstubAllGlobals());

describe("contract release history scope", () => {
  it("never calls Find a Tender for an identifier outside the published record", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const e of [env(CURRENT_RECORD_KEY, record), env(CURRENT_RECORD_KEY, null), {}]) {
      const response = await call("ocds-h6vhtk-0deadbeef", e);
      expect(response.status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("looks up a published identifier, from the legacy key or the per-feed record", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await call(PUBLISHED.toUpperCase().replace("OCDS-H6VHTK", "ocds-h6vhtk"), env(CURRENT_RECORD_KEY, record));
    await call(PUBLISHED, env("v20:feed:governmentContracts", { feedId: "governmentContracts", record, lastAttempt: { status: "success" } }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
