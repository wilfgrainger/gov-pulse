import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRouteEnabled } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import DataExplorer from "@/app/components/DataExplorer";
import PlaceLookup from "@/app/components/PlaceLookup";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { SECTIONS } from "@/app/lib/sections";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Look up UK public data | public-data.org",
  description:
    "Look up a published geography, search verified measures, and open buyer or supplier dossiers. Inspect history, sources and gaps without invented local figures.",
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
          <p className="eyebrow">Look up</p>
          <h1 className="font-display mt-2 text-balance text-4xl tracking-[-0.02em] md:text-5xl">
            Look up a place or a measure
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Start with a published geography, then search verified measures across prices, jobs, health, public finances and population.
            Inspect history, sources and gaps. Buyer and supplier dossiers live under Public money.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            <Link className="inline-flex min-h-11 items-center text-accent underline underline-offset-4" href="/measure/">Measure library →</Link>
            <Link className="inline-flex min-h-11 items-center text-accent underline underline-offset-4" href="/money/">Public money dossiers →</Link>
          </div>
        </header>
        <PlaceLookup />
        <DataExplorer initialSnapshot={snapshot} />
      </main>
      <SiteFooter />
    </div>
  );
}
