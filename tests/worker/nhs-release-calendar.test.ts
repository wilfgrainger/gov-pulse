import { describe, expect, it, vi } from "vitest";
import { collectNhsReleaseCalendar, parseNhsReleaseCalendarPage, parseNhsReleaseSchedule } from "../../worker/nhs-release-calendar.js";

const now = new Date("2026-10-03T12:00:00.000Z");
const pdfUrl = "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/09/20260924_Proposed-12-month-plan-for-2026-27-for-publication.pdf";
const sourcePage = "https://www.england.nhs.uk/statistics/12-months-statistics-calendar/";

function schedulePage({ year = "2026-27", href = pdfUrl, title = "12 month plan for 2026-27 (28 September 2026) (PDF, 291KB)" } = {}) {
  return `<h3>${year}</h3><p><a href="${href}">${title}</a></p>`;
}

function pdfWithText(...rows: string[]) {
  const text = rows.map((row) => `(${row.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")}) Tj`).join("\n");
  return new TextEncoder().encode(`%PDF-1.4\n1 0 obj\n<< /Length 5000 >>\nstream\nBT\n${text}\nET\nendstream\nendobj\n%%EOF`);
}

function scheduleApi(content: string) {
  return [{
    modified: "2026-09-28T13:42:14",
    link: sourcePage,
    title: { rendered: "12 months statistics calendar" },
    content: { rendered: content },
  }];
}

describe("NHS England RTT release calendar collector", () => {
  it("selects the current financial-year plan from the NHS publisher index", () => {
    expect(parseNhsReleaseCalendarPage(schedulePage(), now, "2026-09-28T13:42:14")).toEqual(expect.objectContaining({
      financialYear: "2026-27",
      publisherUrl: pdfUrl,
      calendarUrl: sourcePage,
      sourceModifiedAt: "2026-09-28T13:42:14",
      status: "provisional",
    }));
  });

  it("parses only future RTT publication rows and preserves the month being reported", () => {
    const text = [
      "14/05/2026 Referral to treatment waiting times statistics for consultant - led elective care for March 2026 Accredited Official",
      "08/10/2026 Referral to treatment waiting times statistics for consultant - led elective care for August 2026 Accredited Official",
      "12/11/2026 Referral to treatment waiting times statistics for consultant - led elective care for September 2026 Accredited Official",
      "11/03/2027 Referral to treatment waiting times statistics for consultant - led elective care for January 202 7 Accredited Official",
    ].join(" ");
    expect(parseNhsReleaseSchedule(text, now)).toEqual([
      expect.objectContaining({ id: "nhs-rtt-2026-08", date: "2026-10-08", dateLabel: "8 October 2026", period: "August 2026" }),
      expect.objectContaining({ id: "nhs-rtt-2026-09", date: "2026-11-12", dateLabel: "12 November 2026", period: "September 2026" }),
      expect.objectContaining({ id: "nhs-rtt-2027-01", date: "2027-03-11", dateLabel: "11 March 2027", period: "January 2027" }),
    ]);
  });

  it("retrieves and reconciles the current official PDF as optional currentness evidence", async () => {
    const pdf = pdfWithText(
      "08/10/2026 Referral to treatment waiting times statistics for consultant - led elective care for August 2026 Accredited Official",
      "12/11/2026 Referral to treatment waiting times statistics for consultant - led elective care for September 2026 Accredited Official",
    );
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("wp-json/wp/v2/pages")) {
        return new Response(JSON.stringify(scheduleApi(schedulePage())), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(pdf, { status: 200, headers: { "content-type": "application/pdf" } });
    });

    const record = await collectNhsReleaseCalendar(fetchImpl, now);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(record).toMatchObject({ section: "nhsReleaseCalendar", fetchedAt: now.toISOString() });
    expect(record.data).toMatchObject({
      financialYear: "2026-27",
      calendarUrl: sourcePage,
      planUrl: pdfUrl,
      __observation: { status: "current", observedAt: now.toISOString(), maxAgeHours: 36 },
    });
    expect(record.data.events).toEqual([
      expect.objectContaining({ id: "nhs-rtt-2026-08", date: "2026-10-08", familyIds: ["nhsStats"], status: "provisional" }),
      expect.objectContaining({ id: "nhs-rtt-2026-09", date: "2026-11-12", familyIds: ["nhsStats"], status: "provisional" }),
    ]);
  });

  it("fails closed on a missing current-year plan or off-publisher PDF", () => {
    expect(() => parseNhsReleaseCalendarPage(schedulePage({ year: "2025-26" }), now)).toThrow(/current financial-year/i);
    expect(() => parseNhsReleaseCalendarPage(schedulePage({ href: "https://attacker.example/plan.pdf" }), now)).toThrow(/publisher PDF/i);
  });

  it("rejects an index challenge page or a PDF without reconciled RTT publication rows", async () => {
    const challenge = vi.fn(async () => new Response("<html>Access denied</html>", { status: 200, headers: { "content-type": "text/html" } }));
    await expect(collectNhsReleaseCalendar(challenge, now)).rejects.toThrow(/identity|content type/i);

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => String(input).includes("wp-json/wp/v2/pages")
      ? new Response(JSON.stringify(scheduleApi(schedulePage())), { status: 200, headers: { "content-type": "application/json" } })
      : new Response(pdfWithText("Unrelated release dates"), { status: 200, headers: { "content-type": "application/pdf" } }));
    await expect(collectNhsReleaseCalendar(fetchImpl, now)).rejects.toThrow(/RTT release rows/i);
  });
});
