import PageHeader from "@/app/components/PageHeader";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { SECTIONS } from "@/app/lib/sections";

type PublisherLink = {
  name: string;
  url: `https://${string}`;
};

type SourceEntry = {
  name: string;
  use: string;
  cadence: string;
  publishers: readonly PublisherLink[];
};

type SourceGroup = {
  category: string;
  kind: "current" | "gap";
  entries: readonly SourceEntry[];
};

export const SOURCE_GROUPS = [
  {
    category: "Politics and public opinion",
    kind: "current",
    entries: [
      {
        name: "Verified primary poll publications",
        use: "Individual Great Britain voting-intention publications. public-data.org does not calculate a synthetic polling average.",
        cadence: "As published; evidence expires after 14 days",
        publishers: [
          { name: "YouGov British politics", url: "https://yougov.com/en-gb/topics/topic/British_Politics" },
          { name: "British Polling Council rules", url: "https://www.britishpollingcouncil.org/objects-and-rules/" },
        ],
      },
      {
        name: "Oddschecker public politics markets",
        use: "Three named commercial markets with raw decimal odds and unnormalised reciprocal percentages. They appear only when the complete observation is inside its four-hour window.",
        cadence: "Checked every three hours; unavailable after four hours",
        publishers: [{ name: "Oddschecker politics", url: "https://www.oddschecker.com/politics" }],
      },
    ],
  },
  {
    category: "Economy and population",
    kind: "current",
    entries: [
      {
        name: "Office for National Statistics",
        use: "Monthly GDP, labour market, public-sector debt, central-government receipts, inflation, unemployment and long-term migration.",
        cadence: "Monthly or periodic, according to the named release",
        publishers: [{ name: "Office for National Statistics", url: "https://www.ons.gov.uk/" }],
      },
      {
        name: "Bank of England",
        use: "Official Bank Rate in the key economic indicators evidence.",
        cadence: "At Monetary Policy Committee decisions",
        publishers: [{ name: "Bank of England statistics", url: "https://www.bankofengland.co.uk/statistics" }],
      },
    ],
  },
  {
    category: "Public services",
    kind: "current",
    entries: [
      {
        name: "NHS England",
        use: "Monthly referral-to-treatment waiting-time publication. A&E, GP waits, workforce and life expectancy are not part of this measure.",
        cadence: "Monthly; evidence expires after 45 days",
        publishers: [{ name: "NHS England RTT statistics", url: "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/" }],
      },
    ],
  },
  {
    category: "International comparisons",
    kind: "current",
    entries: [
      {
        name: "UK in context comparison sources",
        use: "Cross-country per-resident comparisons for debt, official development assistance, defence, public social expenditure, total health spending, tax revenue and debt interest. Each measure keeps its own observation year and comparison coverage.",
        cadence: "Checked weekly; missing publisher coverage remains unavailable",
        publishers: [
          { name: "IMF DataMapper", url: "https://www.imf.org/external/datamapper/" },
          { name: "OECD Data Explorer", url: "https://data-explorer.oecd.org/" },
          { name: "SIPRI Military Expenditure Database", url: "https://www.sipri.org/databases/milex" },
          { name: "WHO Global Health Expenditure Database", url: "https://apps.who.int/nha/database" },
          { name: "World Bank World Development Indicators", url: "https://data.worldbank.org/" },
        ],
      },
    ],
  },
  {
    category: "Evidence gaps",
    kind: "gap",
    entries: [
      {
        name: "Prime-minister approval and government satisfaction",
        use: "No value is displayed until one consistent question and reproducible primary-poll series is available.",
        cadence: "Unavailable",
        publishers: [
          { name: "Ipsos Political Monitor", url: "https://www.ipsos.com/en-uk/topic/political-monitor" },
          { name: "British Polling Council rules", url: "https://www.britishpollingcouncil.org/objects-and-rules/" },
        ],
      },
      {
        name: "Polarisation analysis",
        use: "No score is displayed because the former formula and poll-level inputs were not reproducible.",
        cadence: "Unavailable",
        publishers: [{ name: "British Social Attitudes", url: "https://natcen.ac.uk/british-social-attitudes" }],
      },
      {
        name: "Crime in England and Wales",
        use: "No combined figure is displayed. Crime Survey estimates and police-recorded offences require separate official series.",
        cadence: "Separate measures only",
        publishers: [
          { name: "ONS crime and justice", url: "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice" },
          { name: "Home Office crime statistics", url: "https://www.gov.uk/government/collections/crime-statistics" },
        ],
      },
      {
        name: "UK regional comparison",
        use: "No map, ranking or value is displayed because the former layers lacked row-level evidence, standard geography codes and cross-nation comparability.",
        cadence: "Unavailable",
        publishers: [
          { name: "ONS geography", url: "https://www.ons.gov.uk/methodology/geography" },
          { name: "Electoral Commission results", url: "https://www.electoralcommission.org.uk/research-reports-and-data/election-results" },
        ],
      },
      {
        name: "Policy relationship analysis",
        use: "No coefficient or relationship strength is displayed because the former inputs, variables, weighting and calculation were not reproducible.",
        cadence: "Unavailable",
        publishers: [{ name: "British Social Attitudes", url: "https://natcen.ac.uk/british-social-attitudes" }],
      },
    ],
  },
] as const satisfies readonly SourceGroup[];

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
    <article className={`v3-source-card p-5 md:p-6 ${wide ? "md:col-span-2" : ""} ${gap ? "v3-source-card--gap bg-[#faf8f3] text-[#172234]" : "bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="max-w-xl text-xl font-semibold leading-tight tracking-[-0.02em]">{entry.name}</h3>
        <span className={`px-2.5 py-1 text-xs font-semibold ${gap ? "bg-rose-50 text-rose-900" : "bg-[#172234] text-white"}`}>
          {entry.cadence}
        </span>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-700">{entry.use}</p>
      <div className="mt-5 border-t border-[#ded8cd] pt-4">
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
          <section aria-labelledby="active-publisher-directory" data-production-marker="current-publications" className="border-t border-[#c8c1b5] pt-8">
            <div className="mb-7 grid gap-4 border-b border-[#d8d3c8] pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,36rem)] lg:items-end">
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
                  <div className="grid gap-px border border-[#d8d3c8] bg-[#d8d3c8] lg:grid-cols-2">
                    {group.entries.map((entry, index) => (
                      <SourceEntryCard key={entry.name} entry={entry} wide={group.entries.length % 2 === 1 && index === group.entries.length - 1} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section aria-labelledby="evidence-gap-register" data-production-marker="evidence-gaps" className="border-y border-[#172234] bg-[#172234] p-5 text-white md:p-8 lg:p-10">
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
