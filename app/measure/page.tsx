import type { Metadata } from "next";
import MeasureLibrary from "@/app/components/MeasureLibrary";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { availableMeasures } from "@/app/lib/measureCatalog";
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
  const measures = availableMeasures(catalog, new Date());
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#measure-library" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to measure library</a>
    <SectionNav sections={SECTIONS} />
    <main id="measure-library" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="mb-10 border-b-4 border-foreground bg-surface-warm p-5 md:p-8">
        <p className="eyebrow">Searchable public evidence</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.06em] md:text-7xl">Measure library</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">Each record keeps its source, observation period, definition, geography and validity together. Only measures that pass the current catalog contract appear here.</p>
      </header>
      {measures.length ? <MeasureLibrary measures={measures} /> : <section role="status" className="border-l-4 border-accent bg-white p-6"><h2 className="text-xl font-bold">No validated measure catalog is available</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-700">This edition does not include current catalog records. The library will fill when a valid publication is available; no measures are inferred from display cards.</p></section>}
    </main>
    <SiteFooter />
  </div>;
}
