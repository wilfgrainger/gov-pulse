import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import Reveal from "../../components/Reveal";
import SectionNav from "../../components/SectionNav";
import SiteFooter from "../../components/SiteFooter";
import {
  SECTION_DISCOVERY,
  sectionPath,
  serializeJsonLd,
  socialImagePath,
  structuredDataForSection,
} from "../../lib/discovery";
import { SECTIONS } from "../../lib/sections";
import { SECTION_CONTENT } from "../../lib/sectionContent";
import { readServerMetricsSnapshot } from "../../lib/serverMetricsSnapshot";
import { sectionDistribution } from "../../lib/sectionDownloads";
import { filterCurrentSnapshot } from "@/worker/publication-currentness";
import type { MetricsSnapshot } from "../../lib/metricsSnapshot";

export function generateStaticParams() {
  return Object.keys(SECTION_CONTENT).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const discovery = SECTION_DISCOVERY[id];
  if (!discovery) return {};

  const canonical = sectionPath(id);
  const image = socialImagePath(id);

  return {
    title: discovery.title,
    description: discovery.description,
    alternates: {
      canonical,
      types: { "application/rss+xml": "/feed.xml" },
    },
    openGraph: {
      title: discovery.title,
      description: discovery.description,
      type: discovery.kind === "tool" ? "website" : "article",
      url: canonical,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${discovery.title} — public-data.org`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: discovery.title,
      description: discovery.description,
      images: [image],
    },
  };
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const section = SECTION_CONTENT[id as keyof typeof SECTION_CONTENT];

  if (!section) notFound();

  const SectionComponent = section.component;
  const structuredData = structuredDataForSection(id);
  const dataSection = "dataSection" in section ? section.dataSection : null;
  const snapshot = dataSection ? await readServerMetricsSnapshot() : null;
  const current = snapshot && filterCurrentSnapshot(snapshot, new Date()) as MetricsSnapshot | null;
  const hasDownload = Boolean(dataSection && current && sectionDistribution(current, dataSection));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        />
      ) : null}
      <div className="sticky top-0 z-50 bg-white">
        <SectionNav sections={SECTIONS} />
      </div>

      <main>
        <PageHeader
          eyebrow={section.tag}
          title={section.title}
          subtitle={section.subtitle}
          current={section.category}
          context={id === "election-polls" ? (
            <aside aria-label="Polling evidence guide" className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3">
              <p className="row-span-2 text-5xl font-black leading-none tracking-[-0.07em] text-accent">14</p>
              <p className="eyebrow self-end">Day publication window</p>
              <p className="text-sm leading-6 text-gray-700">The source issue date controls freshness; fieldwork dates stay separate.</p>
              <Link href="/sources/" className="col-span-2 min-h-11 inline-flex items-center font-semibold underline underline-offset-4 hover:text-accent">Publisher links and methods <span aria-hidden="true" className="ml-2">→</span></Link>
            </aside>
          ) : undefined}
        />
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
          <Reveal as="article" className="evidence-article v3-evidence-article p-5 md:p-8 lg:p-12">
            <h2 className="sr-only">{section.title}: latest evidence and sources</h2>
            <SectionComponent />
          </Reveal>
          {dataSection ? (
            <aside
              aria-label={`${section.title} data downloads`}
              className="evidence-downloads mt-8 grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:p-5"
            >
              <div>
                <p className="eyebrow">Verified edition downloads</p>
                <p className="mt-2 text-sm leading-6 text-gray-700">
                  {hasDownload
                    ? "Source metadata, observation and publication dates, geography, attribution and licence are included with this current edition."
                    : "A download will appear when this section has current verified evidence."}
                </p>
              </div>
              {hasDownload && <div className="flex flex-wrap gap-2">
                <a href={`/data/sections/${dataSection}.json`} className="v3-secondary-action" download>
                  Download JSON
                </a>
                <a href={`/data/sections/${dataSection}.csv`} className="v3-secondary-action" download>
                  Download CSV
                </a>
              </div>}
            </aside>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
