import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRouteEnabled } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import ComparisonStudio from "@/app/components/ComparisonStudio";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";
import { availableMeasures } from "@/app/lib/measureCatalog";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";
import { parseWorkspace } from "@/app/lib/comparisonWorkspace";

export const metadata: Metadata = { title: "Comparison studio", description: "Compare published public measures over the same date window, with source-aware charts and portable citations." };

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
        <p className="eyebrow">Independent comparisons</p>
        <h1 className="page-title comparison-page-title mt-2">Compare public measures.</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">Start with the available evidence. Different definitions stay in separate panels; shared axes are used only where the source definitions and observation bases match.</p>
        <a href="#comparison-controls" className="v3-secondary-action mt-4">Adjust this comparison <span aria-hidden="true">↓</span></a>
      </header>
      {catalog ? <ComparisonStudio catalog={catalog} measures={availableMeasures(catalog)} initial={initial} initialError={problem} /> : <p role="status" className="border-l-4 border-accent bg-white p-6">No validated measure catalog is available for comparison.</p>}
    </main>
    <SiteFooter />
  </div>;
}
