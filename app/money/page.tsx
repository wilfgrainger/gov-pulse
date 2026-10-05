import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationEnabled } from "@/contracts/publication-policy";
import type { Metadata } from "next";
import PublicMoneyExplorer from "@/app/components/PublicMoneyExplorer";
import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";
import { isCurrentGovernmentContractsPayload } from "@/contracts/government-contracts";
import { sumContractExclusions, type PublicAward } from "@/app/lib/publicMoney";

export const metadata: Metadata = {
  robots: { index: publicationEnabled("governmentContracts"), follow: true },
  title: "Public money dossiers",
  description:
    "Inspect corrected government award notices and their disclosed value, buyer, supplier, revision and source links.",
};

export default async function PublicMoneyPage() {
  if (!publicationEnabled("governmentContracts")) {
    return <PublicationOffline title="Public money is temporarily unavailable" />;
  }

  const snapshot = await readServerMetricsSnapshot();
  const candidate = snapshot?.governmentContracts;
  const available = isCurrentGovernmentContractsPayload(candidate, new Date());
  const data = available
    ? (candidate as {
        awards: PublicAward[];
        caveats: string[];
        dataQuality: {
          validComparableAwards: number;
          excludedMissingValue?: number;
          excludedAmbiguousContractValue?: number;
          excludedNonGbp?: number;
          excludedMissingBuyer?: number;
          excludedMissingSupplier?: number;
          excludedMalformed?: number;
        };
        window: { label: string; basis: string };
      })
    : null;
  const excludedAwardCount = data ? sumContractExclusions(data.dataQuality) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#public-money" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">
        Skip to public-money dossiers
      </a>
      <SectionNav sections={SECTIONS} />
      <main id="public-money">
        <PageHeader
          eyebrow="Public procurement notices"
          title="Public money dossiers"
          subtitle="Search the published top-ranked Find a Tender notices, inspect disclosed values, and open source-linked buyer and supplier records."
          current="Public money"
        />
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12">
          {data ? (
            <>
              <p className="text-sm text-gray-700">
                Current complete window: {data.window.label}. Notices updated in this period, not money spent that
                week. {data.window.basis}
              </p>
              <PublicMoneyExplorer
                awards={data.awards}
                caveats={data.caveats}
                windowLabel={data.window.label}
                completeWindowComparableAwardCount={data.dataQuality.validComparableAwards}
                excludedAwardCount={excludedAwardCount}
              />
            </>
          ) : (
            <section role="status" className="border-l-4 border-accent bg-white p-6">
              <h2 className="text-xl font-bold">No complete current award universe is available</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">
                The explorer waits for a validated complete Find a Tender publication window with comparable GBP award
                notices. It does not build dossiers from a truncated ranking or stale notices.
              </p>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
