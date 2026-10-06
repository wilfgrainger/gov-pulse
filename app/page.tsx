import PublicationOffline from "@/app/components/PublicationOffline";
import { publicationRoutePublished } from "@/contracts/publication-policy";
import HomepageIntro from "./components/HomepageIntro";
import NationalEvidenceEdition from "./components/NationalEvidenceEdition";
import SectionNav from "./components/SectionNav";
import SiteFooter from "./components/SiteFooter";
import SocialShare from "./components/SocialShare";
import { selectNationalEvidenceEdition } from "./lib/nationalEvidence";
import { readServerMetricsSnapshot } from "./lib/serverMetricsSnapshot";
import { SECTIONS } from "./lib/sections";

export default async function Home() {
  if (!publicationRoutePublished("/")) return <PublicationOffline />;
  const snapshot = await readServerMetricsSnapshot();
  const initialEdition = selectNationalEvidenceEdition(snapshot);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#national-signals" className="sr-only z-[100] bg-[var(--accent)] px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to the latest evidence
      </a>

      <div className="premium-sticky-chrome sticky top-0 z-50">
        <SectionNav sections={SECTIONS} />
      </div>

      <main id="main-content">
        <HomepageIntro />
        <NationalEvidenceEdition initialEdition={initialEdition} />

        <div className="mx-auto max-w-7xl px-4 pb-12 md:px-6 md:pb-16">
          <div className="my-8 border-b border-[var(--line)] pb-8">
            <SocialShare />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
