import { describe, expect, it } from "vitest";
import { buildCalendar, buildReleaseEvents } from "@/app/lib/releaseCalendar";

describe("publisher release calendar", () => {
  it("keeps only future publisher-provided release dates and their direct source links", () => {
    const events = buildReleaseEvents({
      meta: { sources: { crimeStatistics: { status: "ok" }, sentimentPulse: { status: "ok" } } },
      sentimentPulse: { series: {
        inflation: { id: "inflation", label: "CPI inflation", status: "current", nextRelease: "2026-10-15", sourceUrl: "https://www.ons.gov.uk/prices" },
        unemployment: { id: "unemployment", label: "Unemployment", status: "current", nextRelease: null, sourceUrl: "https://www.ons.gov.uk/labour-market" },
      } },
      crimeStatistics: { available: true, headline: { nextReleaseDate: "2026-10-14", publicationUrl: "https://www.ons.gov.uk/crime" } },
    }, new Date("2026-10-02T00:00:00.000Z"));
    expect(events).toEqual([
      { measureId: "crimeStatistics", label: "Crime in England and Wales release", publisherUrl: "https://www.ons.gov.uk/crime", date: "2026-10-14", certainty: "published", timezone: "Europe/London" },
      { measureId: "inflation", label: "CPI inflation publication", publisherUrl: "https://www.ons.gov.uk/prices", date: "2026-10-15", certainty: "published", timezone: "Europe/London" },
    ]);
  });

  it("returns no event from a collector check schedule or an undated publisher", () => {
    expect(buildReleaseEvents({ meta: { sources: {} }, sentimentPulse: { series: { inflation: { status: "current", nextRelease: null } } } }, new Date("2026-10-02T00:00:00.000Z"))).toEqual([]);
  });

  it.each(["2026-03-29", "2026-10-25"])("uses an all-day event across UK daylight-saving boundary %s", (date) => {
    const ics = buildCalendar([{ measureId: "inflation", label: "CPI, revised; release", publisherUrl: "https://www.ons.gov.uk/prices", date, certainty: "published", timezone: "Europe/London" }], new Date("2026-01-01T12:00:00.000Z"));
    const start = date.replaceAll("-", "");
    const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
    expect(ics).toContain(`DTSTART;VALUE=DATE:${start}`);
    expect(ics).toContain(`DTEND;VALUE=DATE:${next}`);
    expect(ics).toContain("SUMMARY:CPI\\, revised\\; release");
    expect(ics).toContain("source timezone: Europe/London");
    expect(ics.endsWith("\r\n")).toBe(true);
  });
});
