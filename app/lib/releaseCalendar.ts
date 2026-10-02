export type ReleaseEvent = {
  measureId: string;
  label: string;
  publisherUrl: string;
  date: string;
  certainty: "published" | "estimated";
  timezone: string;
};

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function buildReleaseEvents(snapshot: unknown, now = new Date()): ReleaseEvent[] {
  if (!snapshot || typeof snapshot !== "object" || !Number.isFinite(now.getTime())) return [];
  const root = snapshot as Record<string, unknown>;
  const sources = (root.meta as Record<string, unknown> | undefined)?.sources as Record<string, Record<string, unknown>> | undefined;
  const londonDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const today = `${londonDate.find((part) => part.type === "year")?.value}-${londonDate.find((part) => part.type === "month")?.value}-${londonDate.find((part) => part.type === "day")?.value}`;
  const events: ReleaseEvent[] = [];
  const pulse = root.sentimentPulse as Record<string, unknown> | undefined;
  const series = pulse?.series as Record<string, Record<string, unknown>> | undefined;
  for (const id of ["inflation", "unemployment"]) {
    const item = series?.[id];
    const date = item?.nextRelease;
    const sourceUrl = item?.sourceUrl;
    if (sources?.sentimentPulse?.status !== "ok" || item?.status !== "current" || !isDate(date) || date < today || typeof sourceUrl !== "string" || !/^https:\/\//.test(sourceUrl)) continue;
    events.push({ measureId: id, label: `${String(item.label ?? id)} publication`, publisherUrl: sourceUrl, date, certainty: "published", timezone: "Europe/London" });
  }
  const crime = root.crimeStatistics as Record<string, unknown> | undefined;
  const crimeHeadline = crime?.headline as Record<string, unknown> | undefined;
  const crimeDate = crimeHeadline?.nextReleaseDate;
  const crimeUrl = crimeHeadline?.publicationUrl;
  if (sources?.crimeStatistics?.status === "ok" && crime?.available === true && isDate(crimeDate) && crimeDate >= today && typeof crimeUrl === "string" && /^https:\/\//.test(crimeUrl)) {
    events.push({ measureId: "crimeStatistics", label: "Crime in England and Wales release", publisherUrl: crimeUrl, date: crimeDate, certainty: "published", timezone: "Europe/London" });
  }
  return events.sort((left, right) => left.date.localeCompare(right.date) || left.measureId.localeCompare(right.measureId));
}

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\r\n", "\n").replaceAll("\r", "\n").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

export function buildCalendar(events: ReleaseEvent[], now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error("Calendar generation date is invalid");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//public-data.org//Release Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const event of [...events].sort((left, right) => left.date.localeCompare(right.date) || left.measureId.localeCompare(right.measureId))) {
    let source: URL;
    try { source = new URL(event.publisherUrl); } catch { throw new Error("Release event identity, date, certainty and publisher source are required"); }
    if (!event.measureId.trim() || !event.label.trim() || source.protocol !== "https:" || source.username || source.password || !isDate(event.date) || !["published", "estimated"].includes(event.certainty) || !event.timezone.trim()) throw new Error("Release event identity, date, certainty and publisher source are required");
    const end = new Date(Date.parse(`${event.date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
    const start = event.date.replaceAll("-", "");
    const uid = `${encodeURIComponent(event.measureId)}-${start}@public-data.org`;
    lines.push("BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${now.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${escapeIcs(event.label)}`, `DESCRIPTION:${escapeIcs(`${event.certainty === "estimated" ? "Estimated date" : "Publisher release date"}; source timezone: ${event.timezone}`)}`, `URL:${source.href}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
