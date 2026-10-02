import type { Metadata } from "next";
import MeasureLibrary from "@/app/components/MeasureLibrary";
import type { MeasureLibraryItem } from "@/app/components/MeasureLibrary";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { measureForDisplay } from "@/app/lib/measureCatalog";
import { MEASURES } from "@/app/lib/measureDefinitions";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";

export const metadata: Metadata = {
  title: "Measure library",
  description: "Browse public measures with their definitions, observations, source editions, caveats and publication dates.",
  alternates: { canonical: "https://public-data.org/measure/" },
};

export default async function MeasureIndexPage() {
  const snapshot = await readServerMetricsSnapshot();
  const catalog = snapshot?.meta.measureCatalog;
  const now = new Date();
  const measures: MeasureLibraryItem[] = MEASURES.map((definition) => {
    const record = measureForDisplay(catalog, definition.id, now);
    const source = snapshot?.meta.sources[definition.section];
    const provenance = source && typeof source === "object"
      ? (source as { provenance?: { upstreams?: { publisher?: string }[] } }).provenance
      : undefined;
    const publisher = provenance?.upstreams?.map((upstream) => upstream.publisher).find(Boolean) ?? "Publisher not identified";
    const status = source && typeof source === "object" ? (source as { status?: string }).status : undefined;
    const availabilityReason = record?.availability === "historical"
      ? `This verified publication is outside its current validity window${record.validUntil ? ` (valid through ${record.validUntil.slice(0, 10)})` : ""}.`
      : record ? null
        : !snapshot ? "No current national evidence edition is available."
          : status === "error" || !source ? "The source section is unavailable in this edition."
            : "No record passed the source, period and history checks for this edition.";
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
      <MeasureLibrary measures={measures} />
    </main>
    <SiteFooter />
  </div>;
}
