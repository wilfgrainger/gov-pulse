export type ReleaseEvent = {
  eventId?: string;
  measureId: string;
  kind: "upcoming" | "recent" | "undated";
  topic: string;
  label: string;
  publisherUrl: string;
  date: string | null;
  dateLabel?: string;
  certainty: "published" | "estimated";
  status?: "confirmed" | "provisional" | "postponed" | "cancelled" | "published" | "unknown";
  timezone: string;
  confirmedAt?: string;
};

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isPublisherUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function confirmedAt(source: Record<string, unknown> | undefined, item?: Record<string, unknown>): string | undefined {
  const value = item?.retrievedAt ?? source?.fetchedAt;
  return isTimestamp(value) ? value : undefined;
}

function announcedEvent(
  events: ReleaseEvent[],
  today: string,
  recentCutoff: string,
  options: {
    id: string;
    kind: "upcoming" | "recent";
    topic: string;
    label: string;
    date: unknown;
    url: unknown;
    sectionStatus: unknown;
    confirmedAt: unknown;
  },
) {
  const { date, url, confirmedAt: checkedAt } = options;
  if (options.sectionStatus !== "ok" || !isDate(date) || !isPublisherUrl(url) || !isTimestamp(checkedAt)) return;
  const dateInRange = options.kind === "upcoming"
    ? date >= today
    : date < today && date >= recentCutoff;
  if (!dateInRange) return;
  events.push({
    eventId: `${options.id}:${options.kind}:${date}`,
    measureId: options.id,
    kind: options.kind,
    topic: options.topic,
    label: options.label,
    publisherUrl: url,
    date,
    certainty: "published",
    status: options.kind === "recent" ? "published" : "unknown",
    timezone: "Europe/London",
    confirmedAt: checkedAt,
  });
}

export function buildReleaseEvents(snapshot: unknown, now = new Date()): ReleaseEvent[] {
  if (!snapshot || typeof snapshot !== "object" || !Number.isFinite(now.getTime())) return [];
  const root = snapshot as Record<string, unknown>;
  const sources = asRecord(asRecord(root.meta)?.sources);
  const londonDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const today = `${londonDate.find((part) => part.type === "year")?.value}-${londonDate.find((part) => part.type === "month")?.value}-${londonDate.find((part) => part.type === "day")?.value}`;
  const recentCutoff = new Date(Date.parse(`${today}T00:00:00.000Z`) - 60 * 86_400_000).toISOString().slice(0, 10);
  const events: ReleaseEvent[] = [];
  const officialCalendar = asRecord(root.releaseCalendar);
  const officialCalendarSource = asRecord(sources?.releaseCalendar);
  const hasCurrentOfficialCalendar = officialCalendarSource?.status === "ok" && Array.isArray(officialCalendar?.events);
  const calendarFamilies = new Set<string>();
  if (hasCurrentOfficialCalendar) {
    const topics: Record<string, string> = {
      gdpTracker: "Economy", inflation: "Prices", employmentStats: "Jobs", realWages: "Jobs",
      nationalDebt: "Public finances", taxRevenue: "Public finances", migrationStats: "Migration",
      housePriceIndex: "Prices and housing", crimeStatistics: "Crime", nhsStats: "Health",
    };
    const allowedStatuses = new Set(["confirmed", "provisional", "postponed", "cancelled", "unknown"]);
    for (const raw of officialCalendar.events as unknown[]) {
      const item = asRecord(raw);
      if (!item || typeof item.id !== "string" || !/^[A-Za-z0-9._-]{1,120}$/.test(item.id) || typeof item.title !== "string" || !Array.isArray(item.familyIds) || typeof item.publisherUrl !== "string" || !isPublisherUrl(item.publisherUrl)) continue;
      let url: URL;
      try { url = new URL(item.publisherUrl); } catch { continue; }
      if (url.hostname !== "www.ons.gov.uk" || !/^\/releases\/[A-Za-z0-9._-]+$/.test(url.pathname)) continue;
      const families = item.familyIds.filter((id): id is string => typeof id === "string" && Boolean(topics[id]));
      if (!families.length || !allowedStatuses.has(String(item.status))) continue;
      for (const family of families) calendarFamilies.add(family);
      const checkedAt = isTimestamp(item.checkedAt) ? item.checkedAt : confirmedAt(officialCalendarSource);
      const date = item.date === null || item.date === undefined ? null : item.date;
      if (date !== null && (!isDate(date) || date < today)) continue;
      events.push({
        eventId: item.id,
        measureId: families[0],
        kind: date === null ? "undated" : "upcoming",
        topic: topics[families[0]],
        label: item.title,
        publisherUrl: url.toString(),
        date,
        ...(typeof item.dateLabel === "string" && item.dateLabel.trim() ? { dateLabel: item.dateLabel } : {}),
        certainty: "published",
        status: item.status as ReleaseEvent["status"],
        timezone: "Europe/London",
        ...(checkedAt ? { confirmedAt: checkedAt } : {}),
      });
    }
  }

  const nhsCalendar = asRecord(root.nhsReleaseCalendar);
  const nhsCalendarSource = asRecord(sources?.nhsReleaseCalendar);
  const hasCurrentNhsCalendar = nhsCalendarSource?.status === "ok" && Array.isArray(nhsCalendar?.events);
  if (hasCurrentNhsCalendar) {
    calendarFamilies.add("nhsStats");
    for (const raw of nhsCalendar.events as unknown[]) {
      const item = asRecord(raw);
      if (!item || typeof item.id !== "string" || !/^nhs-rtt-20\d{2}-\d{2}$/.test(item.id) || typeof item.title !== "string" || !Array.isArray(item.familyIds) || !item.familyIds.includes("nhsStats") || !isDate(item.date) || item.date < today || !isPublisherUrl(item.publisherUrl) || !["provisional", "confirmed", "postponed", "cancelled", "unknown"].includes(String(item.status))) continue;
      let url: URL;
      try { url = new URL(item.publisherUrl as string); } catch { continue; }
      if (url.hostname !== "www.england.nhs.uk" || !/^\/statistics\/wp-content\/uploads\/sites\/2\/20\d{2}\/(?:0[1-9]|1[0-2])\/[^/?#]+\.pdf$/i.test(url.pathname) || url.search || url.hash) continue;
      const checkedAt = isTimestamp(item.checkedAt) ? item.checkedAt : confirmedAt(nhsCalendarSource);
      events.push({
        eventId: item.id,
        measureId: "nhsStats",
        kind: "upcoming",
        topic: "Health",
        label: item.title,
        publisherUrl: url.toString(),
        date: item.date,
        ...(typeof item.dateLabel === "string" && item.dateLabel.trim() ? { dateLabel: item.dateLabel } : {}),
        certainty: "published",
        status: item.status as ReleaseEvent["status"],
        timezone: "Europe/London",
        ...(checkedAt ? { confirmedAt: checkedAt } : {}),
      });
    }
  }

  const nhs = asRecord(root.nhsStats);
  const nhsMeta = asRecord(sources?.nhsStats);
  const nhsSource = asRecord(nhs?.source);
  const nhsLandingUrl = typeof nhsSource?.landingUrl === "string" && isPublisherUrl(nhsSource.landingUrl)
    ? new URL(nhsSource.landingUrl)
    : null;
  if (nhsMeta?.status === "ok" && nhsLandingUrl?.hostname === "www.england.nhs.uk" && !calendarFamilies.has("nhsStats")) {
    events.push({
      eventId: "nhs-rtt-schedule-not-stated",
      measureId: "nhsStats",
      kind: "undated",
      topic: "Health",
      label: "NHS RTT publication schedule not stated by publisher",
      publisherUrl: nhsLandingUrl.toString(),
      date: null,
      certainty: "published",
      status: "unknown",
      timezone: "Europe/London",
      ...(confirmedAt(nhsMeta) ? { confirmedAt: confirmedAt(nhsMeta) } : {}),
    });
  }

  const pulse = asRecord(root.sentimentPulse);
  const series = asRecord(pulse?.series);
  for (const id of ["inflation", "unemployment"]) {
    const item = asRecord(series?.[id]);
    const source = asRecord(sources?.sentimentPulse);
    if (!item) continue;
    for (const candidate of [
      { kind: "recent" as const, date: typeof item.publishedAt === "string" ? item.publishedAt.slice(0, 10) : null },
      ...(!hasCurrentOfficialCalendar || !calendarFamilies.has(id) ? [{ kind: "upcoming" as const, date: item.nextRelease }] : []),
    ]) announcedEvent(events, today, recentCutoff, {
      id,
      kind: candidate.kind,
      topic: id === "inflation" ? "Prices" : "Jobs",
      label: `${String(item.label ?? id)} publication`,
      date: candidate.date,
      url: item.sourceUrl,
      sectionStatus: source?.status,
      confirmedAt: confirmedAt(source, item),
    });
  }

  const sectionReleases = [
    { id: "gdpTracker", label: "GDP publication", topic: "Economy", recentDate: "releaseDate", date: "nextReleaseDate", url: "bulletinUrl" },
    { id: "employmentStats", label: "Labour market publication", topic: "Jobs", recentDate: "releaseDate", date: "nextReleaseDate", url: "bulletinUrl" },
    { id: "nationalDebt", label: "Public sector net debt publication", topic: "Public finances", recentDate: "publicationDate", date: "nextReleaseDate", url: "debtUrl" },
    { id: "taxRevenue", label: "Public finances publication", topic: "Public finances", recentDate: "releaseDate", date: "nextReleaseDate", url: "bulletinUrl" },
    { id: "migrationStats", label: "International migration publication", topic: "Migration", recentDate: "releaseDate", date: "nextReleaseDate", url: "bulletinUrl" },
    { id: "housePriceIndex", label: "Private rents and house prices publication", topic: "Prices and housing", recentDate: "releaseDate", date: "nextReleaseDate", url: "bulletinUrl" },
    { id: "realWages", label: "Average weekly earnings publication", topic: "Jobs", recentDate: "releaseDate", date: "nextReleaseDate", url: "bulletinUrl" },
  ];
  for (const section of sectionReleases) {
    const data = asRecord(root[section.id]);
    const headline = asRecord(data?.headline) ?? data;
    const source = asRecord(data?.source);
    const meta = asRecord(sources?.[section.id]);
    if (!data || !headline || !source || !meta) continue;
    for (const candidate of [
      { kind: "recent" as const, date: headline[section.recentDate] ?? data[section.recentDate] },
      ...(!hasCurrentOfficialCalendar || !calendarFamilies.has(section.id) ? [{ kind: "upcoming" as const, date: headline[section.date] ?? data[section.date] }] : []),
    ]) announcedEvent(events, today, recentCutoff, {
      id: section.id,
      kind: candidate.kind,
      topic: section.topic,
      label: section.label,
      date: candidate.date,
      url: source[section.url],
      sectionStatus: meta.status,
      confirmedAt: confirmedAt(meta),
    });
  }

  const crime = asRecord(root.crimeStatistics);
  const crimeHeadline = asRecord(crime?.headline);
  const crimeSource = asRecord(sources?.crimeStatistics);
  for (const candidate of [
    { kind: "recent" as const, date: crimeHeadline?.releaseDate },
    ...(!hasCurrentOfficialCalendar || !calendarFamilies.has("crimeStatistics") ? [{ kind: "upcoming" as const, date: crimeHeadline?.nextReleaseDate }] : []),
  ]) announcedEvent(events, today, recentCutoff, {
    id: "crimeStatistics",
    kind: candidate.kind,
    topic: "Crime",
    label: "Crime in England and Wales release",
    date: candidate.date,
    url: crimeHeadline?.publicationUrl,
    sectionStatus: crimeSource?.status === "ok" && crime?.available === true ? "ok" : crimeSource?.status,
    confirmedAt: confirmedAt(crimeSource),
  });

  return events.sort((left, right) => (left.date ?? "9999-12-31").localeCompare(right.date ?? "9999-12-31") || left.measureId.localeCompare(right.measureId));
}

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\r\n", "\n").replaceAll("\r", "\n").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let segment = "";
  let byteLength = 0;
  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    if (byteLength + characterBytes > 75) {
      folded.push(segment);
      segment = ` ${character}`;
      byteLength = 1 + characterBytes;
    } else {
      segment += character;
      byteLength += characterBytes;
    }
  }
  folded.push(segment);
  return folded.join("\r\n");
}

export function buildCalendar(events: ReleaseEvent[], now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error("Calendar generation date is invalid");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//public-data.org//Release Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const event of [...events].sort((left, right) => (left.date ?? "9999-12-31").localeCompare(right.date ?? "9999-12-31") || left.measureId.localeCompare(right.measureId))) {
    let source: URL;
    try { source = new URL(event.publisherUrl); } catch { throw new Error("Release event identity, date, certainty and publisher source are required"); }
    if (!event.measureId.trim() || !event.label.trim() || source.protocol !== "https:" || source.username || source.password || !isDate(event.date) || !["published", "estimated"].includes(event.certainty) || !event.timezone.trim() || (event.confirmedAt !== undefined && !isTimestamp(event.confirmedAt))) throw new Error("Release event identity, date, certainty and publisher source are required");
    const end = new Date(Date.parse(`${event.date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
    const start = event.date.replaceAll("-", "");
    const uid = `${encodeURIComponent(event.eventId ?? event.measureId)}@public-data.org`;
    const description = `${event.certainty === "estimated" ? "Estimated date" : "Publisher release date"}; source timezone: ${event.timezone}${event.confirmedAt ? `; source checked: ${event.confirmedAt}` : ""}`;
    const calendarStatus = event.status === "cancelled" ? "CANCELLED" : ["confirmed", "published"].includes(event.status ?? "") ? "CONFIRMED" : "TENTATIVE";
    lines.push("BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${now.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `STATUS:${calendarStatus}`, `SUMMARY:${escapeIcs(event.label)}`, `DESCRIPTION:${escapeIcs(description)}`, `URL:${source.href}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
