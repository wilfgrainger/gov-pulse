import {
  absoluteUrl,
  decodeHtml,
  parseAttributes,
} from "./live-feed-common.js";

const NHS_RTT_LANDING_PAGE =
  "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/";
const NHS_HOSTS = new Set(["england.nhs.uk", "www.england.nhs.uk"]);
const ANNUAL_PAGE_PATH =
  /^\/statistics\/statistical-work-areas\/rtt-waiting-times\/rtt-data-(\d{4})-(\d{2})\/?$/i;
const PUBLICATION_ASSET_PATH = /^\/statistics\/wp-content\/uploads\/sites\/2\//i;
const MONTHS = Object.freeze({
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
});

function anchors(html) {
  return [...String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(
    (match) => ({
      attributes: parseAttributes(match[1]),
      label: decodeHtml(match[2]),
    })
  );
}

function approvedNhsUrl(value, baseUrl, expectedPath, label) {
  let url;
  try {
    url = new URL(absoluteUrl(baseUrl, value));
  } catch {
    throw new Error(`${label} was not a valid URL`);
  }
  if (url.protocol !== "https:" || !NHS_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`${label} was not hosted by NHS England over HTTPS`);
  }
  if (!expectedPath.test(url.pathname)) {
    throw new Error(`${label} did not match the expected NHS RTT path`);
  }
  url.hash = "";
  return url.toString();
}

function annualRank(url) {
  const match = new URL(url).pathname.match(ANNUAL_PAGE_PATH);
  return match ? Number(match[1]) * 100 + Number(match[2]) : Number.NEGATIVE_INFINITY;
}

function releaseRank(link) {
  const textMatch = link.label.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(20\d{2}|\d{2})\b/i
  );
  if (textMatch) {
    const month = MONTHS[textMatch[1].toLowerCase()];
    const rawYear = Number(textMatch[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return month === undefined ? Number.NEGATIVE_INFINITY : Date.UTC(year, month, 1);
  }
  const hrefMatch = decodeURIComponent(link.attributes.href ?? "").match(
    /(?:^|[/_-])(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2})(?=[-_.])/i
  );
  if (!hrefMatch) return Number.NEGATIVE_INFINITY;
  const month = MONTHS[hrefMatch[1].toLowerCase()];
  return month === undefined
    ? Number.NEGATIVE_INFINITY
    : Date.UTC(2000 + Number(hrefMatch[2]), month, 1);
}

function discoverNhsRttDataPage(html, landingUrl = NHS_RTT_LANDING_PAGE) {
  const links = anchors(html).filter(
    (link) =>
      link.attributes.href &&
      (/RTT waiting times data/i.test(link.label) ||
        /rtt-data-\d{4}-\d{2}/i.test(link.attributes.href))
  );
  const candidates = [];
  const rejected = [];
  for (const link of links) {
    try {
      candidates.push(
        approvedNhsUrl(
          link.attributes.href,
          landingUrl,
          ANNUAL_PAGE_PATH,
          "NHS RTT annual data page"
        )
      );
    } catch (error) {
      // Historical landing pages include legacy and external links. They are
      // ignored when a current approved publication path is also present.
      rejected.push(error);
    }
  }
  if (candidates.length === 0) {
    if (rejected.length > 0) throw rejected[0];
    throw new Error("NHS RTT landing page did not expose a current annual data page");
  }
  candidates.sort((left, right) => annualRank(right) - annualRank(left));
  if (!Number.isFinite(annualRank(candidates[0]))) {
    throw new Error("NHS RTT annual data pages did not expose a sortable financial year");
  }
  return candidates[0];
}

function discoverLatestPublicationLink(html, dataPageUrl, options) {
  const candidates = anchors(html)
    .filter(
      (link) =>
        link.attributes.href &&
        options.label.test(link.label) &&
        options.extension.test(link.attributes.href)
    )
    .map((link) => ({
      ...link,
      url: approvedNhsUrl(
        link.attributes.href,
        dataPageUrl,
        PUBLICATION_ASSET_PATH,
        options.name
      ),
    }));
  if (candidates.length === 0) {
    throw new Error(`NHS RTT data page did not expose ${options.missing}`);
  }
  candidates.sort((left, right) => releaseRank(right) - releaseRank(left));
  if (!Number.isFinite(releaseRank(candidates[0]))) {
    throw new Error(`${options.name} did not expose a sortable month and year`);
  }
  return candidates[0].url;
}

function discoverNhsRttPublicationLinks(html, dataPageUrl) {
  return {
    timeseriesUrl: discoverLatestPublicationLink(html, dataPageUrl, {
      label: /RTT Overview Timeseries Including Estimates for Missing Trusts/i,
      extension: /\.xlsx(?:[?#].*)?$/i,
      name: "NHS RTT time-series workbook",
      missing: "the official overview time-series workbook",
    }),
    pressNoticeUrl: discoverLatestPublicationLink(html, dataPageUrl, {
      label: /RTT statistical press notice/i,
      extension: /\.pdf(?:[?#].*)?$/i,
      name: "NHS RTT statistical press notice",
      missing: "the latest statistical press notice PDF",
    }),
  };
}

export {
  ANNUAL_PAGE_PATH,
  NHS_RTT_LANDING_PAGE,
  PUBLICATION_ASSET_PATH,
  approvedNhsUrl,
  discoverNhsRttDataPage,
  discoverNhsRttPublicationLinks,
  releaseRank,
};
