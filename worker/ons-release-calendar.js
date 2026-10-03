import { sectionRecord, decodeHtml, fetchResponse, readResponseText } from "./live-feed-common.js";

const ONS_RELEASE_CALENDAR_URL = "https://www.ons.gov.uk/releasecalendar";
const MAX_CALENDAR_BYTES = 512 * 1024;
const RELEASE_FAMILIES = Object.freeze([
  { familyIds: ["gdpTracker"], pattern: /^GDP monthly estimate, UK:/i, exclude: /time series/i },
  { familyIds: ["inflation"], pattern: /^Consumer price inflation, UK:/i, exclude: /time series/i },
  { familyIds: ["employmentStats", "realWages"], pattern: /^UK Labour Market:/i },
  { familyIds: ["realWages"], pattern: /^Average weekly earnings in Great Britain:/i, exclude: /time series/i },
  { familyIds: ["nationalDebt", "taxRevenue"], pattern: /^Public sector finances, UK:/i, exclude: /time series/i },
  { familyIds: ["housePriceIndex"], pattern: /^Private rent and house prices, UK:/i, exclude: /time series/i },
  { familyIds: ["migrationStats"], pattern: /^Long-term international migration/i, exclude: /time series/i },
  { familyIds: ["crimeStatistics"], pattern: /^Crime in England and Wales:/i, exclude: /time series/i },
]);

function familiesForTitle(title) {
  return RELEASE_FAMILIES.find(({ pattern, exclude }) => pattern.test(title) && !exclude?.test(title))?.familyIds ?? [];
}

function isoDate(raw) {
  if (typeof raw !== "string" || !/^\d{8}$/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function safeReleaseUrl(raw) {
  try {
    const url = new URL(raw, ONS_RELEASE_CALENDAR_URL);
    if (url.protocol !== "https:" || url.hostname !== "www.ons.gov.uk" || !/^\/releases\/[A-Za-z0-9._-]+$/.test(url.pathname) || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function parseDateLabel(fragment) {
  const readable = decodeHtml(fragment);
  return readable.match(/Release date:\s*([^|]+?)(?:\s*\||$)/i)?.[1]?.trim() ?? "Date not stated";
}

function statusForLabel(value, releaseType) {
  if (releaseType === "cancelled") return "cancelled";
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "confirmed") return "confirmed";
  if (status === "provisional") return "provisional";
  if (status === "postponed") return "postponed";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  return "unknown";
}

function parseOnsReleaseCalendarPage(html, releaseType, checkedAt) {
  if (typeof html !== "string" || !["upcoming", "cancelled"].includes(releaseType) || !Number.isFinite(Date.parse(checkedAt))) return [];
  const events = [];
  for (const match of html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)) {
    const block = match[0];
    const anchor = block.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    const attributes = Object.fromEntries([...anchor[1].matchAll(/([a-zA-Z0-9:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((item) => [item[1].toLowerCase(), decodeHtml(item[2] ?? item[3])]));
    const title = (attributes["data-gtm-release-title"] ?? decodeHtml(anchor[2])).trim();
    const familyIds = familiesForTitle(title);
    if (!familyIds.length) continue;
    const publisherUrl = safeReleaseUrl(attributes["data-gtm-release-url"] ?? attributes.href);
    if (!publisherUrl) continue;
    const dateRaw = attributes["data-gtm-release-date"] ?? "";
    const date = dateRaw ? isoDate(dateRaw) : null;
    if (dateRaw && !date) continue;
    const readableBlock = decodeHtml(block);
    const label = parseDateLabel(readableBlock);
    const statusLabel = readableBlock.match(/\|\s*(Confirmed|Provisional|Postponed|Cancelled)\b/i)?.[1] ?? (releaseType === "cancelled" ? "Cancelled" : "Unknown");
    events.push({
      id: publisherUrl.pathname.slice("/releases/".length),
      title,
      familyIds,
      date,
      dateLabel: label,
      status: statusForLabel(statusLabel, releaseType),
      publisherUrl: publisherUrl.toString(),
      sourceCalendarUrl: ONS_RELEASE_CALENDAR_URL,
      timezone: "Europe/London",
      checkedAt: new Date(checkedAt).toISOString(),
    });
  }
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

async function fetchCalendarPage(releaseType, fetchImpl) {
  const url = new URL(ONS_RELEASE_CALENDAR_URL);
  url.searchParams.set("limit", "100");
  url.searchParams.set("page", "1");
  url.searchParams.set("release-type", `type-${releaseType}`);
  url.searchParams.set("sort", "date-newest");
  const response = await fetchResponse(url.toString(), fetchImpl);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html/i.test(contentType)) throw new Error("ONS release calendar returned an unexpected content type");
  const html = await readResponseText(response, { limit: MAX_CALENDAR_BYTES, label: "ONS release calendar HTML" });
  if (!/<title\b[^>]*>[\s\S]{0,300}?Release calendar[\s\S]{0,200}?Office for National Statistics[\s\S]*?<\/title>/i.test(html)) {
    throw new Error("ONS release calendar page identity could not be verified");
  }
  return html;
}

async function collectOnsReleaseCalendar(fetchImpl = fetch, now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("ONS release-calendar check time is invalid");
  const [upcomingHtml, cancelledHtml] = await Promise.all([
    fetchCalendarPage("upcoming", fetchImpl),
    fetchCalendarPage("cancelled", fetchImpl),
  ]);
  const checkedAt = now.toISOString();
  const byId = new Map([
    ...parseOnsReleaseCalendarPage(upcomingHtml, "upcoming", checkedAt),
    ...parseOnsReleaseCalendarPage(cancelledHtml, "cancelled", checkedAt),
  ].map((event) => [event.id, event]));
  const data = {
    events: [...byId.values()].sort((left, right) => (left.date ?? "9999-12-31").localeCompare(right.date ?? "9999-12-31") || left.id.localeCompare(right.id)),
    calendarUrl: ONS_RELEASE_CALENDAR_URL,
    checkedAt,
    __observation: { status: "current", observedAt: checkedAt, maxAgeHours: 36 },
  };
  return sectionRecord("releaseCalendar", data, now, "ONS release calendar, upcoming and cancelled notices", "cloudflare-official-release-calendar");
}

export { ONS_RELEASE_CALENDAR_URL, RELEASE_FAMILIES, collectOnsReleaseCalendar, parseOnsReleaseCalendarPage };
