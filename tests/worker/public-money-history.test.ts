import { afterEach, describe, expect, it, vi } from "vitest";
import publicDataWorker, { CONTRACT_HISTORY_PATH } from "../../worker/public-data-entry.js";

const ocid = "ocds-h6vhtk-047306";

function packageResponse() {
  return new Response(JSON.stringify({ records: [{ ocid, releases: [
    { ocid, id: "019679-2024", date: "2024-06-27T10:00:00Z", tag: ["planning"], tender: { title: "eDiscovery project" } },
    { ocid, id: "003183-2025", date: "2025-01-30T10:00:00Z", tag: ["tender"], tender: { title: "eDiscovery solution" } },
  ] }] }), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("public per-OCID Find a Tender history route", () => {
  it("fetches one validated OCID from the fixed publisher and returns compact source history", async () => {
    const fetchMock = vi.fn(async () => packageResponse());
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`);

    const response = await publicDataWorker.fetch(request, {});
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(`https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/${ocid}`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "error" });
    expect(payload.releases).toHaveLength(2);
    expect(payload.releases[0].tags).toEqual(["planning"]);
  });

  it("rejects missing, malformed, repeated and extra query parameters before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const urls = [
      `https://public-data.org${CONTRACT_HISTORY_PATH}`,
      `https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=../secret`,
      `https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}&ocid=${ocid}`,
      `https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}&debug=true`,
    ];

    for (const url of urls) {
      expect((await publicDataWorker.fetch(new Request(url), {})).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps unknown records unavailable and upstream failures generic", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const unknown = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );
    expect(unknown.status).toBe(404);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    const rateLimited = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );
    expect(rateLimited.status).toBe(503);
    expect(await rateLimited.text()).not.toMatch(/rate|limit|api|find-a-tender/i);
  });

  it("rejects an upstream redirect away from the approved host and caps package bytes", async () => {
    const redirected = packageResponse();
    Object.defineProperty(redirected, "url", { value: "https://attacker.example/record.json" });
    vi.stubGlobal("fetch", vi.fn(async () => redirected));
    const foreign = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );
    expect(foreign.status).toBe(503);

    const oversized = JSON.stringify({ records: [{ ocid, releases: Array.from({ length: 10000 }, (_, index) => ({
      ocid, id: `${String(index % 1000000).padStart(6, "0")}-2026`, date: "2026-01-01T00:00:00Z", tag: ["planning"],
      tender: { description: "x".repeat(60) },
    })) }] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(oversized, { status: 200 })));
    const large = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );
    expect(large.status).toBe(503);
  });

  it("serves no unlisted path and does not expose a source URL parameter", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const unknown = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH.replace("history", "proxy")}?ocid=${ocid}`), {},
    );
    expect(unknown.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
