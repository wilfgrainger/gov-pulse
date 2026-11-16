import type { Metadata } from "next";
import Link from "next/link";
import GovDataDirectory from "@/app/components/GovDataDirectory";
import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { DIRECTORY_OFFICIAL_COUNT, GOV_DATA_DIRECTORY } from "@/app/lib/govDataDirectory";
import { SECTIONS } from "@/app/lib/sections";

const title = "Find UK government data";
const description =
  "A plain-English index of where to find UK government data: national statistics, your local area, health, schools, crime, money, Parliament and how to ask for what is not published.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/find-data/" },
  openGraph: {
    title,
    description,
    type: "website",
    url: "/find-data/",
    images: [{ url: "/social/home.svg", width: 1200, height: 630, alt: "Find UK government data — public-data.org" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/social/home.svg"] },
};

export default function FindDataPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">
        Skip to page content
      </a>
      <div className="sticky top-0 z-50 bg-white">
        <SectionNav sections={SECTIONS} />
      </div>

      <main id="main-content" data-production-route="find-data">
        <PageHeader
          eyebrow="Directory"
          title="Find UK government data"
          subtitle={`${DIRECTORY_OFFICIAL_COUNT} official places to get UK public data — national, devolved and local — sorted by what you are trying to find out, plus your rights to ask for more.`}
          current="Find data"
          context={
            <p className="text-sm leading-6 text-[var(--muted)]">
              Links go straight to each publisher. We do not copy or re-host their data. Services marked{" "}
              <strong>independent tool</strong> are built by others from public data and are labelled separately.
            </p>
          }
        />

        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <section aria-labelledby="directory-heading">
            <h2 id="directory-heading" className="sr-only">Directory of government data sources</h2>
            <GovDataDirectory categories={GOV_DATA_DIRECTORY} />
          </section>

          <aside className="mt-14 border-t border-[var(--line-strong)] pt-6 text-sm leading-6 text-[var(--muted)]">
            <h2 className="font-display text-2xl text-[var(--foreground)]">Read before you reuse</h2>
            <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5">
              <li>Check the publisher&apos;s licence. Much government data is under the Open Government Licence, but not all of it.</li>
              <li>Check what period and geography a figure covers. England-only, Great Britain and UK figures are not interchangeable.</li>
              <li>Statistics are revised. Note the publication date of the version you use.</li>
              <li>
                For the figures public-data.org itself shows, with their periods and caveats, see{" "}
                <Link href="/sources/" prefetch={false} className="font-semibold underline underline-offset-4">sources and dates</Link>.
              </li>
            </ul>
            <p className="mt-4 text-xs">
              Spotted a broken link or a missing service? <Link href="/contact/" prefetch={false} className="underline underline-offset-4">Tell us</Link>.
            </p>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
