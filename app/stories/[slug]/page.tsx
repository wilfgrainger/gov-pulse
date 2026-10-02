import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { availableMeasures } from "@/app/lib/measureCatalog";
import { SECTIONS } from "@/app/lib/sections";
import householdStory from "@/app/content/stories/household-budgets";
import financeStory from "@/app/content/stories/public-finances";

const stories = [householdStory, financeStory];
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
  const measures = availableMeasures(snapshot?.meta.measureCatalog);
  const storyMeasures = story.measureIds.map((id) => measures.find((measure) => measure.id === id)).filter((measure) => measure !== undefined);
  return <div className="min-h-screen bg-background text-foreground"><a href="#story" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Skip to story</a><SectionNav sections={SECTIONS}/><main id="story"><PageHeader eyebrow="Guided reading" title={story.title} subtitle={story.introduction} current="Stories"/><article className="evidence-article mx-auto my-8 max-w-4xl bg-white p-5 md:p-10">{story.sections.map((section) => <section key={section.heading} className="mb-8"><h2 className="text-2xl font-black">{section.heading}</h2><p className="mt-3 text-base leading-8 text-gray-700">{section.text}</p></section>)}<p className="border-t border-line pt-4 text-xs text-gray-600">Editorial owner: {story.owner}. This guide contains no unsourced numerical claims.</p></article><section className="mx-auto max-w-7xl px-4 pb-10 md:px-6"><h2 className="text-2xl font-black">Referenced measures in the accepted edition</h2>{storyMeasures.length ? <ul className="mt-4 grid list-none gap-px border border-line-strong bg-line-strong p-0 sm:grid-cols-2 lg:grid-cols-3">{storyMeasures.map((measure) => <li key={measure.id} className="bg-white p-5"><p className="font-bold">{measure.label}</p><p className="mt-2 text-2xl font-black">{measure.value === null ? "Unavailable" : `${measure.value} ${measure.unit}`}</p><p className="mt-2 text-xs text-gray-600">{measure.observationPeriod.label} · {measure.sourceEditionId}</p><Link className="mt-3 inline-block text-sm font-semibold underline" href={`/measure/${encodeURIComponent(measure.id)}/`}>Inspect source and history →</Link></li>)}</ul> : <p role="status" className="mt-4 border-l-4 border-accent bg-white p-5 text-sm">The referenced catalog measures are unavailable in this edition; the story remains a guide to definitions only.</p>}</section></main><SiteFooter/></div>;
}
