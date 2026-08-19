import PageHeader from "@/app/components/PageHeader";
import DataAutomationSummary from "@/app/components/DataAutomationSummary";
import PublicationLedger from "@/app/components/PublicationLedger";
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
        use: "Cross-country per-resident comparisons for debt, official development assistance, defence, public social expenditure, total health spending, tax revenue and debt interest. Each measure keeps its own observation year, evidence classification and real comparison denominator.",
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
        cadence: "Withdrawn",
        publishers: [
          { name: "Ipsos Political Monitor", url: "https://www.ipsos.com/en-uk/topic/political-monitor" },
          { name: "British Polling Council rules", url: "https://www.britishpollingcouncil.org/objects-and-rules/" },
        ],
      },
      {
        name: "Polarisation analysis",
        use: "No score is displayed because the former formula and poll-level inputs were not reproducible.",
        cadence: "Withdrawn",
        publishers: [{ name: "British Social Attitudes", url: "https://natcen.ac.uk/british-social-attitudes" }],
      },
      {
        name: "Crime in England and Wales",
        use: "No combined figure is displayed. Crime Survey estimates and police-recorded offences require separate official series.",
        cadence: "Withdrawn pending separate official series",
        publishers: [
          { name: "ONS crime and justice", url: "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice" },
          { name: "Home Office crime statistics", url: "https://www.gov.uk/government/collections/crime-statistics" },
        ],
      },
      {
        name: "UK regional comparison",
        use: "No map, ranking or value is displayed because the former layers lacked row-level evidence, standard geography codes and cross-nation comparability.",
        cadence: "Withdrawn pending comparable geographic evidence",
        publishers: [
          { name: "ONS geography", url: "https://www.ons.gov.uk/methodology/geography" },
          { name: "Electoral Commission results", url: "https://www.electoralcommission.org.uk/research-reports-and-data/election-results" },
        ],
      },
      {
        name: "Policy relationship analysis",
        use: "No coefficient or relationship strength is displayed because the former inputs, variables, weighting and calculation were not reproducible.",
        cadence: "Withdrawn pending a published reproducible method",
        publishers: [{ name: "British Social Attitudes", url: "https://natcen.ac.uk/british-social-attitudes" }],
      },
    ],
  },
] as const satisfies readonly SourceGroup[];

const evidenceRules = [
  {
    title: "Identity",
    text: "The publication, series, geography and unit must match the claim being displayed.",
  },
  {
    title: "Time",
    text: "Observation period, publication date and retrieval time remain separate fields.",
  },
  {
    title: "Integrity",
    text: "Incomplete, expired or incomparable evidence is unavailable rather than silently replaced.",
  },
] as const;

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

function SourceEntryCard({
  entry,
  gap = false,
  wide = false,
}: {
  entry: SourceEntry;
  gap?: boolean;
  wide?: boolean;
}) {
  return (
    <article
      className={`v3-source-card p-5 md:p-6 ${wide ? "md:col-span-2" : ""} ${
        gap ? "v3-source-card--gap bg-[#faf8f3] text-[#172234]" : "bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="max-w-xl text-xl font-semibold leading-tight tracking-[-0.02em]">{entry.name}</h3>
        <span
          className={`px-2.5 py-1 text-xs font-semibold ${
            gap ? "bg-rose-50 text-rose-900" : "bg-[#172234] text-white"
          }`}
        >
          {entry.cadence}
        </span>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-700">{entry.use}</p>
      <div className="mt-5 border-t border-[#ded8cd] pt-4">
        <p className="eyebrow text-gray-500">
          Original publication{entry.publishers.length > 1 ? "s" : ""}
        </p>
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
  const currentPublisherCount = new Set(
    currentGroups.flatMap((group) => group.entries.flatMap((entry) => entry.publishers.map((publisher) => publisher.url)))
  ).size;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50 bg-white">
        <SectionNav sections={SECTIONS} />
      </div>

      <main data-production-route="sources">
        <PageHeader
          eyebrow="Evidence register"
          title="Sources, dates and methods"
          subtitle="See which publications are current, when each was checked, how revisions are handled and which evidence remains deliberately unavailable."
          current="Sources and methods"
        >
          <aside>
            <p className="eyebrow">Evidence standard</p>
            <p className="mt-3 text-sm leading-6 text-gray-700">
              A release schedule is not proof of current data. Every displayed figure must also pass its source, observation-period and acceptable-age checks.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#d8d3c8] pt-4">
              <div>
                <dt className="text-xs text-gray-500">Current publisher routes</dt>
                <dd className="mt-1 text-2xl font-semibold">{currentPublisherCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Documented evidence gaps</dt>
                <dd className="mt-1 text-2xl font-semibold">{evidenceGaps.length}</dd>
              </div>
            </dl>
          </aside>
        </PageHeader>

        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-6 md:py-16">
          <section aria-labelledby="evidence-rules" className="border-y border-[#172234] bg-[#172234] p-6 text-white md:p-9">
            <div className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:items-start">
              <div>
                <p className="eyebrow eyebrow-on-dark">Publication gate</p>
                <h2 id="evidence-rules" className="font-display mt-3 text-3xl leading-tight md:text-4xl">
                  Evidence must pass all three checks.
                </h2>
              </div>
              <ol className="grid gap-px bg-white/20 md:grid-cols-3">
                {evidenceRules.map((rule, index) => (
                  <li key={rule.title} className="bg-[#172234] p-5">
                    <span className="text-xs font-semibold text-[#f6a5ad]">0{index + 1}</span>
                    <h3 className="mt-3 font-semibold text-white">{rule.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{rule.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="v3-evidence-article bg-white p-5 md:p-8 lg:p-10">
            <DataAutomationSummary />
          </section>

          <section
            aria-labelledby="active-publisher-directory"
            data-production-marker="current-publications"
            className="border-t border-[#c8c1b5] pt-8"
          >
            <div className="mb-7 grid gap-4 border-b border-[#d8d3c8] pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,36rem)] lg:items-end">
              <div>
                <p className="eyebrow mb-2">Original publications</p>
                <h2 id="active-publisher-directory" className="font-display text-3xl leading-tight md:text-5xl">
                  Active publisher directory
                </h2>
              </div>
              <p className="text-sm leading-6 text-gray-600">
                Links go to the publisher or current primary tables, not to an aggregator. Each evidence page provides the specific series and period used.
              </p>
            </div>

            <div className="space-y-8">
              {currentGroups.map((group) => (
                <section key={group.category} aria-labelledby={`source-group-${group.category.toLowerCase().replace(/\s+/g, "-")}`}>
                  <h3
                    id={`source-group-${group.category.toLowerCase().replace(/\s+/g, "-")}`}
                    className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                  >
                    {group.category}
                  </h3>
                  <div className="grid gap-px border border-[#d8d3c8] bg-[#d8d3c8] lg:grid-cols-2">
                    {group.entries.map((entry, index) => (
                      <SourceEntryCard
                        key={entry.name}
                        entry={entry}
                        wide={group.entries.length % 2 === 1 && index === group.entries.length - 1}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="evidence-gap-register"
            data-production-marker="evidence-gaps"
            className="border-y border-[#172234] bg-[#172234] p-5 text-white md:p-8 lg:p-10"
          >
            <div className="grid gap-5 border-b border-white/20 pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,36rem)] lg:items-end">
              <div>
                <p className="eyebrow eyebrow-on-dark mb-2">Evidence gaps</p>
                <h2 id="evidence-gap-register" className="font-display text-3xl leading-tight md:text-5xl">
                  What is not being published
                </h2>
              </div>
              <p className="text-sm leading-6 text-gray-300">
                These topics remain visible as editorial decisions, not as empty promises. They return only when the input data and method can be reproduced.
              </p>
            </div>
            <div className="mt-7 grid gap-px bg-white/20 md:grid-cols-2">
              {evidenceGaps.map((entry, index) => (
                <SourceEntryCard
                  key={entry.name}
                  entry={entry}
                  gap
                  wide={evidenceGaps.length % 2 === 1 && index === evidenceGaps.length - 1}
                />
              ))}
            </div>
          </section>

          <section className="v3-evidence-article bg-white p-5 md:p-8 lg:p-10">
            <PublicationLedger />
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
