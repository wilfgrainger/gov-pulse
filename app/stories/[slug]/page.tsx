import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import StoryEvidence from "@/app/components/StoryEvidence";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";
import householdStory from "@/app/content/stories/household-budgets";
import financeStory from "@/app/content/stories/public-finances";

const stories = [householdStory, financeStory];
export function generateStaticParams() {
  return stories.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = stories.find((candidate) => candidate.slug === slug);
  return story ? { title: story.title, description: story.introduction, alternates: { canonical: `https://public-data.org/stories/${slug}/` } } : {};
}

export default async function GuidedStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = stories.find((candidate) => candidate.slug === slug);
  if (!story) notFound();
  const snapshot = await readServerMetricsSnapshot();
  return <div className="min-h-screen bg-background text-foreground"><a href="#story" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to story</a><SectionNav sections={SECTIONS}/><main id="story"><PageHeader eyebrow="Guided reading" title={story.title} subtitle={story.introduction} current="Stories"/><article className="evidence-article mx-auto my-8 max-w-4xl bg-white p-5 md:p-10">{story.sections.map((section) => <section key={section.heading} className="mb-8"><h2 className="text-2xl font-black">{section.heading}</h2><p className="mt-3 text-base leading-8 text-gray-700">{section.text}</p></section>)}<p className="border-t border-line pt-4 text-xs text-gray-600">Editorial owner: {story.owner}. The guide makes no numeric claim outside the cited observations below.</p></article><StoryEvidence measureIds={story.measureIds} catalog={snapshot?.meta.measureCatalog}/></main><SiteFooter/></div>;
}
