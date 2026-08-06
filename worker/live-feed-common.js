import { provenanceFor } from "./feed-registry.js";
import {
  MAX_RESPONSE_BYTES,
  assertSameHttpsHost,
  readResponseArrayBuffer,
  readResponseText,
} from "./response-limits.js";

const REQUEST_TIMEOUT_MS = 25_000;
const USER_AGENT = "public-data.org-source-collector/2.0";

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&#(\d+);/g, (_, raw) => String.fromCodePoint(Number(raw)))
    .replace(/&#x([0-9a-f]+);/gi, (_, raw) =>
      String.fromCodePoint(Number.parseInt(raw, 16))
    )
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(base, href) {
  return new URL(decodeHtml(href), base).toString();
}

async function fetchResponse(url, fetchImpl = fetch, accept = "text/html") {
  const response = await fetchImpl(url, {
    headers: {
      Accept: accept,
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  }
  assertSameHttpsHost(response, url, "Live source");
  return response;
}

function parseAttributes(fragment) {
  return Object.fromEntries(
    [...String(fragment).matchAll(/([a-zA-Z0-9:-]+)=(?:"([^"]*)"|'([^']*)')/g)].map(
      (match) => [match[1].toLowerCase(), decodeHtml(match[2] ?? match[3])]
    )
  );
}

function sectionRecord(section, data, now, sourceLabel, backend) {
  const fetchedAt = now.toISOString();
  return {
    section,
    data,
    fetchedAt,
    source: {
      status: "ok",
      cacheState: "fresh",
      fetchedAt,
      backend,
      source: sourceLabel,
      provenance: provenanceFor(section),
    },
    sourceLabel,
    backend,
  };
}

export {
  absoluteUrl,
  MAX_RESPONSE_BYTES,
  decodeHtml,
  fetchResponse,
  parseAttributes,
  readResponseArrayBuffer,
  readResponseText,
  sectionRecord,
};
