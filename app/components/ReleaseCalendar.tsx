"use client";

import { useMemo, useState } from "react";
import type { ReleaseEvent } from "@/app/lib/releaseCalendar";
import { buildCalendar } from "@/app/lib/releaseCalendar";

const measurePages: Record<string, string> = {
  gdpTracker: "gdp-threeMonthGrowth",
  inflation: "inflation",
  employmentStats: "unemployment",
  unemployment: "unemployment",
  realWages: "regularPayRealGrowth",
  nationalDebt: "debt-stock",
  taxRevenue: "receipts",
  migrationStats: "netMigration",
  housePriceIndex: "housePriceChange",
  crimeStatistics: "crime-csew-headline",
  nhsStats: "waitingPathwaysEstimate",
};

function eventList(events: ReleaseEvent[], emptyMessage: string) {
  if (!events.length) return <p role="status" className="mt-4 border-l-4 border-accent bg-surface-warm p-4 text-sm leading-6">{emptyMessage}</p>;
  const statusLabels = { confirmed: "Confirmed", provisional: "Provisional", postponed: "Postponed", cancelled: "Cancelled", published: "Published", unknown: "Status not stated" } as const;
  return <ol className="mt-4 list-none divide-y divide-line p-0">{events.map((event) => <li key={event.eventId ?? `${event.measureId}-${event.kind}-${event.date ?? "undated"}`} className="grid min-w-0 gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
    <p className="font-mono text-sm font-bold">{event.dateLabel ?? (event.date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${event.date}T00:00:00Z`)) : "Date not stated")}</p>
    <div className="min-w-0"><p className="font-semibold">{event.label}</p><p className="mt-1 text-xs text-gray-600"><span className="font-bold">{statusLabels[event.status ?? "unknown"]}</span> · {event.timezone}{event.confirmedAt ? ` · Source checked ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(event.confirmedAt))}` : ""}{measurePages[event.measureId] ? <> · <a className="underline" href={`/measure/${encodeURIComponent(measurePages[event.measureId])}`}>measure and method</a></> : null} · <a className="underline" href={event.publisherUrl} target="_blank" rel="noreferrer">publisher notice</a></p></div>
  </li>)}</ol>;
}

export default function ReleaseCalendar({ events, generatedAt }: { events: ReleaseEvent[]; generatedAt: string }) {
  const [topicFilter, setTopicFilter] = useState("all");
  const [publisherFilter, setPublisherFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const topics = useMemo(() => [...new Set(events.map((event) => event.topic))].sort(), [events]);
  const publishers = useMemo(() => [...new Set(events.map((event) => new URL(event.publisherUrl).hostname))].sort(), [events]);
  const statuses = useMemo(() => [...new Set(events.map((event) => event.status ?? "unknown"))].sort(), [events]);
  const statusLabels = { confirmed: "Confirmed", provisional: "Provisional", postponed: "Postponed", cancelled: "Cancelled", published: "Published", unknown: "Status not stated" } as const;
  const filtered = events.filter((event) => (topicFilter === "all" || event.topic === topicFilter) && (publisherFilter === "all" || new URL(event.publisherUrl).hostname === publisherFilter) && (statusFilter === "all" || (event.status ?? "unknown") === statusFilter));
  const upcoming = filtered.filter((event) => event.kind === "upcoming" && event.date).sort((left, right) => (left.date ?? "").localeCompare(right.date ?? ""));
  const recent = filtered.filter((event) => event.kind === "recent" && event.date).sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
  const undated = filtered.filter((event) => event.kind === "undated");
  const calendar = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildCalendar(upcoming, new Date(generatedAt)))}`;

  return <section aria-labelledby="release-calendar-heading" className="border-y-2 border-foreground bg-white p-5 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Publisher-dated releases</p><h2 id="release-calendar-heading" className="mt-2 text-3xl font-black">Official release dates</h2></div>
      {upcoming.length ? <a href={calendar} download="public-data-releases.ics" className="v3-primary-action">Download filtered dates (.ics)</a> : null}</div>
    <div className="mt-5 grid gap-4 border-y border-line py-4 sm:grid-cols-3" aria-label="Filter release dates">
      <label className="grid gap-1 text-sm font-semibold">Topic<select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="min-h-11 border border-foreground bg-white px-3"><option value="all">All topics</option>{topics.map((topic) => <option key={topic}>{topic}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Publisher<select value={publisherFilter} onChange={(event) => setPublisherFilter(event.target.value)} className="min-h-11 border border-foreground bg-white px-3"><option value="all">All publishers</option>{publishers.map((publisher) => <option key={publisher}>{publisher}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Publisher status<select aria-label="Publisher status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 border border-foreground bg-white px-3"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status as keyof typeof statusLabels]}</option>)}</select></label>
    </div>
    <p className="mt-3 text-xs text-gray-600">Showing {upcoming.length} upcoming and {recent.length} recently published dates; {undated.length} schedule notices have no date. Missing dates remain unknown.</p>
    <div className="mt-7"><h3 className="text-xl font-black">Upcoming</h3>{eventList(upcoming, "No publisher-dated future release events are available in this edition. A data collection check is not a release date.")}</div>
    <div className="mt-8 border-t border-line pt-6"><h3 className="text-xl font-black">Recently published</h3>{eventList(recent, "No recent publisher publication dates are available in this edition.")}</div>
    <div className="mt-8 border-t border-line pt-6"><h3 className="text-xl font-black">Schedule not stated</h3>{eventList(undated, "No undated schedule notices are recorded in this edition.")}</div>
  </section>;
}
