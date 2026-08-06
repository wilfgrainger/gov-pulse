import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "../../components/PageHeader";
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
        />
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-14">
          {dataSection ? (
            <aside
              aria-label={`${section.title} data downloads`}
              className="evidence-downloads mb-6 grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:p-5"
            >
              <div>
                <p className="eyebrow">Verified edition downloads</p>
                <p className="mt-2 text-sm leading-6 text-gray-700">
                  Source metadata, observation and publication dates, attribution and licence are included with the current static edition.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/data/sections/${dataSection}.json`}
                  className="v3-secondary-action"
                  download
                >
                  Download JSON
                </a>
                <a
                  href={`/data/sections/${dataSection}.csv`}
                  className="v3-secondary-action"
                  download
                >
                  Download CSV
                </a>
              </div>
            </aside>
          ) : null}
          <article className="evidence-article v3-evidence-article p-5 md:p-8 lg:p-12">
            <h2 className="sr-only">{section.title}: latest evidence and sources</h2>
            <SectionComponent />
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
