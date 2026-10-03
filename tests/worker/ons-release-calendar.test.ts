import { describe, expect, it, vi } from "vitest";
import { collectOnsReleaseCalendar, parseOnsReleaseCalendarPage } from "../../worker/ons-release-calendar.js";

const now = new Date("2026-10-03T12:00:00.000Z");

function release(title: string, path: string, date: string, dateLabel: string, status: string) {
  return `<li class="ons-list__item ons-u-mt-l"><a href="${path}" data-gtm-release-title="${title}" data-gtm-release-url="${path}" data-gtm-release-date="${date}" data-gtm-release-time="07:00">${title}</a><div>Release date: ${dateLabel} | ${status}</div></li>`;
}

function calendarPage(body: string) {
  return `<html><head><title>Release calendar - Office for National Statistics</title></head><body>${body}</body></html>`;
}

describe("ONS release calendar collector", () => {
  it("keeps only mapped primary release notices with the publisher's status and date", () => {
    const html = [
      release("GDP monthly estimate, UK: August 2026", "/releases/gdpmonthlyestimateukaugust2026", "20261015", "15 October 2026 7:00am", "Confirmed"),
      release("Consumer price inflation, UK: September 2026", "/releases/consumerpriceinflationseptember2026", "20261021", "21 October 2026 7:00am", "Provisional"),
      release("Unrelated ONS release", "/releases/unrelated", "20261016", "16 October 2026 7:00am", "Confirmed"),
    ].join("");

    expect(parseOnsReleaseCalendarPage(html, "upcoming", now)).toEqual([
      expect.objectContaining({
        id: "gdpmonthlyestimateukaugust2026",
        title: "GDP monthly estimate, UK: August 2026",
        familyIds: ["gdpTracker"],
        date: "2026-10-15",
        status: "confirmed",
        publisherUrl: "https://www.ons.gov.uk/releases/gdpmonthlyestimateukaugust2026",
        checkedAt: now.toISOString(),
      }),
      expect.objectContaining({
        id: "consumerpriceinflationseptember2026",
        familyIds: ["inflation"],
        date: "2026-10-21",
        status: "provisional",
      }),
    ]);
  });

  it("marks entries from the publisher's cancelled calendar as cancelled", () => {
    const html = release("Crime in England and Wales: year ending June 2026", "/releases/crimeinenglandandwalesyearendingjune2026", "20261022", "22 October 2026 9:30am", "Cancelled");
    expect(parseOnsReleaseCalendarPage(html, "cancelled", now)).toEqual([
      expect.objectContaining({ familyIds: ["crimeStatistics"], status: "cancelled", date: "2026-10-22" }),
    ]);
  });

  it("reads status labels split across the live ONS calendar's span elements", () => {
    const html = `<li><a href="/releases/gdpaugust2026" data-gtm-release-title="GDP monthly estimate, UK: August 2026" data-gtm-release-url="/releases/gdpaugust2026" data-gtm-release-date="20261015">GDP monthly estimate, UK: August 2026</a><div><span>Release date:</span><span>15 October 2026 7:00am</span><span>|</span><span>Provisional</span></div></li>`;
    expect(parseOnsReleaseCalendarPage(html, "upcoming", now)).toEqual([
      expect.objectContaining({ status: "provisional", date: "2026-10-15", dateLabel: "15 October 2026 7:00am" }),
    ]);
  });

  it("retrieves upcoming and cancelled statuses from the official ONS calendar into a separate currentness record", async () => {
    const pages = new Map([
      ["type-upcoming", calendarPage(release("GDP monthly estimate, UK: August 2026", "/releases/gdpmonthlyestimateukaugust2026", "20261015", "15 October 2026 7:00am", "Confirmed"))],
      ["type-cancelled", calendarPage(release("Crime in England and Wales: year ending June 2026", "/releases/crimeinenglandandwalesyearendingjune2026", "20261022", "22 October 2026 9:30am", "Cancelled"))],
    ]);
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const html = pages.get(url.searchParams.get("release-type") ?? "") ?? "";
      return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    });

    const record = await collectOnsReleaseCalendar(fetchImpl, now);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(record).toMatchObject({ section: "releaseCalendar", fetchedAt: now.toISOString() });
    expect(record.source.provenance?.section).toBe("releaseCalendar");
    expect(record.data.__observation).toMatchObject({ status: "current", observedAt: now.toISOString(), maxAgeHours: 36 });
    expect(record.data.events.map((event) => [event.familyIds[0], event.status])).toEqual([
      ["gdpTracker", "confirmed"],
      ["crimeStatistics", "cancelled"],
    ]);
  });

  it("fails closed on off-host links and impossible calendar dates", () => {
    const html = [
      release("GDP monthly estimate, UK: August 2026", "https://attacker.example/releases/fake", "20261015", "15 October 2026", "Confirmed"),
      release("GDP monthly estimate, UK: August 2026", "/releases/gdpmonthlyestimateukaugust2026", "20260231", "31 February 2026", "Confirmed"),
    ].join("");
    expect(parseOnsReleaseCalendarPage(html, "upcoming", now)).toEqual([]);
  });

  it("rejects a successful HTTP challenge page with the wrong publisher identity", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const body = url.searchParams.get("release-type") === "type-upcoming"
        ? "<html><title>Access denied</title><body>challenge</body></html>"
        : calendarPage("");
      return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    });
    await expect(collectOnsReleaseCalendar(fetchImpl, now)).rejects.toThrow(/identity could not be verified/i);
  });
});
