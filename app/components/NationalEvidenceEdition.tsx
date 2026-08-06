"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMetricsSnapshot } from "@/app/lib/metricsSnapshot";
import {
  DIRECT_EVIDENCE_LINKS,
  selectNationalEvidenceEdition,
  type EvidenceState,
  type NationalEvidenceEdition as Edition,
  type SignalHistoryPoint,
  type SignalPresentation,
} from "@/app/lib/nationalEvidence";

const STATE_LABELS: Record<EvidenceState, string> = {
  current: "Current verified",
  "update-due": "Update due",
  unavailable: "Unavailable",
};

const SIGNAL_TONES: Record<SignalPresentation["id"], string> = {
  gdp: "signal-card--growth",
  inflation: "signal-card--prices",
  "bank-rate": "signal-card--rates",
  unemployment: "signal-card--work",
  "national-debt": "signal-card--money",
  "nhs-waiting-list": "signal-card--services",
  "net-migration": "signal-card--population",
  "latest-poll": "signal-card--opinion",
};

function Sparkline({
  points,
  title,
  inverse = false,
}: {
  points: SignalHistoryPoint[];
  title: string;
  inverse?: boolean;
}) {
  if (points.length < 2) {
    return (
      <p
        className={`mt-5 border-t pt-3 text-xs ${
          inverse
            ? "border-white/20 text-slate-300"
            : "border-black/10 text-gray-500"
        }`}
      >
        Published trend unavailable
      </p>
    );
  }

  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * 180;
      const y = 48 - ((point.value - minimum) / range) * 40;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const latestY = 48 - ((values.at(-1)! - minimum) / range) * 40;

  return (
    <svg
      role="img"
      aria-label={`${title} published trend across ${points.length} observations`}
      viewBox="0 0 180 56"
      preserveAspectRatio="none"
      className={`mt-5 h-14 w-full overflow-visible ${
        inverse ? "text-white" : "text-foreground"
      }`}
    >
      <path
        d="M0,48 L180,48"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.16"
      />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="180" cy={latestY} r="3" fill="currentColor" />
    </svg>
  );
}

function StateBadge({
  state,
  inverse = false,
}: {
  state: EvidenceState;
  inverse?: boolean;
}) {
  const tone = inverse
    ? state === "current"
      ? "border-white bg-white text-foreground"
      : state === "update-due"
        ? "border-amber-300 bg-amber-300 text-[#172234]"
        : "border-white/30 bg-transparent text-slate-200"
    : state === "current"
      ? "border-foreground bg-foreground text-white"
      : state === "update-due"
        ? "border-[#a46811] bg-[#fff4d8] text-[#744600]"
        : "border-black/20 bg-[#f4f2ec] text-gray-600";

  return (
    <span
      className={`inline-flex min-h-7 items-center border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${tone}`}
    >
      {STATE_LABELS[state]}
    </span>
  );
}

function EditionSummary({ edition }: { edition: Edition }) {
  return (
    <dl className="v3-edition-stats" aria-label="Evidence edition status">
      <div>
        <dt>Current</dt>
        <dd>{edition.counts.current}</dd>
      </div>
      <div>
        <dt>Update due</dt>
        <dd>{edition.counts["update-due"]}</dd>
      </div>
      <div>
        <dt>Unavailable</dt>
        <dd>{edition.counts.unavailable}</dd>
      </div>
    </dl>
  );
}

function LeadStory({ signal }: { signal: SignalPresentation | null }) {
  if (!signal || !signal.value || !signal.leadHeadline) {
    return (
      <article className="v3-lead-story border-y border-foreground bg-white p-6 md:p-8 lg:p-10">
        <p className="eyebrow">Lead publication</p>
        <h3 className="font-display mt-3 max-w-4xl text-4xl leading-[1.02] md:text-6xl">
          No current lead publication is available.
        </h3>
        <p className="mt-5 max-w-2xl text-base leading-7 text-gray-700 md:text-lg">
          The homepage will not substitute an embedded estimate. Topic pages and
          the source register show what is current, due or unavailable.
        </p>
        <Link
          href="/sources"
          prefetch={false}
          className="v3-secondary-action mt-7"
        >
          Check source status
        </Link>
      </article>
    );
  }

  return (
    <article className="v3-lead-story grid overflow-hidden border-y border-foreground lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
      <div className="bg-[#172234] p-6 text-white md:p-9 lg:p-12">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow eyebrow-on-dark">Lead publication</p>
          <StateBadge state={signal.state} inverse />
        </div>
        <h3 className="font-display mt-5 max-w-5xl text-4xl leading-[0.98] md:text-6xl lg:text-[4.75rem]">
          {signal.leadHeadline}
        </h3>
        {signal.leadSummary ? (
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200 md:text-xl md:leading-9">
            {signal.leadSummary}
          </p>
        ) : null}
        <Sparkline points={signal.history} title={signal.title} inverse />
      </div>

      <div className="flex flex-col bg-[#f0e8db] p-6 lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5d6470]">
          {signal.kicker}
        </p>
        <p className="mt-3 text-5xl font-semibold tabular-nums tracking-[-0.055em] md:text-6xl">
          {signal.value}
        </p>
        <dl className="mt-7 space-y-5 border-t border-black/20 pt-5 text-sm leading-6">
          <div>
            <dt className="font-semibold">Observation period</dt>
            <dd className="text-gray-700">{signal.period}</dd>
          </div>
          <div>
            <dt className="font-semibold">Comparison</dt>
            <dd className="text-gray-700">{signal.comparison}</dd>
          </div>
          <div>
            <dt className="font-semibold">Evidence class</dt>
            <dd className="text-gray-700">{signal.evidenceClass}</dd>
          </div>
          <div>
            <dt className="font-semibold">Published</dt>
            <dd className="text-gray-700">{signal.publishedAt}</dd>
          </div>
        </dl>
        {signal.caveat ? (
          <p className="mt-6 border-l-2 border-accent pl-4 text-xs leading-5 text-gray-700">
            {signal.caveat}
          </p>
        ) : null}
        <Link
          href={signal.href}
          prefetch={false}
          className="mt-8 inline-flex min-h-11 items-center justify-between border-t border-black/20 pt-5 text-sm font-semibold underline decoration-black/30 underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black lg:mt-auto"
        >
          Full {signal.title.toLowerCase()} evidence
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

function SignalCard({ signal }: { signal: SignalPresentation }) {
  const unavailable = signal.state === "unavailable" || !signal.value;

  return (
    <li id={signal.anchorId ?? undefined} className="scroll-mt-24">
      <Link
        href={signal.href}
        prefetch={false}
        data-testid="signal-card"
        data-evidence-state={signal.state}
        className={`signal-card ${SIGNAL_TONES[signal.id]} group flex h-full min-h-72 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
          unavailable ? "signal-card--unavailable" : ""
        }`}
      >
        <div className="signal-card__rail" aria-hidden="true" />
        <div className="flex h-full flex-col p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{signal.kicker}</p>
              <h4 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                {signal.title}
              </h4>
            </div>
            <span
              aria-hidden="true"
              className="text-xl transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </div>

          <div className="mt-6">
            {unavailable ? (
              <p className="max-w-xs text-2xl font-semibold leading-tight text-gray-600">
                Current value unavailable
              </p>
            ) : (
              <p className="text-4xl font-semibold tabular-nums tracking-[-0.045em] md:text-5xl">
                {signal.value}
              </p>
            )}
            <p className="mt-3 min-h-10 text-sm leading-5 text-gray-700">
              {signal.comparison ??
                "Open the evidence page for the source status and withdrawal reason."}
            </p>
          </div>

          {!unavailable ? (
            <Sparkline points={signal.history} title={signal.title} />
          ) : (
            <div className="mt-5 border-t border-black/10" />
          )}

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5 text-xs">
            <div className="space-y-1 text-gray-600">
              <p>{signal.period ?? "No current observation period"}</p>
              <p>{signal.evidenceClass}</p>
            </div>
            <StateBadge state={signal.state} />
          </div>
        </div>
      </Link>
    </li>
  );
}

function ReadingGuide() {
  const steps = [
    ["Value", "The latest accepted published figure."],
    ["Period", "When the measured activity actually happened."],
    ["Comparison", "A matched release or series, never an invented trend."],
    ["Source", "The original publisher, method and material caveat."],
  ] as const;

  return (
    <section aria-labelledby="reading-guide-title" className="v3-reading-guide">
      <div>
        <p className="eyebrow eyebrow-on-dark">Reading the edition</p>
        <h3
          id="reading-guide-title"
          className="font-display mt-3 text-3xl leading-tight text-white md:text-4xl"
        >
          Four checks before a number becomes a claim.
        </h3>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
          public-data.org keeps these fields together so a headline cannot
          quietly lose its definition or date.
        </p>
      </div>
      <ol className="grid gap-px bg-white/20 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([label, description], index) => (
          <li key={label} className="bg-[#172234] p-5">
            <span className="text-xs font-semibold text-[#f6a5ad]">
              0{index + 1}
            </span>
            <p className="mt-3 font-semibold text-white">{label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function NationalEvidenceEdition({
  initialEdition,
}: {
  initialEdition: Edition;
}) {
  const [edition, setEdition] = useState(initialEdition);

  useEffect(() => {
    let active = true;
    fetchMetricsSnapshot()
      .then(({ payload }) => {
        if (active) setEdition(selectNationalEvidenceEdition(payload));
      })
      .catch(() => {
        // The server-rendered edition remains useful when the browser refresh fails.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      id="national-signals"
      tabIndex={-1}
      aria-labelledby="national-evidence-title"
      className="scroll-mt-24 focus:outline-none"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
        <div className="v3-edition-header">
          <div>
            <p className="eyebrow">Today&apos;s edition</p>
            <h2
              id="national-evidence-title"
              className="section-title mt-2"
            >
              The latest evidence, first.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 md:text-base">
              Separate measures, separate publication clocks. The lead is
              selected for public usefulness from available evidence, its
              currentness is shown explicitly, and unlike measures are never
              combined into one score.
            </p>
          </div>
          <div>
            <EditionSummary edition={edition} />
            <p className="mt-3 text-right text-xs leading-5 text-gray-500">
              {edition.generatedAt
                ? `Edition checked ${edition.generatedAt}`
                : "Publication check time unavailable"}
            </p>
          </div>
        </div>

        <LeadStory signal={edition.lead} />

        <section
          aria-labelledby="at-a-glance-title"
          className="mt-12 md:mt-16"
        >
          <div className="grid gap-4 border-b border-black/20 pb-6 md:grid-cols-[1fr_minmax(18rem,34rem)] md:items-end">
            <div>
              <p className="eyebrow">National signals</p>
              <h3
                id="at-a-glance-title"
                className="font-display mt-2 text-3xl leading-tight md:text-5xl"
              >
                Britain at a glance
              </h3>
            </div>
            <p className="text-sm leading-6 text-gray-600">
              Eight measures chosen for public usefulness. Open any card for
              its definition, evidence class, history and primary source.
            </p>
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {edition.signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </ul>
        </section>

        <ReadingGuide />

        <section
          id="more-evidence"
          aria-labelledby="more-evidence-title"
          className="mt-12 border-y border-black/20 py-8 md:mt-16"
        >
          <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
            <div>
              <p className="eyebrow">More evidence</p>
              <h3
                id="more-evidence-title"
                className="font-display mt-2 text-3xl leading-tight"
              >
                Go deeper by topic.
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                These evidence areas remain separate because they answer
                different public questions.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {DIRECT_EVIDENCE_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="group flex min-h-28 items-start justify-between gap-4 border border-black/20 bg-white p-5 transition-colors hover:border-foreground hover:bg-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  >
                    <span>
                      <span className="text-lg font-semibold">
                        {item.label}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-gray-600">
                        {item.description}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </section>
  );
}
