import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReleaseCalendar from "@/app/components/ReleaseCalendar";
import type { ReleaseEvent } from "@/app/lib/releaseCalendar";

const events: ReleaseEvent[] = [
  { measureId: "gdpTracker", kind: "upcoming", topic: "Economy", label: "GDP publication", publisherUrl: "https://www.ons.gov.uk/gdp", date: "2026-10-15", certainty: "published", timezone: "Europe/London", confirmedAt: "2026-10-03T08:00:00.000Z" },
  { measureId: "gdpTracker", kind: "recent", topic: "Economy", label: "GDP publication", publisherUrl: "https://www.ons.gov.uk/gdp", date: "2026-09-11", certainty: "published", timezone: "Europe/London", confirmedAt: "2026-10-03T08:00:00.000Z" },
  { measureId: "crimeStatistics", kind: "upcoming", topic: "Crime", label: "Crime publication", publisherUrl: "https://www.ons.gov.uk/crime", date: "2026-10-22", certainty: "published", timezone: "Europe/London", confirmedAt: "2026-10-03T08:00:00.000Z" },
];

describe("release calendar controls", () => {
  it("filters both date lists and the calendar download by topic", () => {
    render(<ReleaseCalendar events={events} generatedAt="2026-10-03T12:00:00.000Z" />);

    expect(screen.getAllByRole("link", { name: "measure and method" })[0].getAttribute("href")).toBe("/measure/gdp-threeMonthGrowth");
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Economy" } });
    expect(screen.getAllByText("GDP publication")).toHaveLength(2);
    expect(screen.queryByText("Crime publication")).toBeNull();
    expect(screen.getByText(/Showing 1 upcoming and 1 recently published dates/)).toBeTruthy();

    const link = screen.getByRole("link", { name: "Download filtered dates (.ics)" });
    const body = decodeURIComponent(link.getAttribute("href")!.split(",")[1]);
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(body).toContain("DTSTART;VALUE=DATE:20261015");
    expect(body).not.toContain("20260911");
  });

  it("filters by publisher status and keeps undated disclosures out of the date download", () => {
    cleanup();
    const rows: ReleaseEvent[] = [
      { ...events[0], status: "confirmed" },
      { measureId: "crimeStatistics", eventId: "crime-cancelled", kind: "upcoming", topic: "Crime", label: "Crime release", publisherUrl: "https://www.ons.gov.uk/releases/crime", date: "2026-10-22", certainty: "published", status: "cancelled", timezone: "Europe/London" },
      { measureId: "nhsStats", kind: "undated", topic: "Health", label: "NHS RTT publication schedule not stated", publisherUrl: "https://www.england.nhs.uk/statistics/", date: null, certainty: "published", status: "unknown", timezone: "Europe/London" },
    ];
    render(<ReleaseCalendar events={rows} generatedAt="2026-10-03T12:00:00.000Z" />);

    fireEvent.change(screen.getAllByRole("combobox", { name: "Publisher status" }).at(-1)!, { target: { value: "cancelled" } });
    const crimeRow = screen.getByText("Crime release").closest("li")!;
    expect(crimeRow).toBeTruthy();
    expect(screen.queryByText("GDP publication")).toBeNull();
    expect(within(crimeRow).getByText("Cancelled")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Download filtered dates (.ics)" });
    expect(decodeURIComponent(link.getAttribute("href")!.split(",")[1])).toContain("STATUS:CANCELLED");

    fireEvent.change(screen.getAllByRole("combobox", { name: "Publisher status" }).at(-1)!, { target: { value: "unknown" } });
    expect(screen.getByText("NHS RTT publication schedule not stated")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Download filtered dates (.ics)" })).toBeNull();
  });

  it("links known release families to their measure and preserves provisional schedule status", () => {
    cleanup();
    render(<ReleaseCalendar events={[
      { measureId: "unemployment", kind: "upcoming", topic: "Jobs", label: "Labour market release", publisherUrl: "https://www.ons.gov.uk/releases/labour", date: "2026-10-20", certainty: "published", status: "confirmed", timezone: "Europe/London" },
      { eventId: "nhs-rtt-2026-08", measureId: "nhsStats", kind: "upcoming", topic: "Health", label: "Planned NHS RTT publication for August 2026", publisherUrl: "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/09/20260924_Proposed-12-month-plan-for-2026-27-for-publication.pdf", date: "2026-10-08", certainty: "published", status: "provisional", timezone: "Europe/London" },
    ]} generatedAt="2026-10-03T12:00:00.000Z" />);

    const labour = screen.getByText("Labour market release").closest("li")!;
    expect(within(labour).getByRole("link", { name: "measure and method" }).getAttribute("href")).toBe("/measure/unemployment");
    const nhs = screen.getByText("Planned NHS RTT publication for August 2026").closest("li")!;
    expect(within(nhs).getByText("Provisional")).toBeTruthy();
    expect(within(nhs).getByRole("link", { name: "measure and method" }).getAttribute("href")).toBe("/measure/waitingPathwaysEstimate");
    expect(within(nhs).getByRole("link", { name: "publisher notice" }).getAttribute("href")).toContain("Proposed-12-month-plan-for-2026-27");
  });
});
