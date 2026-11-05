// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assertApprovedSourceUrl,
  fetchWithApprovedRedirects,
} from "@/worker/response-limits";
import {
  APPROVED_SOURCE_HOSTS,
  NHS_ENGLAND_HOSTS,
  YOU_GOV_ARTICLE_HOSTS,
  YOU_GOV_RESULTS_HOSTS,
} from "@/worker/approved-source-hosts";
import { SOURCE_CATALOG } from "@/contracts/source-catalog";
import { fetchOfficialResponse } from "@/worker/official-source-fetch";
import { fetchResponse } from "@/worker/live-feed-common";
import { fetchSlice } from "@/worker/government-contracts-cloudflare";
import { fetchPublicationSeedSnapshot } from "@/worker/publication-recovery";

const APPROVED = new Set(["www.ons.gov.uk", "www.gov.uk"]);

function redirect(location: string, status = 302) {
  return new Response("redirect body", { status, headers: { location } });
}

function cancellable(response: Response) {
  const cancel = vi.fn(async () => undefined);
  Object.defineProperty(response, "body", { value: { cancel } });
  return { response, cancel };
}

describe("assertApprovedSourceUrl", () => {
  it("returns a parsed URL for an approved HTTPS host", () => {
    const url = assertApprovedSourceUrl("https://WWW.ONS.GOV.UK/releasecalendar", APPROVED);
    expect(url).toBeInstanceOf(URL);
    expect(url.toString()).toBe("https://www.ons.gov.uk/releasecalendar");
  });

  it.each([
    ["off-host", "https://evil.example/releasecalendar"],
    ["lookalike suffix", "https://www.ons.gov.uk.evil.example/releasecalendar"],
    ["cleartext http://", "http://www.ons.gov.uk/releasecalendar"],
    ["userinfo", "https://user:secret@www.ons.gov.uk/releasecalendar"],
    ["username only", "https://user@www.ons.gov.uk/releasecalendar"],
    ["explicit port", "https://www.ons.gov.uk:8443/releasecalendar"],
    ["unparseable", "not a url"],
  ])("rejects an %s URL", (_label, value) => {
    expect(() => assertApprovedSourceUrl(value, APPROVED)).toThrow(/approved/i);
  });

  it("requires an explicit approved host set", () => {
    expect(() =>
      assertApprovedSourceUrl("https://www.ons.gov.uk/", undefined as unknown as Set<string>),
    ).toThrow(/approved host set/i);
  });
});

describe("fetchWithApprovedRedirects", () => {
  it("the request is never sent for a rejected URL", async () => {
    const fetchSpy = vi.fn(async () => new Response("never"));
    for (const value of [
      "https://evil.example/data.csv",
      "http://www.ons.gov.uk/data.csv",
      "https://user:pw@www.ons.gov.uk/data.csv",
      "https://www.ons.gov.uk:444/data.csv",
    ]) {
      await expect(
        fetchWithApprovedRedirects(value, {}, APPROVED, fetchSpy),
      ).rejects.toThrow(/approved/i);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks the runtime not to follow redirects and preserves the request init", async () => {
    const fetchSpy = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response("ok"),
    );
    const signal = AbortSignal.timeout(5_000);
    await fetchWithApprovedRedirects(
      "https://www.ons.gov.uk/a",
      { headers: { Accept: "text/csv" }, signal, redirect: "follow" },
      APPROVED,
      fetchSpy,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://www.ons.gov.uk/a");
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      headers: { Accept: "text/csv" },
      redirect: "manual",
      signal,
    });
  });

  it("follows relative and approved cross-host redirects, validating every hop", async () => {
    const responses = [
      redirect("/b", 301),
      redirect("https://www.gov.uk/c", 302),
      new Response("final"),
    ];
    const fetchSpy = vi.fn(async () => responses.shift() as Response);
    const response = await fetchWithApprovedRedirects(
      "https://www.ons.gov.uk/a",
      {},
      APPROVED,
      fetchSpy,
    );
    expect(await response.text()).toBe("final");
    expect(fetchSpy.mock.calls.map((call) => call[0])).toEqual([
      "https://www.ons.gov.uk/a",
      "https://www.ons.gov.uk/b",
      "https://www.gov.uk/c",
    ]);
  });

  it("rejects a redirect off-host on hop 2 without requesting it and cancels the redirect body", async () => {
    const first = redirect("https://www.ons.gov.uk/b");
    const second = cancellable(redirect("https://evil.example/c"));
    const responses = [first, second.response];
    const fetchSpy = vi.fn(async () => responses.shift() as Response);

    await expect(
      fetchWithApprovedRedirects("https://www.ons.gov.uk/a", {}, APPROVED, fetchSpy),
    ).rejects.toThrow(/redirected away from its approved HTTPS host/i);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls.map((call) => call[0])).not.toContain("https://evil.example/c");
    expect(second.cancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["cleartext", "http://www.ons.gov.uk/b"],
    ["userinfo", "https://a:b@www.ons.gov.uk/b"],
    ["port", "https://www.ons.gov.uk:8080/b"],
  ])("rejects a %s redirect target", async (_label, location) => {
    const fetchSpy = vi.fn(async () => redirect(location));
    await expect(
      fetchWithApprovedRedirects("https://www.ons.gov.uk/a", {}, APPROVED, fetchSpy),
    ).rejects.toThrow(/approved/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("allows at most 3 redirect hops", async () => {
    let hop = 0;
    const fetchSpy = vi.fn(async () => {
      hop += 1;
      return redirect(`https://www.ons.gov.uk/hop-${hop}`);
    });
    await expect(
      fetchWithApprovedRedirects("https://www.ons.gov.uk/start", {}, APPROVED, fetchSpy),
    ).rejects.toThrow(/more than 3 redirects/i);
    // The original request plus three followed hops; the fourth Location is never requested.
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("accepts exactly 3 redirect hops", async () => {
    const responses = [
      redirect("/1"),
      redirect("/2"),
      redirect("/3"),
      new Response("done"),
    ];
    const fetchSpy = vi.fn(async () => responses.shift() as Response);
    const response = await fetchWithApprovedRedirects(
      "https://www.ons.gov.uk/0",
      {},
      APPROVED,
      fetchSpy,
    );
    expect(await response.text()).toBe("done");
  });

  it("rejects a redirect without a Location header and cancels its body", async () => {
    const bare = cancellable(new Response(null, { status: 302 }));
    const fetchSpy = vi.fn(async () => bare.response);
    await expect(
      fetchWithApprovedRedirects("https://www.ons.gov.uk/a", {}, APPROVED, fetchSpy),
    ).rejects.toThrow(/without a Location/i);
    expect(bare.cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects and cancels a response whose runtime-reported URL left the approved set", async () => {
    // Defence in depth for a fetch implementation that ignores redirect: "manual".
    const cancel = vi.fn(async () => undefined);
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://evil.example/elsewhere",
      headers: new Headers(),
      body: { cancel },
    }) as unknown as Response);
    await expect(
      fetchWithApprovedRedirects("https://www.ons.gov.uk/a", {}, APPROVED, fetchSpy),
    ).rejects.toThrow(/redirected away from its approved HTTPS host/i);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe("approved source host set", () => {
  it("is derived from every primary URL in the source catalog", () => {
    for (const source of Object.values(SOURCE_CATALOG) as Array<{ id: string; primaryUrls: string[] }>) {
      for (const url of source.primaryUrls) {
        expect(APPROVED_SOURCE_HOSTS.has(new URL(url).hostname), `${source.id}: ${url}`).toBe(true);
        expect(() => assertApprovedSourceUrl(url, APPROVED_SOURCE_HOSTS)).not.toThrow();
      }
    }
  });

  it("includes the retrieval hosts collectors already discover or query", () => {
    for (const host of [
      ...YOU_GOV_ARTICLE_HOSTS,
      ...YOU_GOV_RESULTS_HOSTS,
      ...NHS_ENGLAND_HOSTS,
      "sdmx.oecd.org",
    ]) {
      expect(APPROVED_SOURCE_HOSTS.has(host), host).toBe(true);
    }
  });

  it("is immutable and contains only bare lower-case hostnames", () => {
    expect(Object.isFrozen(APPROVED_SOURCE_HOSTS)).toBe(true);
    expect(() => (APPROVED_SOURCE_HOSTS as Set<string>).add("evil.example")).toThrow();
    expect(APPROVED_SOURCE_HOSTS.has("evil.example")).toBe(false);
    for (const host of APPROVED_SOURCE_HOSTS) {
      expect(host).toMatch(/^[a-z0-9.-]+$/);
    }
  });
});

describe("collector fetch boundaries pre-check the requested origin", () => {
  it("fetchOfficialResponse never sends a request to an unapproved URL", async () => {
    const fetchSpy = vi.fn(async () => new Response("never"));
    await expect(
      fetchOfficialResponse("https://evil.example/source", { fetchImpl: fetchSpy }),
    ).rejects.toThrow(/approved/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetchResponse never sends a request to an unapproved URL", async () => {
    const fetchSpy = vi.fn(async () => new Response("never"));
    await expect(
      fetchResponse("http://yougov.com/en-gb/articles", fetchSpy),
    ).rejects.toThrow(/approved/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetchOfficialResponse does not retry an off-host redirect and does not follow it", async () => {
    const fetchSpy = vi.fn(async () => redirect("https://evil.example/stolen"));
    await expect(
      fetchOfficialResponse("https://www.ons.gov.uk/source", { fetchImpl: fetchSpy }),
    ).rejects.toThrow(/redirected away/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("fetchResponse rejects an off-host redirect without following it", async () => {
    const fetchSpy = vi.fn(async () => redirect("https://evil.example/stolen"));
    await expect(
      fetchResponse("https://yougov.com/en-gb/articles", fetchSpy),
    ).rejects.toThrow(/redirected away/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("fetchResponse follows an approved same-host redirect", async () => {
    const responses = [redirect("/en-gb/articles/1"), new Response("article")];
    const fetchSpy = vi.fn(async () => responses.shift() as Response);
    const response = await fetchResponse("https://yougov.com/en-gb/articles", fetchSpy);
    expect(await response.text()).toBe("article");
    expect(fetchSpy.mock.calls[1][0]).toBe("https://yougov.com/en-gb/articles/1");
  });

  it("cancels the body of an unsuccessful fetchResponse response", async () => {
    const failed = cancellable(new Response("denied", { status: 403 }));
    await expect(
      fetchResponse("https://yougov.com/en-gb/articles", async () => failed.response),
    ).rejects.toThrow(/403/);
    expect(failed.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("other collector fetches use manual, approved redirects", () => {
  const slice = {
    updatedFrom: "2026-11-04T00:00:00",
    updatedTo: "2026-11-04T06:00:00",
  };

  it("Find a Tender slices never follow a redirect off the API host", async () => {
    const fetchSpy = vi.fn(async () => redirect("https://evil.example/ocds"));
    await expect(fetchSlice(slice, fetchSpy)).rejects.toThrow(/redirected away/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("Find a Tender slices only accept redirects on the Find a Tender host", async () => {
    // www.ons.gov.uk is an approved collector host, but not the contracts API.
    const fetchSpy = vi.fn(async () => redirect("https://www.ons.gov.uk/ocds"));
    await expect(fetchSlice(slice, fetchSpy)).rejects.toThrow(/redirected away/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("the Pages seed is fetched without following redirects off its configured host", async () => {
    const fetchSpy = vi.fn(async () => redirect("https://evil.example/metrics-snapshot.json"));
    expect(await fetchPublicationSeedSnapshot({}, fetchSpy)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("a cleartext Pages seed URL is never requested", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}"));
    expect(
      await fetchPublicationSeedSnapshot(
        { STATIC_SNAPSHOT_SEED_URL: "http://public-data-org.pages.dev/data/metrics-snapshot.json" },
        fetchSpy,
      ),
    ).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("data Worker outbound fetch configuration", () => {
  it("restricts the data Worker's global fetch to the public internet", () => {
    const data = readFileSync("worker/wrangler.toml", "utf8");
    const flags = data.match(/^compatibility_flags\s*=\s*\[([^\]]*)\]/m);
    expect(flags, "worker/wrangler.toml must declare compatibility_flags").not.toBeNull();
    expect(flags?.[1]).toMatch(/"global_fetch_strictly_public"/);
  });
});
