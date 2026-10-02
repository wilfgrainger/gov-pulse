import type { Metadata } from "next";
import CostOfLivingLens from "@/app/components/CostOfLivingLens";
import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";

export const metadata: Metadata = { title: "Cost-of-living lens", description: "Read official consumer prices, real pay and Bank Rate as separate measures, with source periods and limitations.", alternates: { canonical: "https://public-data.org/cost-of-living/" } };

export default async function CostOfLivingPage() {
  const snapshot = await readServerMetricsSnapshot();
  return <div className="min-h-screen bg-background text-foreground"><a href="#cost-of-living" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to cost-of-living evidence</a><SectionNav sections={SECTIONS}/><main id="cost-of-living"><PageHeader eyebrow="Prices · earnings · policy" title="Cost of living" subtitle="A guided view of public measures that describe prices, earnings and monetary policy. Their definitions and observation clocks remain separate." current="Economy"/><div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12"><CostOfLivingLens snapshot={snapshot}/></div></main><SiteFooter/></div>;
}
