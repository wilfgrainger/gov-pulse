import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRouteEnabled } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import DataExplorer from "@/app/components/DataExplorer";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { SECTIONS } from "@/app/lib/sections";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Explore UK public data | public-data.org",
  description:
    "Search UK economic, employment, public-finance, migration and NHS measures. Inspect published history, compare periods and download sourced data.",
  alternates: { canonical: "https://public-data.org/explore/" },
};
export default async function ExplorePage() {
  if (!publicationRouteEnabled("/explore/")) return <PublicationOffline />;
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
          <h1 className="font-display mt-2 text-balance text-4xl tracking-[-0.02em] md:text-5xl">
            Explore the numbers
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Search verified topic measures across prices, jobs, health, public finances and population.
            Inspect published history, sources, geography and gaps. The measure library gives
            catalog records a direct evidence page.
          </p>
          <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-4" href="/measure/">Browse the measure library →</Link>
        </header>
        <DataExplorer initialSnapshot={snapshot} />
      </main>
      <SiteFooter />
    </div>
  );
}
