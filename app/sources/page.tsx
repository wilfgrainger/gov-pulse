import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { SECTIONS } from "@/app/lib/sections";

import { SOURCE_GROUPS, type PublisherLink, type SourceEntry } from "@/app/lib/sourceGroups";

function PublisherAnchor({ publisher }: { publisher: PublisherLink }) {
  return (
    <a
      href={publisher.url}
      target="_blank"
      rel="noreferrer"
      className="font-semibold underline decoration-black/25 underline-offset-4 hover:text-accent focus-visible:text-accent"
      aria-label={`Open ${publisher.name} publisher website`}
    >
      {publisher.name} <span aria-hidden="true">↗</span>
    </a>
  );
}

function SourceEntryCard({ entry, gap = false, wide = false }: { entry: SourceEntry; gap?: boolean; wide?: boolean }) {
  return (
    <article className={`v3-source-card p-5 md:p-6 ${wide ? "md:col-span-2" : ""} ${gap ? "v3-source-card--gap bg-[#f7f9fb] text-[#14243b]" : "bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="max-w-xl text-xl font-semibold leading-tight tracking-[-0.02em]">{entry.name}</h3>
        <span className={`px-2.5 py-1 text-xs font-semibold ${gap ? "bg-rose-50 text-rose-900" : "bg-[#14243b] text-white"}`}>
          {entry.cadence}
        </span>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-700">{entry.use}</p>
      <div className="mt-5 border-t border-[#d3dae1] pt-4">
        <p className="eyebrow text-gray-500">Original publication{entry.publishers.length > 1 ? "s" : ""}</p>
        <ul className="mt-2 space-y-2 text-sm">
          {entry.publishers.map((publisher) => (
            <li key={publisher.url}>
              <PublisherAnchor publisher={publisher} />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function SourcesPage() {
  const currentGroups = SOURCE_GROUPS.filter((group) => group.kind === "current");
  const evidenceGaps = SOURCE_GROUPS.find((group) => group.kind === "gap")?.entries ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50 bg-white">
        <SectionNav sections={SECTIONS} />
      </div>

      <main data-production-route="sources">
        <PageHeader
          eyebrow="Sources"
          title="Sources and dates"
          subtitle="Original publishers, publication notes and honest gaps for the evidence shown on public-data.org."
          current="Sources"
        />

        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-6 md:py-16">
          <section aria-labelledby="active-publisher-directory" data-production-marker="current-publications" className="border-t border-[#aab4bf] pt-8">
            <div className="mb-7 grid gap-4 border-b border-[#d3dae1] pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,36rem)] lg:items-end">
              <div>
                <p className="eyebrow mb-2">Original publications</p>
                <h2 id="active-publisher-directory" className="font-display text-3xl leading-tight md:text-5xl">Publisher directory</h2>
              </div>
              <p className="text-sm leading-6 text-gray-600">
                Links go to the publisher website or primary tables. Each evidence page shows the specific figure, period and caveat used.
              </p>
            </div>

            <div className="space-y-8">
              {currentGroups.map((group) => (
                <section key={group.category} aria-labelledby={`source-group-${group.category.toLowerCase().replace(/\s+/g, "-")}`}>
                  <h3 id={`source-group-${group.category.toLowerCase().replace(/\s+/g, "-")}`} className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {group.category}
                  </h3>
                  <div className="grid gap-px border border-[#d3dae1] bg-[#d3dae1] lg:grid-cols-2">
                    {group.entries.map((entry, index) => (
                      <SourceEntryCard key={entry.name} entry={entry} wide={group.entries.length % 2 === 1 && index === group.entries.length - 1} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section aria-labelledby="evidence-gap-register" data-production-marker="evidence-gaps" className="border-y border-[#14243b] bg-[#14243b] p-5 text-white md:p-8 lg:p-10">
            <div className="grid gap-5 border-b border-white/20 pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,36rem)] lg:items-end">
              <div>
                <p className="eyebrow eyebrow-on-dark mb-2">Unavailable evidence</p>
                <h2 id="evidence-gap-register" className="font-display text-3xl leading-tight md:text-5xl">What we are not showing</h2>
              </div>
              <p className="text-sm leading-6 text-gray-300">
                These figures stay unavailable when the source or comparison cannot support the claim clearly enough.
              </p>
            </div>
            <div className="mt-7 grid gap-px bg-white/20 md:grid-cols-2">
              {evidenceGaps.map((entry, index) => (
                <SourceEntryCard key={entry.name} entry={entry} gap wide={evidenceGaps.length % 2 === 1 && index === evidenceGaps.length - 1} />
              ))}
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
