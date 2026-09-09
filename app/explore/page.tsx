import type { Metadata } from "next";
import DataExplorer from "@/app/components/DataExplorer";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { SECTIONS } from "@/app/lib/sections";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";

export const metadata: Metadata = {
  title: "Explore UK public data | public-data.org",
  description:
    "Search UK economic, employment, public-finance, migration and NHS measures. Inspect published history, compare periods and download sourced data.",
  alternates: { canonical: "https://public-data.org/explore/" },
};
export default async function ExplorePage() {
  const snapshot = await readServerMetricsSnapshot();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#explore-content"
        className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4"
      >
        Skip to data explorer
      </a>
      <SectionNav sections={SECTIONS} />
      <main
        id="explore-content"
        className="mx-auto max-w-7xl px-4 py-8 md:px-6"
      >
        <header className="mb-6">
          <p className="eyebrow">UK public data</p>
          <h1 className="font-display mt-2 text-4xl md:text-5xl">
            Explore the numbers
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Find a measure, inspect its history and compare published periods.
            Each figure keeps its own source, date and geography.
          </p>
        </header>
        <DataExplorer initialSnapshot={snapshot} />
      </main>
      <SiteFooter />
    </div>
  );
}
