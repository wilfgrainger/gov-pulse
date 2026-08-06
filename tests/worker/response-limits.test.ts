// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  MAX_RESPONSE_BYTES,
  assertSameHttpsHost,
  readResponseArrayBuffer,
  readResponseJson,
  readResponseText,
} from "@/worker/response-limits";
import { fetchOfficialResponse } from "@/worker/official-source-fetch";
import { fetchResponse } from "@/worker/live-feed-common";

describe("bounded upstream response readers", () => {
  it("reads text and JSON within their declared limits", async () => {
    const text = await readResponseText(new Response("evidence"), {
      limit: 32,
      label: "test text",
    });
    const payload = await readResponseJson(new Response('{"ok":true}'), {
      limit: 32,
      label: "test JSON",
    });

    expect(text).toBe("evidence");
    expect(payload).toEqual({ ok: true });
  });

  it("rejects oversized declared and streamed bodies", async () => {
    await expect(
      readResponseText(new Response("small", { headers: { "content-length": "99" } }), {
        limit: 10,
        label: "declared source",
      }),
    ).rejects.toThrow(/declared source response exceeded/i);

    await expect(
      readResponseText(new Response("0123456789"), {
        limit: 5,
        label: "streamed source",
      }),
    ).rejects.toThrow(/streamed source response exceeded/i);
  });

  it("uses conservative binary defaults for publisher workbooks and PDFs", async () => {
    const buffer = await readResponseArrayBuffer(new Response(new Uint8Array([1, 2, 3])));
    expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(MAX_RESPONSE_BYTES.workbook).toBeGreaterThan(MAX_RESPONSE_BYTES.pdf);
    expect(MAX_RESPONSE_BYTES.pdf).toBeGreaterThan(MAX_RESPONSE_BYTES.text);
  });

  it("rejects off-host and non-HTTPS redirects", () => {
    expect(() =>
      assertSameHttpsHost(
        { url: "https://www.ons.gov.uk/other" },
        "https://www.ons.gov.uk/source",
        "ONS",
      ),
    ).not.toThrow();

    expect(() =>
      assertSameHttpsHost(
        { url: "https://evil.example/source" },
        "https://www.ons.gov.uk/source",
        "ONS",
      ),
    ).toThrow(/redirected away/i);

    expect(() =>
      assertSameHttpsHost(
        { url: "http://www.ons.gov.uk/source" },
        "https://www.ons.gov.uk/source",
        "ONS",
      ),
    ).toThrow(/redirected away/i);
  });

  it("applies host validation at both upstream fetch boundaries", async () => {
    const offHost = async () => ({
      ok: true,
      url: "https://evil.example/source",
      headers: new Headers(),
    });

    await expect(
      fetchOfficialResponse("https://www.ons.gov.uk/source", { fetchImpl: offHost }),
    ).rejects.toThrow(/redirected away/i);
    await expect(
      fetchResponse("https://yougov.com/source", offHost),
    ).rejects.toThrow(/redirected away/i);
  });
});
