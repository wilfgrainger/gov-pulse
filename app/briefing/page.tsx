import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRoutePublished } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import Link from "next/link";
import BriefingEdition from "@/app/components/BriefingEdition";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";

export const metadata: Metadata = {
  title: "Latest public-data briefing",
  description: "A dated account of accepted observations, historical revisions, method changes and the sources behind the latest UK public-data edition.",
  alternates: { canonical: "https://public-data.org/briefing/" },
};

export default async function BriefingPage() {
  if (!publicationRoutePublished("/briefing/")) return <PublicationOffline />;
  const snapshot = await readServerMetricsSnapshot();
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#briefing" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to latest briefing</a>
    <SectionNav sections={SECTIONS}/>
    <main id="briefing" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="mb-8 border-b-4 border-foreground bg-surface-warm p-5 md:p-8"><p className="eyebrow">A dated public-data edition</p><h1 className="mt-2 text-5xl font-black tracking-[-0.06em] md:text-7xl">The briefing</h1><p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">A record of new observations, revisions and method changes from the accepted publication. Every figure links back to its measure and publisher record.</p></header>
      <BriefingEdition snapshot={snapshot}/>
      <section aria-labelledby="guided-stories" className="mt-12 border-t-2 border-foreground pt-6"><p className="eyebrow">Read the data by subject</p><h2 id="guided-stories" className="mt-2 text-3xl font-black">Guided stories</h2><ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2"><li><Link className="block min-h-32 border border-line-strong bg-white p-5 hover:bg-surface-warm" href="/stories/household-budgets/"><span className="eyebrow">Prices and pay</span><span className="mt-2 block text-xl font-bold">How to read the household pressure signals →</span></Link></li><li><Link className="block min-h-32 border border-line-strong bg-white p-5 hover:bg-surface-warm" href="/stories/public-finances/"><span className="eyebrow">Public finances</span><span className="mt-2 block text-xl font-bold">Debt, receipts and economic output →</span></Link></li></ul></section>
    </main><SiteFooter/>
  </div>;
}
