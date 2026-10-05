import { afterEach, describe, expect, it, vi } from "vitest";
import publicDataWorker, { CONTRACT_HISTORY_PATH } from "../../worker/public-data-entry.js";
import { MAX_RESPONSE_BYTES } from "../../worker/response-limits.js";

const ocid = "ocds-h6vhtk-047306";

function packageResponse() {
  return new Response(JSON.stringify({ records: [{ ocid, releases: [
    { ocid, id: "019679-2024", date: "2024-06-27T10:00:00Z", tag: ["planning"], tender: { title: "eDiscovery project" } },
    { ocid, id: "003183-2025", date: "2025-01-30T10:00:00Z", tag: ["tender"], tender: { title: "eDiscovery solution" } },
  ] }] }), { status: 200, headers: { "content-type": "application/json" } });
}

function releasePackageResponse() {
  return new Response(JSON.stringify({ releases: [
    { ocid, id: "019679-2024", date: "2024-06-27T10:00:00Z", tag: ["planning"], tender: { title: "eDiscovery project" } },
    { ocid, id: "003183-2025", date: "2025-01-30T10:00:00Z", tag: ["tender"], tender: { title: "eDiscovery solution" } },
  ] }), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: {
        Accept: "application/json",
        "User-Agent": "public-data.org-cloudflare-contracts/1.0",
      },
      redirect: "manual",
    });
    expect(payload.releases).toHaveLength(2);
    expect(payload.releases[0].tags).toEqual(["planning"]);
  });

  it("serves a valid 35-release record package larger than the former 512 KiB cap", async () => {
    const releases = Array.from({ length: 35 }, (_, index) => ({
      ocid,
      id: `${String(index + 1).padStart(6, "0")}-2026`,
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      tag: ["contractUpdate"],
      tender: { title: `Amendment ${index + 1}`, description: "source detail ".repeat(1800) },
    }));
    const sourcePackage = JSON.stringify({ records: [{ ocid, releases }] });
    expect(new TextEncoder().encode(sourcePackage).byteLength).toBeGreaterThan(512 * 1024);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sourcePackage, {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    const response = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.releases).toHaveLength(35);
  });

  it("falls back to the publisher's release package after record-package transport failure", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(releasePackageResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/${ocid}`,
      `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages/${ocid}`,
    ]);
    expect(payload.source.packageUrl).toBe(`https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages/${ocid}`);
    expect(payload.releases).toHaveLength(2);
  });

  it("does not follow or retry an upstream redirect", async () => {
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://attacker.example/record-package" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
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

  it("records private, bounded failure context without logging source response content", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream body must stay private", { status: 403 })));

    const response = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(JSON.stringify({ error: "Release history is temporarily unavailable" }));
    expect(warning).toHaveBeenCalledWith("contract_history_unavailable", {
      ocid,
      stage: "upstream_response",
      upstreamStatus: 403,
      errorName: "Error",
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("upstream body must stay private");
  });

  it("records a safe transport error code without exposing its message", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cause = Object.assign(new Error("private upstream detail"), { code: "ECONNRESET" });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed", { cause });
    }));

    const response = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(JSON.stringify({ error: "Release history is temporarily unavailable" }));
    expect(warning).toHaveBeenCalledWith("contract_history_unavailable", {
      ocid,
      stage: "upstream_fetch",
      upstreamStatus: null,
      errorName: "TypeError",
      errorCauseCode: "ECONNRESET",
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private upstream detail");
  });

  it("rejects an upstream redirect away from the approved host and caps package bytes", async () => {
    const redirected = packageResponse();
    Object.defineProperty(redirected, "url", { value: "https://attacker.example/record.json" });
    vi.stubGlobal("fetch", vi.fn(async () => redirected));
    const foreign = await publicDataWorker.fetch(
      new Request(`https://public-data.org${CONTRACT_HISTORY_PATH}?ocid=${ocid}`), {},
    );
    expect(foreign.status).toBe(503);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {
      status: 200,
      headers: { "content-length": String(MAX_RESPONSE_BYTES.json + 1) },
    })));
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

// Exercise the enabled-publication behavior independently of the production pause.
vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{ default: { publications: Record<string, { enabled: boolean }> } }>();
  return { default: { ...config, publications: { ...Object.fromEntries(Object.entries(config.publications).map(([id, entry]) => [id, { ...entry, enabled: true }])), ons: { enabled: true } } } };
});
