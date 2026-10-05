import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRouteEnabled } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import ComparisonStudio from "@/app/components/ComparisonStudio";
import OneIndicatorCompare from "@/app/components/OneIndicatorCompare";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";
import { availableMeasures } from "@/app/lib/measureCatalog";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";
import { parseWorkspace } from "@/app/lib/comparisonWorkspace";

export const metadata: Metadata = { title: "Compare UK public measures | public-data.org", description: "Compare one published indicator at a time. Overlay only when definitions match. Country peers stay unavailable while UK-in-context is offline." };

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!publicationRouteEnabled("/compare/")) return <PublicationOffline />;
  const snapshot = await readServerMetricsSnapshot();
  const catalog = snapshot?.meta.measureCatalog as MeasureCatalog | undefined;
  const params = process.env.STATIC_EXPORT === "true" ? {} : await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const entry of Array.isArray(value) ? value : typeof value === "string" ? [value] : []) {
      query.append(key, entry);
    }
  }
  let initial = null;
  let problem: string | null = null;
  if (catalog && process.env.STATIC_EXPORT !== "true") {
    try { initial = parseWorkspace(query.toString(), catalog); }
    catch (error) { problem = error instanceof Error ? error.message : "Invalid comparison workspace."; }
  }
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#comparison-studio" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to comparison studio</a>
    <SectionNav sections={SECTIONS} />
    <main id="comparison-studio" className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <header className="v3-page-header mb-7 border-b-2 border-foreground p-5 md:p-8">
        <p className="eyebrow">Compare</p>
        <h1 className="page-title comparison-page-title mt-2">Compare one indicator.</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">Start with a single published measure. Overlay a second series only when the definition, unit, cadence and geography match. Country peers stay unavailable while UK-in-context is offline.</p>
        <a href="#one-indicator-heading" className="v3-secondary-action mt-4">Choose an indicator <span aria-hidden="true">↓</span></a>
      </header>
      <OneIndicatorCompare catalog={catalog ?? null} />
      {catalog ? <ComparisonStudio catalog={catalog} measures={availableMeasures(catalog)} initial={initial} initialError={problem} /> : <p role="status" className="border-l-4 border-accent bg-white p-6">No validated measure catalog is available for comparison.</p>}
    </main>
    <SiteFooter />
  </div>;
}
