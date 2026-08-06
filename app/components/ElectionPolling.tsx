"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";

const FALLBACK = {
  available: false,
  latestPublicationDate: "",
  expiresAt: "",
  polls: [],
  aggregation: {
    method: "none",
    explanation: "",
  },
  evidencePolicy: {
    sourceClass: "primary-pollster-publication",
    bpcDisclosureRequired: true,
    secondaryAggregatorsUsedAsData: false,
  },
};

const PARTY_META = {
  conservative: { label: "Conservative", color: "#0087DC" },
  labour: { label: "Labour", color: "#E4003B" },
  liberalDemocrats: { label: "Liberal Democrats", color: "#FAA61A" },
  reformUK: { label: "Reform UK", color: "#12B6CF" },
  green: { label: "Green", color: "#6AB023" },
  snp: { label: "SNP", color: "#FDF38E" },
  plaidCymru: { label: "Plaid Cymru", color: "#005B54" },
  yourParty: { label: "Your Party", color: "#6B7280" },
  restoreBritain: { label: "Restore Britain", color: "#7C3AED" },
  other: { label: "Other", color: "#767676" },
} as const;

type PartyKey = keyof typeof PARTY_META;

type PrimaryPoll = {
  id: string;
  pollster: string;
  commissioner: string;
  title: string;
  questionText: string;
  publicationDate: string;
  fieldworkStart: string;
  fieldworkEnd: string;
  sampleSize: number;
  geography: string;
  population: string;
  mode: string;
  headlineMethod: string;
  parties: Partial<Record<PartyKey, number>>;
  sourceUrl: string;
  methodologyUrl: string;
  bpcMember: boolean;
  uncertainty: string;
};

function parseDateOnlyUtc(value: unknown) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return new Date(Number.NaN);

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
    ? date
    : new Date(Number.NaN);
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttps(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("https://");
}

function isPrimaryPoll(value: unknown): value is PrimaryPoll {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const poll = value as Partial<PrimaryPoll>;
  const shares = poll.parties && typeof poll.parties === "object" ? Object.values(poll.parties) : [];

  return (
    nonEmptyText(poll.id) &&
    nonEmptyText(poll.pollster) &&
    nonEmptyText(poll.commissioner) &&
    nonEmptyText(poll.title) &&
    nonEmptyText(poll.questionText) &&
    nonEmptyText(poll.geography) &&
    nonEmptyText(poll.population) &&
    nonEmptyText(poll.mode) &&
    nonEmptyText(poll.headlineMethod) &&
    nonEmptyText(poll.uncertainty) &&
    !Number.isNaN(parseDateOnlyUtc(poll.publicationDate).getTime()) &&
    !Number.isNaN(parseDateOnlyUtc(poll.fieldworkStart).getTime()) &&
    !Number.isNaN(parseDateOnlyUtc(poll.fieldworkEnd).getTime()) &&
    Number.isInteger(poll.sampleSize) &&
    Number(poll.sampleSize) >= 500 &&
    shares.length >= 5 &&
    shares.every((share) => typeof share === "number" && Number.isFinite(share)) &&
    isHttps(poll.sourceUrl) &&
    isHttps(poll.methodologyUrl) &&
    poll.bpcMember === true
  );
}

function validPayload(value: typeof FALLBACK) {
  const expiresAt = Date.parse(value?.expiresAt ?? "");
  return (
    value?.available === true &&
    Number.isFinite(expiresAt) &&
    expiresAt >= Date.now() &&
    Array.isArray(value.polls) &&
    value.polls.length > 0 &&
    value.polls.every(isPrimaryPoll) &&
    value.aggregation?.method === "none" &&
    value.evidencePolicy?.secondaryAggregatorsUsedAsData === false
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDateOnlyUtc(value));
}

function fieldworkLabel(poll: PrimaryPoll) {
  return poll.fieldworkStart === poll.fieldworkEnd
    ? formatDate(poll.fieldworkEnd)
    : `${formatDate(poll.fieldworkStart)}–${formatDate(poll.fieldworkEnd)}`;
}

function rankedParties(poll: PrimaryPoll) {
  return (Object.entries(poll.parties) as Array<[PartyKey, number]>)
    .filter(([key, share]) => key in PARTY_META && Number.isFinite(share))
    .sort((left, right) => right[1] - left[1]);
}

export default function ElectionPolling() {
  const metrics = useMetrics("electionPolling", FALLBACK);
  const data = metrics.data;
  const valid =
    metrics.isLive && metrics.cacheState === "fresh" && validPayload(data);
  const polls = valid ? (data.polls as PrimaryPoll[]) : [];
  const latest = polls[0] ?? null;
  const parties = latest ? rankedParties(latest) : [];
  const leader = parties[0] ?? null;

  return (
    <div className="space-y-8">
      {latest && leader ? (
        <>
          <section aria-labelledby="polling-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Latest verified primary publication</p>
            <h3
              id="polling-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              {latest.pollster} reports {PARTY_META[leader[0]].label} at {leader[1].toFixed(0)}%.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              Fieldwork ran {fieldworkLabel(latest)} among {latest.sampleSize.toLocaleString("en-GB")} {latest.population}. This is one poll publication, not a polling average.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Published {formatDate(latest.publicationDate)} · {latest.geography} · {latest.mode}.
            </p>
          </section>

          <section aria-labelledby="poll-results-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Published headline result</p>
              <h4 id="poll-results-title" className="mt-1 text-2xl font-semibold">
                Party shares in the latest verified publication
              </h4>
            </div>
            <div className="space-y-3">
              {parties.map(([key, share]) => (
                <div key={key} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3">
                  <span className="text-sm font-semibold">{PARTY_META[key].label}</span>
                  <div className="h-4 border border-black/20 bg-white" aria-hidden="true">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, share))}%`,
                        backgroundColor: PARTY_META[key].color,
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-sm font-bold tabular-nums">{share.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="poll-change-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4 id="poll-change-title" className="mt-1 text-2xl font-semibold">
                One current publication; no trend is inferred
              </h4>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-700">
              The latest accepted publication places {PARTY_META[leader[0]].label} at {leader[1].toFixed(0)}%. public-data.org does not compare this with a differently designed poll or claim a movement from one observation.
            </p>
          </section>

          <section aria-labelledby="poll-method-title" className="border-l-4 border-foreground pl-4">
            <h3 id="poll-method-title" className="text-lg font-semibold">Evidence method</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
              public-data.org does not scrape Wikipedia or calculate an unweighted average. It displays each accepted British Polling Council member publication separately with its direct source, fieldwork, sample and method.
            </p>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500">
              Electoral compliance: Under Section 66A of the Representation of the People Act 1983, it is a criminal offence to publish any exit poll or forecast of how people have voted on a parliamentary election day before the close of polls (10:00 PM). public-data.org does not publish exit polls or voting estimates on polling days before the close of polls.
            </p>
          </section>

          <CoreEvidenceExplanation
            idPrefix="election-poll"
            why={
              <p>
                Voting-intention polls are snapshots of stated preference and can show the shape of public opinion at the time of fieldwork. They do not directly forecast seats, turnout or the eventual election result.
              </p>
            }
            definition={
              <p>
                {latest.questionText}. The displayed headline uses this method: {latest.headlineMethod}. Read the pollster&apos;s{" "}
                <a
                  className="font-semibold underline underline-offset-4"
                  href={latest.methodologyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  methodology
                </a>
                .
              </p>
            }
            unit="Published party share (%)"
            geography={latest.geography}
            interpretation={
              <p>
                Party shares describe this publication only. Differences of a few percentage points may fall within the poll&apos;s stated uncertainty and should not be treated as a durable trend.
              </p>
            }
            caveat={<p>{latest.uncertainty}</p>}
            sourceLabel={`Open ${latest.pollster} publication`}
            sourceUrl={latest.sourceUrl}
            sourceDate={`Published ${formatDate(latest.publicationDate)} · fieldwork ${fieldworkLabel(latest)}`}
            explainLabel="Explain this number"
          />

          <section aria-labelledby="poll-publications-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Evidence register</p>
              <h4 id="poll-publications-title" className="mt-1 text-2xl font-semibold">Verified primary poll publications</h4>
            </div>
            <div className="grid gap-px border border-black/20 bg-black/20 md:grid-cols-2">
              {polls.map((poll) => (
                <article key={poll.id} className="bg-white p-4 md:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                        Pollster
                      </p>
                      <h5 className="mt-1 text-lg font-semibold">{poll.pollster}</h5>
                    </div>
                    <a
                      className="shrink-0 text-sm font-semibold underline decoration-black/25 underline-offset-4 hover:text-accent"
                      href={poll.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Primary tables ↗
                    </a>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-black/10 pt-4 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">Commissioner</dt>
                      <dd className="mt-1 font-medium">{poll.commissioner}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Sample</dt>
                      <dd className="mt-1 font-medium tabular-nums">
                        {poll.sampleSize.toLocaleString("en-GB")}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-gray-500">Fieldwork</dt>
                      <dd className="mt-1 font-medium">{fieldworkLabel(poll)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Current primary polling evidence unavailable</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            public-data.org does not have a complete verified primary poll publication inside its 14-day evidence window. It will not fall back to a secondary aggregation or an old embedded average.
          </p>
        </section>
      )}

      <MetricsStatus section="electionPolling" status={metrics} />
    </div>
  );
}
