import { PARTY_LABELS, normalizePrimaryPollPayload } from "./election-polls.js";
import { collectMoreInCommonPolls } from "./more-in-common-polling.js";
import {
  absoluteUrl,
  MAX_RESPONSE_BYTES,
  decodeHtml,
  fetchResponse,
  readResponseArrayBuffer,
  readResponseText,
} from "./live-feed-common.js";

const YOU_GOV_ARTICLES_URL = "https://yougov.com/en-gb/articles";
const YOU_GOV_METHOD_URL =
  "https://yougov.com/en-gb/articles/54278-how-yougov-conducts-voting-intention-polling";
const YOU_GOV_ARTICLE_HOSTS = new Set(["yougov.com", "www.yougov.com"]);
const YOU_GOV_RESULTS_HOSTS = new Set([
  "ygo-assets-websites-editorial-emea.yougov.net",
]);
const MAX_PDF_STREAM_EXPANSION_BYTES = 2 * 1024 * 1024;
const MAX_PDF_TOTAL_EXPANSION_BYTES = 8 * 1024 * 1024;

const MONTH_NUMBER = Object.freeze({
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
});

function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid publication date");
  }
  return date.toISOString().slice(0, 10);
}

function parseArticleDateRange(title) {
  const match = String(title).match(
    /Voting intention,\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+([A-Za-z]+)\s+(\d{4})/i
  );
  if (!match) {
    throw new Error("YouGov article title did not expose fieldwork dates");
  }
  const month = MONTH_NUMBER[match[3].toLowerCase()];
  if (!month) throw new Error("YouGov article used an unknown fieldwork month");
  return {
    start: isoDate(Number(match[4]), month, Number(match[1])),
    end: isoDate(Number(match[4]), month, Number(match[2] ?? match[1])),
  };
}

function parsePublishedDate(source) {
  const value = String(source);
  const byline = value.match(
    /<[^>]*\bdata-test\s*=\s*(["'])published-at\1[^>]*>([\s\S]*?)<\/[^>]+>/i
  );
  const dateLabel = byline
    ? decodeHtml(byline[2].replace(/<[^>]*>/g, " "))
    : value;
  const match = byline
    ? dateLabel.match(
        /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i
      )
    : dateLabel.match(
        /\bPublished\s*:?\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i
      );
  if (!match) throw new Error("YouGov article did not expose a publication date");
  return isoDate(
    Number(match[3]),
    MONTH_NUMBER[match[2].toLowerCase()],
    Number(match[1])
  );
}

function commissionerFromArticle(text) {
  const matches = [...String(text).matchAll(
    /poll for ([^.]+?)\s*,?\s*(?:continues\s+to\s+)?shows?\b/gi
  )]
    .map((match) => match[1].trim())
    .filter(Boolean);
  const unique = [...new Set(matches)];
  if (unique.length === 0) {
    throw new Error("YouGov primary article did not disclose the commissioner");
  }
  if (unique.length > 1) {
    throw new Error("YouGov primary article contains contradictory commissioners");
  }
  return unique[0];
}

function headlineMethodFromPrimarySource(articleText, pdfUrl, pdfText) {
  const sourceIdentity = `${articleText} ${pdfUrl} ${pdfText}`;
  if (/\bMRP\b/i.test(sourceIdentity) && /constituency/i.test(sourceIdentity)) {
    return "Headline voting intention from constituency vote projected by YouGov's MRP model";
  }
  throw new Error("YouGov primary publication did not identify a supported headline method");
}

function parsePartyShares(text) {
  const labels = [
    ["conservative", "Conservatives?"],
    ["labour", "Labour"],
    ["liberalDemocrats", "Lib(?:eral)? Dems?"],
    ["reformUK", "Reform UK"],
    ["green", "Greens?"],
    ["snp", "SNP"],
    ["plaidCymru", "Plaid Cymru"],
    ["yourParty", "Your Party"],
    ["restoreBritain", "Restore Britain"],
    ["other", "Others?"],
  ];
  const result = {};
  for (const [key, label] of labels) {
    const matches = [...String(text).matchAll(
      new RegExp(`(?:^|\\s)${label}:\\s*(\\d{1,2}(?:\\.\\d+)?)%`, "gi")
    )].map((match) => Number(match[1]));
    const unique = [...new Set(matches)];
    if (unique.length > 1) {
      throw new Error(`YouGov primary publication contains contradictory ${PARTY_LABELS[key]} shares`);
    }
    if (unique.length === 1) result[key] = unique[0];
  }
  return result;
}

function approvedYouGovUrl(value, base, hosts, pathnamePattern) {
  let url;
  try {
    url = new URL(absoluteUrl(base, value));
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !hosts.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.port ||
    !pathnamePattern.test(url.pathname)
  ) {
    return null;
  }
  return url.toString();
}

function latestYouGovArticleUrl(html) {
  const urls = [...String(html).matchAll(
    /href=(?:"|')([^"']*\/en-gb\/articles\/(\d+)-voting-intention-[^"']+)(?:"|')/gi
  )]
    .map((match) => ({
      url: approvedYouGovUrl(
        match[1],
        YOU_GOV_ARTICLES_URL,
        YOU_GOV_ARTICLE_HOSTS,
        /^\/en-gb\/articles\/\d+-voting-intention-[^/]+$/i,
      ),
      id: Number(match[2]),
    }))
    .filter((entry) => entry.url && Number.isSafeInteger(entry.id));
  if (urls.length === 0) {
    throw new Error("YouGov article index did not expose a voting-intention publication");
  }
  urls.sort((left, right) => right.id - left.id);
  return urls[0].url;
}

function findPdfUrl(html, base) {
  const urls = [...String(html).matchAll(
    /href=(?:"|')([^"']+\.pdf(?:\?[^"']*)?)(?:"|')/gi
  )]
    .map((match) => approvedYouGovUrl(
      match[1],
      base,
      YOU_GOV_RESULTS_HOSTS,
      /^\/documents\/[^/]*VotingIntention[^/]*\.pdf$/i,
    ))
    .filter(Boolean);
  if (urls.length === 0) {
    throw new Error("YouGov article did not link primary result tables");
  }
  return urls[0];
}

function latin1(bytes) {
  let result = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return result;
}

class PdfExpansionLimitError extends Error {}

async function inflate(bytes, limit = MAX_PDF_STREAM_EXPANSION_BYTES) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        try { await reader.cancel(); } catch {}
        throw new PdfExpansionLimitError(
          `YouGov/NHS expanded PDF stream exceeded its ${limit}-byte limit`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const expanded = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    expanded.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return expanded;
}

function decodePdfLiteral(value) {
  return String(value)
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, octal) =>
      String.fromCharCode(Number.parseInt(octal, 8))
    );
}

function pdfStrings(content) {
  const source = String(content);
  const output = [];

  const readLiteral = (start) => {
    let index = start + 1;
    let escaped = false;
    while (index < source.length) {
      const character = source[index];
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === ")") {
        return { end: index + 1, value: source.slice(start + 1, index) };
      }
      index += 1;
    }
    return null;
  };

  const skipWhitespace = (start) => {
    let index = start;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    return index;
  };

  let index = 0;
  while (index < source.length) {
    if (source[index] === "[") {
      const literals = [];
      let cursor = index + 1;
      while (cursor < source.length && source[cursor] !== "]") {
        if (source[cursor] === "(") {
          const literal = readLiteral(cursor);
          if (!literal) break;
          literals.push(literal.value);
          cursor = literal.end;
        } else {
          cursor += 1;
        }
      }
      if (source[cursor] === "]" && /^\s*TJ\b/.test(source.slice(cursor + 1))) {
        const text = literals.map(decodePdfLiteral).join("");
        if (text) output.push(text);
        index = cursor + 3;
        continue;
      }
    }

    if (source[index] === "(") {
      const literal = readLiteral(index);
      if (literal) {
        const operatorStart = skipWhitespace(literal.end);
        if (/^(?:Tj|['"])/.test(source.slice(operatorStart))) {
          output.push(decodePdfLiteral(literal.value));
          index = literal.end;
          continue;
        }
      }
    }
    index += 1;
  }

  return output.join(" ").replace(/\s+/g, " ");
}

async function extractPdfText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const raw = latin1(bytes);
  const parts = [];
  let expandedBytes = 0;
  const streamPattern = /<<(.*?)>>\s*stream\r?\n/gs;
  let match;
  while ((match = streamPattern.exec(raw))) {
    if (/\/Subtype\s*\/Image\b/i.test(match[1])) {
      const imageEnd = raw.indexOf("endstream", match.index + match[0].length);
      if (imageEnd < 0) break;
      streamPattern.lastIndex = imageEnd + 9;
      continue;
    }
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    let chunkEnd = end;
    while (
      chunkEnd > start &&
      (bytes[chunkEnd - 1] === 10 || bytes[chunkEnd - 1] === 13)
    ) {
      chunkEnd -= 1;
    }
    const chunk = bytes.subarray(start, chunkEnd);
    let decoded;
    try {
      decoded = /\/FlateDecode/.test(match[1]) ? await inflate(chunk) : chunk;
    } catch (error) {
      if (error instanceof PdfExpansionLimitError) throw error;
      // Required metadata below still fails closed.
      streamPattern.lastIndex = end + 9;
      continue;
    }
    if (decoded.byteLength > MAX_PDF_STREAM_EXPANSION_BYTES) {
      throw new PdfExpansionLimitError(
        `YouGov/NHS expanded PDF stream exceeded its ${MAX_PDF_STREAM_EXPANSION_BYTES}-byte limit`,
      );
    }
    expandedBytes += decoded.byteLength;
    if (expandedBytes > MAX_PDF_TOTAL_EXPANSION_BYTES) {
      throw new PdfExpansionLimitError(
        `YouGov/NHS total PDF expansion exceeded its ${MAX_PDF_TOTAL_EXPANSION_BYTES}-byte limit`,
      );
    }
    const text = latin1(decoded);
    parts.push(pdfStrings(text));
    streamPattern.lastIndex = end + 9;
  }
  return parts.join(" ").replace(/\s+/g, " ");
}

function sampleSizeFromPdfText(text) {
  const source = String(text);
  const direct = source.match(
    /Sample\s*Size\s*:?\s*((?:\d{1,3}(?:,\d{3})+)|\d{3,5})\s*GB\s*Adults\b/i
  );
  const adultsInGb = source.match(
    /Sample\s*Size\s*:?\s*((?:\d{1,3}(?:,\d{3})+)|\d{3,5})\s+adults\s+in\s+GB\b/i
  );
  const match = direct ?? adultsInGb;
  if (match) return Number(match[1].replace(/,/g, ""));
  throw new Error("YouGov primary tables did not expose a sample size");
}

async function collectYouGovPoll(fetchImpl = fetch) {
  const indexHtml = await readResponseText(
    await fetchResponse(YOU_GOV_ARTICLES_URL, fetchImpl),
    { label: "YouGov article index" },
  );
  const articleUrl = latestYouGovArticleUrl(indexHtml);
  const articleResponse = await fetchResponse(articleUrl, fetchImpl);
  const articleHtml = await readResponseText(articleResponse, {
    label: "YouGov article",
  });
  const articleText = decodeHtml(articleHtml);
  const title = decodeHtml(
    articleHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
      articleHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
      ""
  );
  const fieldwork = parseArticleDateRange(title);
  const publicationDate = parsePublishedDate(articleHtml);
  const pdfUrl = findPdfUrl(articleHtml, articleUrl);
  const pdfResponse = await fetchResponse(pdfUrl, fetchImpl, "application/pdf");
  const pdfText = await extractPdfText(
      await readResponseArrayBuffer(pdfResponse, {
        limit: MAX_RESPONSE_BYTES.pdf,
        label: "YouGov PDF",
      }),
    );
  const sampleSize = sampleSizeFromPdfText(pdfText);
  const commissioner = commissionerFromArticle(articleText);
  const parties = parsePartyShares(articleText);
  const headlineMethod = headlineMethodFromPrimarySource(articleText, pdfUrl, pdfText);

  return {
    id: `yougov-${fieldwork.end}`,
    pollster: "YouGov",
    commissioner,
    title,
    questionText:
      "Now, thinking specifically about your own constituency, if there were a general election held tomorrow and these were the parties standing, which party would you vote for?",
    publicationDate,
    fieldworkStart: fieldwork.start,
    fieldworkEnd: fieldwork.end,
    sampleSize,
    geography: "Great Britain",
    population: "GB adults",
    mode: "Online panel",
    headlineMethod,
    parties,
    sourceUrl: pdfUrl,
    methodologyUrl: YOU_GOV_METHOD_URL,
    bpcMember: true,
    uncertainty: null,
  };
}

async function collectElectionPolling(fetchImpl = fetch, now = new Date()) {
  const [youGovResult, moreInCommonResult] = await Promise.allSettled([
    collectYouGovPoll(fetchImpl),
    collectMoreInCommonPolls(fetchImpl),
  ]);
  const polls = [];
  const sources = [];

  if (youGovResult.status === "fulfilled") {
    polls.push(youGovResult.value);
    sources.push({ pollster: "YouGov", status: "current", recordCount: 1 });
  } else {
    sources.push({ pollster: "YouGov", status: "unavailable", recordCount: 0 });
  }

  if (moreInCommonResult.status === "fulfilled") {
    const { polls: moreInCommonPolls, archive } = moreInCommonResult.value;
    polls.push(...moreInCommonPolls);
    sources.push({
      pollster: "More in Common",
      status: archive.status === "complete" ? "current" : "partial",
      recordCount: moreInCommonPolls.length,
      archiveFilesRequested: archive.requested,
      archiveFilesValidated: archive.validated,
      archiveFilesUnavailable: archive.unavailable,
    });
  } else {
    sources.push({ pollster: "More in Common", status: "unavailable", recordCount: 0 });
  }

  if (!polls.length) throw new Error("No verified primary pollster publications were available");
  return normalizePrimaryPollPayload({ polls, sources }, now);
}

export {
  YOU_GOV_ARTICLES_URL,
  MAX_PDF_STREAM_EXPANSION_BYTES,
  MAX_PDF_TOTAL_EXPANSION_BYTES,
  collectYouGovPoll,
  findPdfUrl,
  collectElectionPolling,
  pdfStrings,
  extractPdfText,
  latestYouGovArticleUrl,
  parsePublishedDate,
  commissionerFromArticle,
  headlineMethodFromPrimarySource,
  sampleSizeFromPdfText,
  parsePartyShares,
};
