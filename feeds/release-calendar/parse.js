import { sectionRecord, decodeHtml, fetchResponse, readResponseText } from "../../worker/live-feed-common.js";
import { releaseFamilyGroups } from "../registry.js";

const ONS_RELEASE_CALENDAR_URL = "https://www.ons.gov.uk/releasecalendar";
const MAX_CALENDAR_BYTES = 512 * 1024;
// The title families come from the feeds' own releaseTitles (feeds/*/feed.js).
const RELEASE_FAMILIES = Object.freeze(releaseFamilyGroups().map((family) => Object.freeze(family)));

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

// ONS lists 100 notices a page; in November 2026 the upcoming list was 5 pages.
const MAX_UPCOMING_PAGES = 10;

function listedPageCount(html) {
  const match = html.match(/\bPage\s+\d{1,3}\s+of\s+(\d{1,3})\b/i);
  return match ? Number(match[1]) : 1;
}

async function fetchCalendarPage(releaseType, fetchImpl, page = 1) {
  const url = new URL(ONS_RELEASE_CALENDAR_URL);
  url.searchParams.set("limit", "100");
  url.searchParams.set("page", String(page));
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
  // Cancelled notices sort newest release date first, so page 1 holds every
  // cancellation that can still affect an upcoming release.
  const [firstUpcomingHtml, cancelledHtml] = await Promise.all([
    fetchCalendarPage("upcoming", fetchImpl),
    fetchCalendarPage("cancelled", fetchImpl),
  ]);
  // Upcoming notices run nearest first, so stopping at page 1 would silently end
  // the calendar about five weeks out. Read every page, or fail closed.
  const upcomingPages = listedPageCount(firstUpcomingHtml);
  if (upcomingPages > MAX_UPCOMING_PAGES) {
    throw new Error(`ONS release calendar listed ${upcomingPages} upcoming pages, more than the ${MAX_UPCOMING_PAGES} this check reads`);
  }
  const laterUpcomingHtml = await Promise.all(
    Array.from({ length: upcomingPages - 1 }, (_, index) => fetchCalendarPage("upcoming", fetchImpl, index + 2)),
  );
  const checkedAt = now.toISOString();
  const byId = new Map([
    ...[firstUpcomingHtml, ...laterUpcomingHtml].flatMap((html) => parseOnsReleaseCalendarPage(html, "upcoming", checkedAt)),
    ...parseOnsReleaseCalendarPage(cancelledHtml, "cancelled", checkedAt),
  ].map((event) => [event.id, event]));
  if (byId.size === 0) throw new Error("ONS release calendar exposed no releases");
  const data = {
    events: [...byId.values()].sort((left, right) => (left.date ?? "9999-12-31").localeCompare(right.date ?? "9999-12-31") || left.id.localeCompare(right.id)),
    calendarUrl: ONS_RELEASE_CALENDAR_URL,
    checkedAt,
    __observation: { status: "current", observedAt: checkedAt, maxAgeHours: 36 },
  };
  return sectionRecord("releaseCalendar", data, now, "ONS release calendar, upcoming and cancelled notices", "cloudflare-official-release-calendar");
}

/**
 * Feed interface (target design 2.3). Wraps the existing collector without
 * changing what it fetches or returns: `data` is exactly the payload of the
 * section record collectOnsReleaseCalendar has always produced.
 *
 * @param {{fetch: typeof fetch, now: Date}} ctx
 */
async function collect(ctx) {
  const record = await collectOnsReleaseCalendar(ctx.fetch, ctx.now);
  return { data: record.data };
}

export { ONS_RELEASE_CALENDAR_URL, collect, collectOnsReleaseCalendar, parseOnsReleaseCalendarPage };
