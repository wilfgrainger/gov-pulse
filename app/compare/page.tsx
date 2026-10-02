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
  const snapshot = await readServerMetricsSnapshot();
  const catalog = snapshot?.meta.measureCatalog as MeasureCatalog | undefined;
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
  let initial = null;
  let problem: string | null = null;
  if (catalog) {
    try { initial = parseWorkspace(query.toString(), catalog); }
    catch (error) { problem = error instanceof Error ? error.message : "Invalid comparison workspace."; }
  }
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#comparison-studio" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to comparison studio</a>
    <SectionNav sections={SECTIONS} />
    <main id="comparison-studio" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="mb-8 border-b-4 border-foreground bg-surface-warm p-5 md:p-8">
        <p className="eyebrow">Independent comparisons</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.06em] md:text-7xl">Comparison studio</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">Select up to four measures. Different definitions stay in separate panels. Overlays are available only when unit, basis, geography, evidence class, cadence and comparison family match.</p>
      </header>
      {catalog ? <ComparisonStudio measures={availableMeasures(catalog)} initial={initial} initialError={problem} /> : <p role="status" className="border-l-4 border-accent bg-white p-6">No validated measure catalog is available for comparison.</p>}
    </main>
    <SiteFooter />
  </div>;
}
