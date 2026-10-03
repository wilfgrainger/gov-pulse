import { describe, expect, it } from "vitest";
import { buildCalendar, buildReleaseEvents } from "@/app/lib/releaseCalendar";

describe("publisher release calendar", () => {
  it("separates announced future dates from recently published editions", () => {
    const events = buildReleaseEvents({
      meta: { sources: { sentimentPulse: { status: "ok", fetchedAt: "2026-10-03T08:00:00.000Z" } } },
      sentimentPulse: { series: {
        inflation: { id: "inflation", label: "CPI inflation", status: "current", publishedAt: "2026-09-16T00:00:00.000Z", nextRelease: "2026-10-21", sourceUrl: "https://www.ons.gov.uk/prices" },
      } },
    }, new Date("2026-10-03T12:00:00.000Z"));

    expect(events.map(({ kind, date }) => [kind, date])).toEqual([
      ["recent", "2026-09-16"],
      ["upcoming", "2026-10-21"],
    ]);
  });

  it("includes source-announced dates with the source section's confirmation time", () => {
    const events = buildReleaseEvents({
      meta: { sources: {
        gdpTracker: { status: "ok", fetchedAt: "2026-10-03T08:00:00.000Z" },
        employmentStats: { status: "ok", fetchedAt: "2026-10-03T08:01:00.000Z" },
      } },
      gdpTracker: { available: true, headline: { nextReleaseDate: "2026-10-15" }, source: { bulletinUrl: "https://www.ons.gov.uk/economy/gdp/bulletin/latest" } },
      employmentStats: { available: true, headline: { nextReleaseDate: "2026-10-20" }, source: { bulletinUrl: "https://www.ons.gov.uk/employmentandlabourmarket/bulletin/latest" } },
    }, new Date("2026-10-03T12:00:00.000Z"));

    expect(events).toEqual([
      { eventId: "gdpTracker:upcoming:2026-10-15", measureId: "gdpTracker", kind: "upcoming", topic: "Economy", label: "GDP publication", publisherUrl: "https://www.ons.gov.uk/economy/gdp/bulletin/latest", date: "2026-10-15", certainty: "published", status: "unknown", timezone: "Europe/London", confirmedAt: "2026-10-03T08:00:00.000Z" },
      { eventId: "employmentStats:upcoming:2026-10-20", measureId: "employmentStats", kind: "upcoming", topic: "Jobs", label: "Labour market publication", publisherUrl: "https://www.ons.gov.uk/employmentandlabourmarket/bulletin/latest", date: "2026-10-20", certainty: "published", status: "unknown", timezone: "Europe/London", confirmedAt: "2026-10-03T08:01:00.000Z" },
    ]);
  });

  it("keeps only future publisher-provided release dates and their direct source links", () => {
    const events = buildReleaseEvents({
      meta: { sources: {
        crimeStatistics: { status: "ok", fetchedAt: "2026-10-02T00:00:00.000Z" },
        sentimentPulse: { status: "ok", fetchedAt: "2026-10-02T00:00:00.000Z" },
      } },
      sentimentPulse: { series: {
        inflation: { id: "inflation", label: "CPI inflation", status: "current", nextRelease: "2026-10-15", sourceUrl: "https://www.ons.gov.uk/prices" },
        unemployment: { id: "unemployment", label: "Unemployment", status: "current", nextRelease: null, sourceUrl: "https://www.ons.gov.uk/labour-market" },
      } },
      crimeStatistics: { available: true, headline: { nextReleaseDate: "2026-10-14", publicationUrl: "https://www.ons.gov.uk/crime" } },
    }, new Date("2026-10-02T00:00:00.000Z"));
    expect(events).toEqual([
      { eventId: "crimeStatistics:upcoming:2026-10-14", measureId: "crimeStatistics", kind: "upcoming", topic: "Crime", label: "Crime in England and Wales release", publisherUrl: "https://www.ons.gov.uk/crime", date: "2026-10-14", certainty: "published", status: "unknown", timezone: "Europe/London", confirmedAt: "2026-10-02T00:00:00.000Z" },
      { eventId: "inflation:upcoming:2026-10-15", measureId: "inflation", kind: "upcoming", topic: "Prices", label: "CPI inflation publication", publisherUrl: "https://www.ons.gov.uk/prices", date: "2026-10-15", certainty: "published", status: "unknown", timezone: "Europe/London", confirmedAt: "2026-10-02T00:00:00.000Z" },
    ]);
  });

  it("returns no event from a collector check schedule or an undated publisher", () => {
    expect(buildReleaseEvents({ meta: { sources: {} }, sentimentPulse: { series: { inflation: { status: "current", nextRelease: null } } } }, new Date("2026-10-02T00:00:00.000Z"))).toEqual([]);
  });

  it("keeps a verified source date when its related measure value is unavailable", () => {
    const events = buildReleaseEvents({
      meta: { sources: { sentimentPulse: { status: "ok", fetchedAt: "2026-10-03T08:00:00.000Z" } } },
      sentimentPulse: { series: {
        inflation: { id: "inflation", label: "CPI inflation", status: "unavailable", nextRelease: "2026-10-15", sourceUrl: "https://www.ons.gov.uk/prices" },
      } },
    }, new Date("2026-10-03T12:00:00.000Z"));
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-10-15");
  });

  it("uses the live ONS calendar status, release identity and direct notice URL", () => {
    const events = buildReleaseEvents({
      meta: { sources: { releaseCalendar: { status: "ok", fetchedAt: "2026-10-03T08:00:00.000Z" } } },
      releaseCalendar: { events: [
        { id: "gdp-august-2026", familyIds: ["gdpTracker"], title: "GDP monthly estimate, UK: August 2026", date: "2026-10-15", dateLabel: "15 October 2026 7:00am", status: "confirmed", publisherUrl: "https://www.ons.gov.uk/releases/gdpaugust2026", timezone: "Europe/London", checkedAt: "2026-10-03T08:00:00.000Z" },
        { id: "crime-june-2026", familyIds: ["crimeStatistics"], title: "Crime in England and Wales: year ending June 2026", date: "2026-10-22", dateLabel: "22 October 2026 9:30am", status: "cancelled", publisherUrl: "https://www.ons.gov.uk/releases/crimejune2026", timezone: "Europe/London", checkedAt: "2026-10-03T08:00:00.000Z" },
      ] },
    }, new Date("2026-10-03T12:00:00.000Z"));

    expect(events).toEqual([
      expect.objectContaining({ eventId: "gdp-august-2026", measureId: "gdpTracker", kind: "upcoming", status: "confirmed", dateLabel: "15 October 2026 7:00am", publisherUrl: "https://www.ons.gov.uk/releases/gdpaugust2026" }),
      expect.objectContaining({ eventId: "crime-june-2026", measureId: "crimeStatistics", status: "cancelled" }),
    ]);
  });

  it("shows a missing NHS schedule as undated and links its primary source", () => {
    const events = buildReleaseEvents({
      meta: { sources: { nhsStats: { status: "ok", fetchedAt: "2026-10-03T08:00:00.000Z" }, releaseCalendar: { status: "ok", fetchedAt: "2026-10-03T08:00:00.000Z" } } },
      nhsStats: { source: { landingUrl: "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/" } },
      releaseCalendar: { events: [] },
    }, new Date("2026-10-03T12:00:00.000Z"));

    expect(events).toContainEqual(expect.objectContaining({
      measureId: "nhsStats", kind: "undated", status: "unknown", date: null,
      label: expect.stringMatching(/schedule.*not stated/i),
      publisherUrl: "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
    }));
  });

  it("shows a provisional publisher schedule independently of NHS metric availability", () => {
    const events = buildReleaseEvents({
      meta: { sources: {
        nhsStats: { status: "unavailable" },
        nhsReleaseCalendar: { status: "ok", fetchedAt: "2026-10-03T08:00:00.000Z" },
      } },
      nhsReleaseCalendar: { events: [
        { id: "nhs-rtt-2026-08", title: "Planned NHS RTT publication for August 2026", familyIds: ["nhsStats"], date: "2026-10-08", dateLabel: "8 October 2026", status: "provisional", publisherUrl: "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/09/20260924_Proposed-12-month-plan-for-2026-27-for-publication.pdf", checkedAt: "2026-10-03T08:00:00.000Z" },
      ] },
    }, new Date("2026-10-03T12:00:00.000Z"));

    expect(events).toEqual([expect.objectContaining({
      eventId: "nhs-rtt-2026-08",
      measureId: "nhsStats",
      kind: "upcoming",
      status: "provisional",
      date: "2026-10-08",
      confirmedAt: "2026-10-03T08:00:00.000Z",
    })]);
  });

  it("rejects a forged or stale NHS schedule event", () => {
    const events = buildReleaseEvents({
      meta: { sources: { nhsReleaseCalendar: { status: "stale", fetchedAt: "2026-10-01T08:00:00.000Z" } } },
      nhsReleaseCalendar: { events: [
        { id: "nhs-rtt-2026-08", title: "Forged", familyIds: ["nhsStats"], date: "2026-10-08", status: "confirmed", publisherUrl: "https://attacker.example/plan.pdf" },
      ] },
    }, new Date("2026-10-03T12:00:00.000Z"));

    expect(events).toEqual([]);
  });

  it.each(["2026-03-29", "2026-10-25"])("uses an all-day event across UK daylight-saving boundary %s", (date) => {
    const ics = buildCalendar([{ measureId: "inflation", kind: "upcoming", topic: "Prices", label: "CPI, revised; release", publisherUrl: "https://www.ons.gov.uk/prices", date, certainty: "published", timezone: "Europe/London" }], new Date("2026-01-01T12:00:00.000Z"));
    const start = date.replaceAll("-", "");
    const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
    expect(ics).toContain(`DTSTART;VALUE=DATE:${start}`);
    expect(ics).toContain(`DTEND;VALUE=DATE:${next}`);
    expect(ics).toContain("SUMMARY:CPI\\, revised\\; release");
    expect(ics).toContain("source timezone: Europe/London");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("keeps a stable calendar identity when the same publisher release is rescheduled", () => {
    const event = { measureId: "gdpTracker", kind: "upcoming" as const, topic: "Economy", label: "GDP publication", publisherUrl: "https://www.ons.gov.uk/economy/gdp", date: "2026-10-15", certainty: "published" as const, timezone: "Europe/London" };
    const original = buildCalendar([event], new Date("2026-10-03T12:00:00.000Z"));
    const rescheduled = buildCalendar([{ ...event, date: "2026-10-16" }], new Date("2026-10-04T12:00:00.000Z"));
    expect(original.match(/UID:[^\r\n]+/)?.[0]).toBe(rescheduled.match(/UID:[^\r\n]+/)?.[0]);
    expect(rescheduled).toContain("DTSTART;VALUE=DATE:20261016");
  });

  it("preserves publisher cancellation status in the iCalendar export", () => {
    const ics = buildCalendar([{ measureId: "crimeStatistics", eventId: "crime-june-2026", kind: "upcoming", topic: "Crime", label: "Crime release", publisherUrl: "https://www.ons.gov.uk/releases/crimejune2026", date: "2026-10-22", certainty: "published", status: "cancelled", timezone: "Europe/London" }], new Date("2026-10-03T12:00:00.000Z"));
    expect(ics).toContain("UID:crime-june-2026@public-data.org");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("folds long UTF-8 iCalendar lines at the byte limit and preserves the event text", () => {
    const label = "é".repeat(90);
    const ics = buildCalendar([{ measureId: "inflation", kind: "upcoming", topic: "Prices", label, publisherUrl: "https://www.ons.gov.uk/prices", date: "2026-10-21", certainty: "published", status: "confirmed", timezone: "Europe/London" }], new Date("2026-10-03T12:00:00.000Z"));
    const physicalLines = ics.split("\r\n").filter(Boolean);
    expect(Math.max(...physicalLines.map((line) => new TextEncoder().encode(line).length))).toBeLessThanOrEqual(75);
    const unfolded = physicalLines.reduce<string[]>((lines, line) => {
      if (line.startsWith(" ")) lines[lines.length - 1] += line.slice(1);
      else lines.push(line);
      return lines;
    }, []).join("\r\n");
    expect(unfolded).toContain(`SUMMARY:${label}`);
  });
});
