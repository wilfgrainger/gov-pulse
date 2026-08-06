type LedgerEntry = {
  id: string;
  signal: string;
  publisher: string;
  cadence: string;
  calendarUrl: `https://${string}`;
  revisionPolicy: string;
  readiness: "Release calendar" | "Publisher schedule";
};

export const PUBLICATION_LEDGER = [
  {
    id: "gdp",
    signal: "GDP and national accounts",
    publisher: "Office for National Statistics",
    cadence: "Monthly estimate and quarterly national accounts",
    calendarUrl: "https://www.ons.gov.uk/releasecalendar",
    revisionPolicy: "Retain the publication period and identify revised observations rather than silently replacing history.",
    readiness: "Release calendar",
  },
  {
    id: "prices-jobs",
    signal: "Prices and labour market",
    publisher: "Office for National Statistics",
    cadence: "Monthly, on separate release schedules",
    calendarUrl: "https://www.ons.gov.uk/releasecalendar",
    revisionPolicy: "Keep CPI and labour releases distinct and show revisions or methodological breaks at the point of use.",
    readiness: "Release calendar",
  },
  {
    id: "public-finances",
    signal: "Public finances, receipts and national debt",
    publisher: "Office for National Statistics",
    cadence: "Monthly public-sector-finances release",
    calendarUrl: "https://www.ons.gov.uk/releasecalendar",
    revisionPolicy: "Store dated published observations and expose later revisions; never simulate a continuously changing debt total.",
    readiness: "Release calendar",
  },
  {
    id: "bank-rate",
    signal: "Bank Rate",
    publisher: "Bank of England",
    cadence: "At scheduled Monetary Policy Committee decisions",
    calendarUrl: "https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates",
    revisionPolicy: "Decision records are immutable; corrections must be recorded separately from the original decision date.",
    readiness: "Release calendar",
  },
  {
    id: "election-polling",
    signal: "Election polling",
    publisher: "British Polling Council member primary publications",
    cadence: "As published",
    calendarUrl: "https://www.britishpollingcouncil.org/objects-and-rules/",
    revisionPolicy: "Retain each poll separately with fieldwork, sample, question and direct tables; expire the latest accepted publication after 14 days and never synthesize an undocumented average.",
    readiness: "Publisher schedule",
  },
  {
    id: "betting-markets",
    signal: "Political betting markets",
    publisher: "Oddschecker public politics markets",
    cadence: "Checked every three hours",
    calendarUrl: "https://www.oddschecker.com/politics",
    revisionPolicy: "Retain the raw decimal odds and observation time, display unnormalised reciprocal percentages, and withdraw all three markets after four hours.",
    readiness: "Publisher schedule",
  },
  {
    id: "nhs-rtt",
    signal: "NHS referral-to-treatment waiting times",
    publisher: "NHS England",
    cadence: "Monthly RTT statistical press notice",
    calendarUrl: "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
    revisionPolicy: "Treat provider revisions and missing-trust estimates as part of the named RTT release; do not mix A&E, GP, workforce or life-expectancy series into it.",
    readiness: "Publisher schedule",
  },
  {
    id: "migration",
    signal: "Long-term international migration",
    publisher: "Office for National Statistics",
    cadence: "Periodic provisional bulletin",
    calendarUrl: "https://www.ons.gov.uk/releasecalendar",
    revisionPolicy: "Preserve provisional status, observation period and later revisions; keep visa and nationality administrative statistics outside this measure.",
    readiness: "Release calendar",
  },
] as const satisfies readonly LedgerEntry[];

function ReadinessBadge({ readiness }: { readiness: LedgerEntry["readiness"] }) {
  const tone = readiness === "Release calendar" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900";
  return <span className={`inline-block px-2.5 py-1 text-xs font-semibold ${tone}`}>{readiness}</span>;
}

export default function PublicationLedger() {
  return (
    <section className="border-t border-[#c8c1b5] pt-8" aria-labelledby="publication-ledger-title">
      <div className="mb-7 grid gap-4 border-b border-[#d8d3c8] pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,36rem)] lg:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-accent">Publication dates</p>
          <h2 id="publication-ledger-title" className="font-display text-3xl leading-tight md:text-5xl">
            Calendar and revision policy
          </h2>
        </div>
        <p className="text-sm leading-6 text-gray-600">
          Publisher calendars show when a release is expected; they do not, by themselves, establish that the latest figures are present here. The current-status register records the separate publication check.
        </p>
      </div>

      <div className="grid gap-px border border-[#d8d3c8] bg-[#d8d3c8] md:grid-cols-2">
        {PUBLICATION_LEDGER.map((entry) => (
          <article key={entry.id} className="v3-source-card bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-display max-w-md text-2xl leading-tight">{entry.signal}</h3>
              <ReadinessBadge readiness={entry.readiness} />
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Publisher
                </dt>
                <dd className="mt-1 font-semibold">{entry.publisher}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Expected schedule
                </dt>
                <dd className="mt-1 leading-6">{entry.cadence}</dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-[#e4dfd6] pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Revision handling
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-700">{entry.revisionPolicy}</p>
            </div>
            <a
              className="mt-4 inline-block text-sm font-semibold underline decoration-black/25 underline-offset-4 hover:text-accent focus-visible:text-accent"
              href={entry.calendarUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open publisher release information <span aria-hidden="true">↗</span>
              <span className="sr-only"> for {entry.signal}</span>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
