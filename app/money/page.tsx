import type { Metadata } from "next";
import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { SECTIONS } from "@/app/lib/sections";

export const metadata: Metadata = {
  title: "Public money temporarily unavailable",
  description: "Public-money pages have been taken offline while the procurement data is reverified.",
  robots: { index: false, follow: true },
};

export default function PublicMoneyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#public-money" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to public-money notice</a>
      <SectionNav sections={SECTIONS} />
      <main id="public-money">
        <PageHeader
          eyebrow="Publication notice"
          title="Public money is temporarily unavailable"
          subtitle="We have taken the public-money dossiers and government-contracts pages offline while we reverify the data. They will return once the data has been reverified."
          current="Public money"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
