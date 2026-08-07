import Link from "next/link";
import HomepageIntro from "./components/HomepageIntro";
import NationalEvidenceEdition from "./components/NationalEvidenceEdition";
import SectionNav from "./components/SectionNav";
import SiteFooter from "./components/SiteFooter";
import SocialShare from "./components/SocialShare";
import { selectNationalEvidenceEdition } from "./lib/nationalEvidence";
import { readServerMetricsSnapshot } from "./lib/serverMetricsSnapshot";
import { SECTIONS } from "./lib/sections";

const trustPrinciples = [
  {
    title: "Primary evidence",
    text: "Important figures link back to the original publisher or named official series, not an unattributed aggregator.",
  },
  {
    title: "Separate clocks",
    text: "Observation period, publication date and retrieval time remain distinct so a recent check cannot make old evidence look new.",
  },
  {
    title: "Honest gaps",
    text: "When identity, completeness or comparability cannot be proved, the value is withdrawn rather than estimated or quietly replaced.",
  },
] as const;

export default async function Home() {
  const snapshot = await readServerMetricsSnapshot();
  const initialEdition = selectNationalEvidenceEdition(snapshot);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#national-signals" className="sr-only z-[100] bg-black px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to the latest evidence
      </a>

      <div className="sticky top-0 z-50 bg-white">
        <SectionNav sections={SECTIONS} />
      </div>

      <main id="main-content">
        <HomepageIntro />
        <NationalEvidenceEdition initialEdition={initialEdition} />

        <div className="mx-auto max-w-7xl px-4 pb-12 md:px-6 md:pb-16">
          <section aria-labelledby="trust-public-data" className="border-y border-[#172234] bg-[#fffdf8]">
            <div className="grid gap-8 p-6 md:p-9 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:p-12">
              <div>
                <p className="eyebrow">Why trust the edition?</p>
                <h2 id="trust-public-data" className="font-display mt-3 text-4xl leading-[0.98] md:text-5xl">
                  Inspect the claim, not our confidence.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-gray-700">
                  public-data.org is designed to make disagreement easier to investigate. The evidence class, dates, definition and source remain visible beside the public claim.
                </p>
                <Link href="/sources" prefetch={false} className="v3-primary-action mt-7">
                  Open the evidence register
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              <ol className="grid gap-px border border-[#d8d3c8] bg-[#d8d3c8] sm:grid-cols-3">
                {trustPrinciples.map((principle, index) => (
                  <li key={principle.title} className="bg-white p-5 md:p-6">
                    <span className="text-xs font-semibold text-accent">0{index + 1}</span>
                    <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em]">{principle.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-gray-600">{principle.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <div className="my-8 border-b border-black/15 pb-8">
            <SocialShare />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
