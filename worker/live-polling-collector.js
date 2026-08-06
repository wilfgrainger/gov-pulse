import { normalizePrimaryPollPayload } from "./election-polls.js";
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

function parsePublishedDate(text) {
  const match = String(text).match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i
  );
  if (!match) throw new Error("YouGov article did not expose a publication date");
  return isoDate(
    Number(match[3]),
    MONTH_NUMBER[match[2].toLowerCase()],
    Number(match[1])
  );
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
    const match = String(text).match(
      new RegExp(`(?:^|\\s)${label}:\\s*(\\d{1,2}(?:\\.\\d+)?)%`, "i")
    );
    if (match) result[key] = Number(match[1]);
  }
  return result;
}

function latestYouGovArticleUrl(html) {
  const urls = [...String(html).matchAll(
    /href=(?:"|')([^"']*\/en-gb\/articles\/(\d+)-voting-intention-[^"']+)(?:"|')/gi
  )]
    .map((match) => ({
      url: absoluteUrl(YOU_GOV_ARTICLES_URL, match[1]),
      id: Number(match[2]),
    }))
    .filter((entry) => Number.isSafeInteger(entry.id));
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
    .map((match) => absoluteUrl(base, match[1]))
    .filter((url) => /VotingIntention/i.test(url));
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

async function inflate(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
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
    try {
      const decoded = /\/FlateDecode/.test(match[1]) ? await inflate(chunk) : chunk;
      const text = latin1(decoded);
      parts.push(pdfStrings(text));
    } catch {
      // Required metadata below still fails closed.
    }
    streamPattern.lastIndex = end + 9;
  }
  return parts.join(" ").replace(/\s+/g, " ");
}

function sampleSizeFromPdfText(text) {
  const direct = String(text).match(/Sample\s*Size\s*:?\s*(\d{3,5})\s*GB\s*Adults/i);
  if (direct) return Number(direct[1]);
  const marker = String(text).search(/Sample\s*Size/i);
  const nearby = marker >= 0
    ? String(text).slice(marker, marker + 300).match(/\b(\d{3,5})\b/)
    : null;
  if (nearby) return Number(nearby[1]);
  throw new Error("YouGov primary tables did not expose a sample size");
}

async function collectElectionPolling(fetchImpl = fetch, now = new Date()) {
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
  const publicationDate = parsePublishedDate(articleText);
  const pdfUrl = findPdfUrl(articleHtml, articleUrl);
  const pdfResponse = await fetchResponse(pdfUrl, fetchImpl, "application/pdf");
  const sampleSize = sampleSizeFromPdfText(
    await extractPdfText(
      await readResponseArrayBuffer(pdfResponse, {
        limit: MAX_RESPONSE_BYTES.pdf,
        label: "YouGov PDF",
      }),
    )
  );
  const parties = parsePartyShares(articleText);
  const commissioner =
    articleText.match(/poll for ([^.]+?),\s*shows/i)?.[1]?.trim() ||
    "The Times and Sky News";

  return normalizePrimaryPollPayload(
    {
      polls: [
        {
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
          headlineMethod:
            "Headline voting intention from constituency vote projected by YouGov's MRP model",
          parties,
          sourceUrl: pdfUrl,
          methodologyUrl: YOU_GOV_METHOD_URL,
          bpcMember: true,
          uncertainty:
            "YouGov states a 9 in 10 chance that true party support lies within four points of the estimate and a 2 in 3 chance that it lies within two points.",
        },
      ],
    },
    now
  );
}

export {
  YOU_GOV_ARTICLES_URL,
  collectElectionPolling,
  pdfStrings,
  extractPdfText,
  latestYouGovArticleUrl,
  sampleSizeFromPdfText,
};
