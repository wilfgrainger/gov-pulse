import { extractPdfText } from "./live-polling-collector.js";
import {
  decodeHtml,
  fetchResponse,
  readResponseArrayBuffer,
  readResponseText,
  sectionRecord,
} from "./live-feed-common.js";

const NHS_CALENDAR_URL = "https://www.england.nhs.uk/statistics/12-months-statistics-calendar/";
const NHS_CALENDAR_API_URL = "https://www.england.nhs.uk/statistics/wp-json/wp/v2/pages?slug=12-months-statistics-calendar&_fields=content%2Clink%2Cmodified%2Ctitle";
const MAX_CALENDAR_JSON_BYTES = 256 * 1024;
const MAX_PLAN_PDF_BYTES = 2 * 1024 * 1024;
const MONTHS = Object.freeze({
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
});

function currentFinancialYear(now) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function safePlanUrl(raw, financialYear) {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.england.nhs.uk" ||
      !new RegExp(`^/statistics/wp-content/uploads/sites/2/20\\d{2}/(?:0[1-9]|1[0-2])/[^/?#]*plan[^/?#]*${financialYear}[^/?#]*\\.pdf$`, "i").test(url.pathname) ||
      url.search || url.hash
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function parseNhsReleaseCalendarPage(content, now, sourceModifiedAt) {
  if (typeof content !== "string" || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("NHS release calendar page content is invalid");
  }
  const financialYear = currentFinancialYear(now);
  const escapedYear = financialYear.replace("-", "-");
  const headings = [...content.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi)];
  const currentPlanSection = headings.find((match) => decodeHtml(match[1]).replace(/\s+/g, " ").trim() === financialYear);
  if (!currentPlanSection) throw new Error("NHS statistics calendar did not list the current financial-year plan");
  const links = [...currentPlanSection[2].matchAll(/<a\b([^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*)>([\s\S]*?)<\/a>/gi)];
  const plan = links.map((match) => ({
    href: decodeHtml(match[2] ?? match[3]),
    label: decodeHtml(match[4]).replace(/\s+/g, " ").trim(),
  })).find((link) => new RegExp(`^12 month plan for ${escapedYear}\\b`, "i").test(link.label));
  if (!plan) throw new Error("NHS statistics calendar did not link the current financial-year plan PDF");
  const publisherUrl = safePlanUrl(plan.href, financialYear);
  if (!publisherUrl) throw new Error("NHS statistics calendar plan is not a verified current-year publisher PDF");
  const status = /proposed/i.test(`${plan.label} ${publisherUrl.pathname}`) ? "provisional" : "unknown";
  return {
    financialYear,
    publisherUrl: publisherUrl.toString(),
    calendarUrl: NHS_CALENDAR_URL,
    sourceModifiedAt: typeof sourceModifiedAt === "string" ? sourceModifiedAt : null,
    status,
  };
}

function validIsoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseNhsReleaseSchedule(pdfText, now = new Date()) {
  if (typeof pdfText !== "string" || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("NHS release schedule text is invalid");
  }
  const dateParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const today = `${dateParts.find((part) => part.type === "year")?.value}-${dateParts.find((part) => part.type === "month")?.value}-${dateParts.find((part) => part.type === "day")?.value}`;
  const events = [];
  const pattern = /(\d{2})\/(\d{2})\/(20\d{2})\s+Referral to treatment waiting times statistics for consultant\s*[-–—]\s*led elective care for\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\s*\d\s*\d)\b/gi;
  for (const match of pdfText.matchAll(pattern)) {
    const date = validIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));
    const monthNumber = MONTHS[match[4].toLowerCase()];
    const year = Number(match[5].replace(/\s/g, ""));
    if (!date || !monthNumber || !Number.isInteger(year) || date <= today) continue;
    const periodEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    if (date <= periodEnd) continue;
    const period = `${match[4][0].toUpperCase()}${match[4].slice(1).toLowerCase()} ${year}`;
    const id = `nhs-rtt-${year}-${String(monthNumber).padStart(2, "0")}`;
    events.push({ id, period, date, dateLabel: `${Number(match[1])} ${match[4]} ${match[3]}` });
  }
  const unique = [...new Map(events.map((event) => [event.id, event])).values()];
  if (!unique.length) throw new Error("NHS annual statistics plan contained no reconciled future RTT release rows");
  return unique.sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchCurrentPlan(fetchImpl, now) {
  const response = await fetchResponse(NHS_CALENDAR_API_URL, fetchImpl, "application/json");
  const contentType = response.headers.get("content-type") ?? "";
  if (!/application\/json/i.test(contentType)) throw new Error("NHS statistics calendar API returned an unexpected content type");
  const payload = JSON.parse(await readResponseText(response, { limit: MAX_CALENDAR_JSON_BYTES, label: "NHS statistics calendar JSON" }));
  if (!Array.isArray(payload) || payload.length !== 1) throw new Error("NHS statistics calendar API returned an unexpected page count");
  const page = payload[0];
  if (page?.title?.rendered !== "12 months statistics calendar" || page?.link !== NHS_CALENDAR_URL || typeof page?.content?.rendered !== "string") {
    throw new Error("NHS statistics calendar page identity could not be verified");
  }
  return parseNhsReleaseCalendarPage(page.content.rendered, now, page.modified);
}

async function collectNhsReleaseCalendar(fetchImpl = fetch, now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("NHS release-calendar check time is invalid");
  const plan = await fetchCurrentPlan(fetchImpl, now);
  const pdfResponse = await fetchResponse(plan.publisherUrl, fetchImpl, "application/pdf");
  if (!/application\/pdf/i.test(pdfResponse.headers.get("content-type") ?? "")) throw new Error("NHS release plan returned an unexpected content type");
  const pdf = await readResponseArrayBuffer(pdfResponse, { limit: MAX_PLAN_PDF_BYTES, label: "NHS annual statistics plan PDF" });
  const checkedAt = now.toISOString();
  const events = parseNhsReleaseSchedule(await extractPdfText(pdf), now).map((event) => ({
    ...event,
    familyIds: ["nhsStats"],
    title: `Planned NHS RTT publication for ${event.period}`,
    publisherUrl: plan.publisherUrl,
    sourceCalendarUrl: plan.calendarUrl,
    status: plan.status,
    checkedAt,
  }));
  const data = {
    events,
    financialYear: plan.financialYear,
    planUrl: plan.publisherUrl,
    calendarUrl: plan.calendarUrl,
    sourceModifiedAt: plan.sourceModifiedAt,
    checkedAt,
    __observation: { status: "current", observedAt: checkedAt, maxAgeHours: 36 },
  };
  return sectionRecord("nhsReleaseCalendar", data, now, "NHS England 12-month statistics plan, RTT schedule", "cloudflare-official-release-calendar");
}

export {
  MAX_PLAN_PDF_BYTES,
  NHS_CALENDAR_API_URL,
  NHS_CALENDAR_URL,
  collectNhsReleaseCalendar,
  currentFinancialYear,
  parseNhsReleaseCalendarPage,
  parseNhsReleaseSchedule,
  safePlanUrl,
};
