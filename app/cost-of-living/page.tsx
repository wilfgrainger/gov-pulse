import type { Metadata } from "next";
import CostOfLivingLens from "@/app/components/CostOfLivingLens";
import EvidenceHoldNotice from "@/app/components/EvidenceHoldNotice";
import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";
import { publicationEnabled } from "@/contracts/publication-policy";

export const metadata: Metadata = { title: "Cost-of-living lens", description: "Compare official prices, private rents, house prices, real pay and Bank Rate while keeping definitions and observation periods clear.", alternates: { canonical: "https://public-data.org/cost-of-living/" } };

export default async function CostOfLivingPage() {
  const snapshot = await readServerMetricsSnapshot();
  const allSourcesHeld = !["sentimentPulse", "housePriceIndex", "realWages"].some((id) => publicationEnabled(id));
  return <div className="min-h-screen bg-background text-foreground"><a href="#cost-of-living" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to cost-of-living evidence</a><SectionNav sections={SECTIONS}/><main id="cost-of-living"><PageHeader eyebrow="Prices · renting · buying · earnings · policy" title="Cost of living" subtitle="Read official measures of consumer prices, rent, house prices, earnings and monetary policy together. Their definitions, populations and observation periods stay visible; no personal cost score is inferred." current="Economy"/><div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12">{allSourcesHeld ? <EvidenceHoldNotice id="cost-of-living-publication-held">The price, rent, housing, earnings and policy-rate evidence used by this lens is held from publication. The page keeps definitions separate and shows no household score or unpublished values.</EvidenceHoldNotice> : null}<CostOfLivingLens snapshot={snapshot}/></div></main><SiteFooter/></div>;
}
