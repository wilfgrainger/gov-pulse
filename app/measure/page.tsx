import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRoutePublished } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import MeasureLibrary from "@/app/components/MeasureLibrary";
import type { MeasureLibraryItem } from "@/app/components/MeasureLibrary";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { measureAvailabilityReason, measurePublisher } from "@/app/lib/measureAvailability";
import { measureForDisplay } from "@/app/lib/measureCatalog";
import { MEASURES } from "@/app/lib/measureDefinitions";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";

export const metadata: Metadata = {
  title: "Measure library",
  description: "Browse public measures with their definitions, observations, source editions, caveats and publication dates.",
  alternates: { canonical: "https://public-data.org/measure/" },
};

export default async function MeasureIndexPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!publicationRoutePublished("/measure/")) return <PublicationOffline />;
  const query = process.env.STATIC_EXPORT === "true" ? {} : await searchParams;
  const queryEntries: [string, string][] = [];
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") queryEntries.push([key, first]);
  }
  const initialSearch = new URLSearchParams(queryEntries).toString();
  const snapshot = await readServerMetricsSnapshot();
  const catalog = snapshot?.meta.measureCatalog;
  const now = new Date();
  const measures: MeasureLibraryItem[] = MEASURES.map((definition) => {
    const record = measureForDisplay(catalog, definition.id, now);
    const source = snapshot?.meta.sources[definition.section];
    const publisher = measurePublisher(definition, source);
    const availabilityReason = measureAvailabilityReason(definition, {
      record,
      source,
      snapshotAvailable: Boolean(snapshot),
    });
    return {
      ...definition,
      publisher,
      record,
      availability: record?.availability ?? "unavailable",
      observationPeriod: record?.observationPeriod.label ?? null,
      availabilityReason,
    };
  });
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#measure-library" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to measure library</a>
    <SectionNav sections={SECTIONS} />
    <main id="measure-library" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="mb-10 border-b-4 border-foreground bg-surface-warm p-5 md:p-8">
        <p className="eyebrow">Searchable public evidence</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.06em] md:text-7xl">Measure library</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">Search measures by topic, publisher, geography, frequency, unit or availability. Verified observations keep their source and revision context; unavailable entries explain why no value is shown.</p>
      </header>
      <MeasureLibrary measures={measures} initialSearch={initialSearch} />
    </main>
    <SiteFooter />
  </div>;
}
