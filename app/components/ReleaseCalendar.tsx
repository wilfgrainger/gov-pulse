"use client";

import type { ReleaseEvent } from "@/app/lib/releaseCalendar";
import { buildCalendar } from "@/app/lib/releaseCalendar";

export default function ReleaseCalendar({ events, generatedAt }: { events: ReleaseEvent[]; generatedAt: string }) {
  const calendar = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildCalendar(events, new Date(generatedAt)))}`;
  return <section aria-labelledby="release-calendar-heading" className="border-y-2 border-foreground bg-white p-5 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Publisher-dated releases</p><h2 id="release-calendar-heading" className="mt-2 text-3xl font-black">Upcoming official releases</h2></div>
      <a href={calendar} download="public-data-releases.ics" className="v3-primary-action">Download calendar (.ics)</a></div>
    {events.length ? <ol className="mt-6 list-none divide-y divide-line p-0">{events.map((event) => <li key={`${event.measureId}-${event.date}`} className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><p className="font-mono text-sm font-bold">{new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${event.date}T00:00:00Z`))}</p><div><p className="font-semibold">{event.label}</p><p className="mt-1 text-xs text-gray-600">{event.certainty === "published" ? "Date published by the source" : "Source estimate"} · {event.timezone} · <a className="underline" href={event.publisherUrl} target="_blank" rel="noreferrer">publisher source</a></p></div></li>)}</ol> : <p role="status" className="mt-5 border-l-4 border-accent bg-surface-warm p-5 text-sm leading-6">No publisher-dated future release events are available in this edition. The next data collection check is not a release date.</p>}
  </section>;
}
