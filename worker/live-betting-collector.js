import {
  MARKET_DEFINITIONS,
  normalizeBettingMarketPayload,
} from "./betting-markets.js";
import {
  decodeHtml,
  fetchResponse,
  parseAttributes,
  readResponseText,
} from "./live-feed-common.js";

const ODDSCHECKER_HOST = "www.oddschecker.com";
const LIMITED_VIEW_PATTERNS = Object.freeze([
  /limited view/i,
  /log in to view/i,
  /sign in to view/i,
  /prices are currently unavailable/i,
  /market is currently unavailable/i,
  /access denied/i,
]);

function canonicalMarketUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== ODDSCHECKER_HOST) {
    throw new Error("Oddschecker market must remain on the approved HTTPS publisher host");
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString();
}

function assertCanonicalResponse(response, definition) {
  const resolved = canonicalMarketUrl(response.url || definition.sourceUrl);
  if (resolved !== canonicalMarketUrl(definition.sourceUrl)) {
    throw new Error(`Oddschecker redirected '${definition.id}' away from its approved market`);
  }
}

function normalizedIdentity(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en-GB")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pageIdentityCandidates(html) {
  const candidates = [];
  for (const match of String(html).matchAll(/<(title|h1)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = decodeHtml(match[2].replace(/<[^>]+>/g, " "));
    const identity = normalizedIdentity(text);
    if (identity) candidates.push(identity);
  }
  return candidates;
}

function assertMarketPage(html, definition) {
  const text = decodeHtml(html);
  if (LIMITED_VIEW_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error(`${definition.title} returned a limited or unavailable market view`);
  }
  const canonicalTitle = normalizedIdentity(definition.title);
  const identities = pageIdentityCandidates(html);
  if (!identities.some((identity) => identity.includes(canonicalTitle))) {
    throw new Error(`${definition.title} page identity could not be verified`);
  }
}

function decimalOdds(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

function fractionalOdds(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!match || Number(match[2]) <= 0) return null;
  const decimal = 1 + Number(match[1]) / Number(match[2]);
  return Number.isFinite(decimal) && decimal > 1 ? decimal : null;
}

function parseOddscheckerRows(html) {
  const bestByName = new Map();
  for (const match of String(html).matchAll(
    /<tr\b([^>]*\bdata-bname=(?:"[^"]*"|'[^']*')[^>]*)>/gi
  )) {
    const attributes = parseAttributes(match[1]);
    const name = attributes["data-bname"]?.trim();
    const best = Math.max(
      decimalOdds(attributes["data-best-dig"]) ?? 0,
      decimalOdds(attributes["data-best-dig-wo"]) ?? 0
    );
    if (!name || best <= 1) continue;
    const identity = name.toLocaleLowerCase("en-GB");
    const existing = bestByName.get(identity);
    if (!existing || best > existing.decimalOdds) {
      bestByName.set(identity, { name, decimalOdds: best });
    }
  }

  if (bestByName.size === 0) {
    for (const match of decodeHtml(html).matchAll(
      /([A-Za-z][A-Za-z0-9 .&'’()/-]{1,80}?)\s+(\d+(?:\.\d+)?\/\d+(?:\.\d+)?)(?=\s|$)/g
    )) {
      const name = match[1]
        .trim()
        .replace(/^(Best Odds|Odds Shortening|Odds Drifting)\s+/i, "");
      const odds = fractionalOdds(match[2]);
      if (!name || !odds) continue;
      const identity = name.toLocaleLowerCase("en-GB");
      const existing = bestByName.get(identity);
      if (!existing || odds > existing.decimalOdds) {
        bestByName.set(identity, { name, decimalOdds: odds });
      }
    }
  }

  const rows = [...bestByName.values()]
    .filter((row) => row.name.length <= 100)
    .sort(
      (left, right) =>
        left.decimalOdds - right.decimalOdds ||
        left.name.localeCompare(right.name, "en-GB")
    )
    .slice(0, 30);
  if (rows.length < 2) {
    throw new Error("Oddschecker market did not expose two valid runners");
  }
  return rows;
}

async function collectBettingOdds(fetchImpl = fetch, now = new Date()) {
  const observedAt = now.toISOString();
  const markets = [];

  for (const definition of Object.values(MARKET_DEFINITIONS)) {
    const response = await fetchResponse(definition.sourceUrl, fetchImpl);
    assertCanonicalResponse(response, definition);
    const html = await readResponseText(response, { label: "Oddschecker HTML" });
    assertMarketPage(html, definition);
    markets.push({
      id: definition.id,
      title: definition.title,
      sourceUrl: definition.sourceUrl,
      runners: parseOddscheckerRows(html),
    });
  }

  return normalizeBettingMarketPayload(
    {
      provider: "Oddschecker",
      observedAt,
      markets,
    },
    now
  );
}

export {
  LIMITED_VIEW_PATTERNS,
  assertCanonicalResponse,
  assertMarketPage,
  canonicalMarketUrl,
  collectBettingOdds,
  normalizedIdentity,
  pageIdentityCandidates,
  parseOddscheckerRows,
};
