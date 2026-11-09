import { YOU_GOV_ARTICLE_HOSTS, YOU_GOV_RESULTS_HOSTS } from "../../worker/approved-source-hosts.js";
import { PARTY_LABELS, normalizePrimaryPollPayload } from "./normalize.js";
import { collectMoreInCommonPolls } from "./more-in-common.js";
import { extractPdfText, pdfStrings } from "../_kit/pdf.js";
import {
  absoluteUrl,
  MAX_RESPONSE_BYTES,
  decodeHtml,
  fetchResponse,
  readResponseArrayBuffer,
  readResponseText,
} from "../../worker/live-feed-common.js";

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
  // Start day, optional start month and year, optional end day, end month, end year.
  // The end month must follow whitespace, so a single-day title cannot split a month name.
  const match = String(title).match(
    /Voting intention,\s*(\d{1,2})(?:\s+([A-Za-z]+)(?:\s+(\d{4}))?)?(?:\s*[-–]\s*(\d{1,2}))?\s+([A-Za-z]+)\s+(\d{4})/i
  );
  if (!match) {
    throw new Error("YouGov article title did not expose fieldwork dates");
  }
  const endMonth = MONTH_NUMBER[match[5].toLowerCase()];
  const startMonth = match[2] ? MONTH_NUMBER[match[2].toLowerCase()] : endMonth;
  if (!endMonth || !startMonth) throw new Error("YouGov article used an unknown fieldwork month");
  const endYear = Number(match[6]);
  const startYear = match[3] ? Number(match[3]) : startMonth > endMonth ? endYear - 1 : endYear;
  const start = isoDate(startYear, startMonth, Number(match[1]));
  const end = isoDate(endYear, endMonth, Number(match[4] ?? match[1]));
  if (start > end) throw new Error("YouGov article fieldwork ended before it started");
  return { start, end };
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
    console.error("Election poll source unavailable", { pollster: "YouGov", error: String(youGovResult.reason?.message ?? youGovResult.reason) });
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
    console.error("Election poll source unavailable", { pollster: "More in Common", error: String(moreInCommonResult.reason?.message ?? moreInCommonResult.reason) });
    sources.push({ pollster: "More in Common", status: "unavailable", recordCount: 0 });
  }

  if (!polls.length) throw new Error("No verified primary pollster publications were available");
  return normalizePrimaryPollPayload({ polls, sources }, now);
}

/**
 * Feed interface (target design 2.3). Wraps the existing collector without
 * changing what it fetches or returns: `data` is exactly the payload
 * collectElectionPolling has always produced.
 *
 * @param {{fetch: typeof fetch, now: Date}} ctx
 */
async function collect(ctx) {
  return { data: await collectElectionPolling(ctx.fetch, ctx.now) };
}

export {
  YOU_GOV_ARTICLES_URL,
  collect,
  collectYouGovPoll,
  findPdfUrl,
  collectElectionPolling,
  parseArticleDateRange,
  pdfStrings,
  extractPdfText,
  latestYouGovArticleUrl,
  parsePublishedDate,
  commissionerFromArticle,
  headlineMethodFromPrimarySource,
  sampleSizeFromPdfText,
  parsePartyShares,
};
