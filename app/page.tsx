import HomepageIntro from "./components/HomepageIntro";
import NationalEvidenceEdition from "./components/NationalEvidenceEdition";
import SectionNav from "./components/SectionNav";
import SiteFooter from "./components/SiteFooter";
import SocialShare from "./components/SocialShare";
import { selectNationalEvidenceEdition } from "./lib/nationalEvidence";
import { readServerMetricsSnapshot } from "./lib/serverMetricsSnapshot";
import { SECTIONS } from "./lib/sections";

export default async function Home() {
  const snapshot = await readServerMetricsSnapshot();
  const initialEdition = selectNationalEvidenceEdition(snapshot);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50 bg-white">
        <SectionNav sections={SECTIONS} />
      </div>

      <main id="main-content" tabIndex={-1}>
        <HomepageIntro />
        <NationalEvidenceEdition initialEdition={initialEdition} />

        <div className="mx-auto max-w-7xl px-4 pb-12 md:px-6 md:pb-16">
          <div className="my-8 border-b border-black/15 pb-8">
            <SocialShare />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
