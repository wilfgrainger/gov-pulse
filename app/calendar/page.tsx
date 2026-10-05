import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRouteEnabled } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import ReleaseCalendar from "@/app/components/ReleaseCalendar";
import WatchlistBoard from "@/app/components/WatchlistBoard";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { buildReleaseEvents } from "@/app/lib/releaseCalendar";
import { availableMeasures, type MeasureCatalog } from "@/app/lib/measureCatalog";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";

export const metadata: Metadata = {
  title: "Release calendar and watchlist",
  description: "See publisher-announced release dates and keep a private, on-device list of public measures.",
  alternates: { canonical: "https://public-data.org/calendar/" },
};

export default async function CalendarPage() {
  if (!publicationRouteEnabled("/calendar/")) return <PublicationOffline />;
  const snapshot = await readServerMetricsSnapshot();
  const catalog = snapshot?.meta.measureCatalog as MeasureCatalog | undefined;
  const events = buildReleaseEvents(snapshot);
  const generatedAt = snapshot?.meta.generatedAt;
  const calendarDate = typeof generatedAt === "string" && Number.isFinite(Date.parse(generatedAt)) ? generatedAt : "2000-01-01T00:00:00.000Z";
  return <div className="min-h-screen bg-background text-foreground"><a href="#calendar" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to release calendar</a><SectionNav sections={SECTIONS}/><main id="calendar" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
    <header className="mb-8 border-b-4 border-foreground bg-surface-warm p-5 md:p-8"><p className="eyebrow">On-device tools</p><h1 className="mt-2 text-5xl font-black tracking-[-0.06em] md:text-7xl">Release calendar</h1><p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">Upcoming dates come only from named publishers. Follow measures locally in this browser and export your selected IDs to carry them to another device.</p></header>
    <ReleaseCalendar events={events} generatedAt={calendarDate}/>
    {catalog ? <section aria-labelledby="watchlist-board-heading" className="mt-10"><div className="mb-5"><p className="eyebrow">Private preferences</p><h2 id="watchlist-board-heading" className="mt-2 text-3xl font-black">Your watchlist board</h2></div><WatchlistBoard catalog={catalog} measures={availableMeasures(catalog)}/></section> : <p role="status" className="mt-8 border-l-4 border-accent bg-white p-5 text-sm">No validated measure catalog is available to follow.</p>}
  </main><SiteFooter/></div>;
}
