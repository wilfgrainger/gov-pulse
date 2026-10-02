"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMetricsSnapshot } from "@/app/lib/metricsSnapshot";
import {
  DIRECT_EVIDENCE_LINKS,
  selectNationalEvidenceEdition,
  type EvidenceState,
  type NationalEvidenceEdition as Edition,
  type SignalPresentation,
} from "@/app/lib/nationalEvidence";
import EvidenceClassBadge from "./EvidenceClassBadge";
import Reveal from "./Reveal";
import TrendSparkline from "./TrendSparkline";

const STATE_LABELS: Record<EvidenceState, string> = {
  current: "Current",
  "update-due": "Update due",
  unavailable: "Unavailable",
};

function StateBadge({ state }: { state: EvidenceState }) {
  const tone =
    state === "current"
      ? "border-foreground bg-foreground text-white"
      : state === "update-due"
        ? "border-[#8a5a12] bg-[#e9eef3] text-[#3a4657]"
        : "border-black/20 bg-[#eef1f4] text-gray-600";

  return (
    <span className={`british-538-badge ${tone}`}>
      {STATE_LABELS[state]}
    </span>
  );
}

function LeadStory({ signal }: { signal: SignalPresentation | null }) {
  if (!signal || !signal.value || !signal.leadHeadline) {
    return (
      <article className="border-y border-foreground bg-white p-6 md:p-8 lg:p-10">
        <p className="eyebrow">Lead figure</p>
        <h3 className="font-display mt-3 max-w-4xl text-4xl leading-[1.02] md:text-6xl">
          No current lead figure is available.
        </h3>
        <p className="mt-5 max-w-2xl text-base leading-7 text-gray-700 md:text-lg">
          Older figures are not substituted for a current publication. The topic pages show the latest available evidence and its source.
        </p>
        <Link href="/sources" prefetch={false} className="v3-secondary-action mt-7">
          Browse sources
        </Link>
      </article>
    );
  }

  return (
    <article className="v3-lead-story editorial-lift grid overflow-hidden border-y-2 border-foreground lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      <div className="flex flex-col bg-[#14243b] p-7 text-white md:p-10 lg:p-12">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow eyebrow-on-dark">The latest release to know</p>
          <span className="british-538-badge border border-white bg-white text-foreground">
            {STATE_LABELS[signal.state]}
          </span>
        </div>
        <h3 className="font-display mt-8 max-w-4xl text-4xl leading-[1.05] md:text-5xl lg:text-6xl">
          {signal.leadHeadline}
        </h3>
        {signal.leadSummary ? (
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 md:text-xl md:leading-9">
            {signal.leadSummary}
          </p>
        ) : null}
        <Link href={signal.href} prefetch={false} className="mt-8 inline-flex min-h-12 w-fit items-center gap-6 border-b-2 border-[#8fc2e6] py-2 text-base font-semibold text-white hover:text-[#8fc2e6] lg:mt-auto">
          Understand this figure <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <div className="flex flex-col bg-[#dceaf4] p-7 md:p-10 lg:p-12">
        <p className="eyebrow !text-[#0f6b63]">{signal.kicker} · {signal.geography}</p>
        <p className="headline-figure mt-4 text-7xl tracking-[-0.06em] md:text-8xl">{signal.value}</p>
        <p className="mt-3 text-sm font-semibold">{signal.period} · published {signal.publishedAt}</p>
        <div className="text-[#0f6b63]"><TrendSparkline label={signal.title} points={signal.history} large /></div>
        <p className="mt-5 border-t border-black/15 pt-5 text-base leading-7">{signal.comparison}</p>
        {signal.caveat ? (
          <p className="mt-4 border-l-2 border-accent pl-4 text-sm leading-6 text-gray-700">{signal.caveat}</p>
        ) : null}
      </div>
    </article>
  );
}

function SignalCard({ signal, index = 0 }: { signal: SignalPresentation; index?: number }) {
  const unavailable = signal.state === "unavailable" || !signal.value;

  return (
    <li id={signal.anchorId ?? undefined} className="scroll-mt-24">
      <Reveal delay={Math.min(index, 5) * 0.05} y={10} className="h-full">
      <Link
        href={signal.href}
        prefetch={false}
        data-testid="signal-card"
        data-evidence-state={signal.state}
        className="editorial-lift group flex h-full min-h-80 flex-col border-t-4 border-t-[#0f6b63] bg-white p-5 transition-colors hover:border-foreground hover:bg-[#eef6fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black md:p-6 british-538-border"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{signal.kicker}</p>
            <h4 className="mt-2 text-xl font-semibold tracking-[-0.025em]">{signal.title}</h4>
            <EvidenceClassBadge evidenceClass={signal.evidenceClass} className="mt-2" />
          </div>
          <span aria-hidden="true" className="text-xl transition-transform group-hover:translate-x-1">→</span>
        </div>

        <div className="mt-5">
          <p className={unavailable ? "max-w-xs text-2xl font-semibold leading-tight text-gray-600" : "headline-figure text-4xl md:text-5xl"}>
            {unavailable ? "Current value unavailable" : signal.value}
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            {signal.comparison ?? "Open the evidence page for the latest source information."}
          </p>
        </div>

        {!unavailable && signal.history.length > 1 ? (
          <div className="mb-5 text-[#0f6b63]"><TrendSparkline label={signal.title} points={signal.history} /></div>
        ) : (
          <p className="my-5 text-xs text-gray-600">{unavailable ? "Source check pending" : "Comparable trend unavailable"}</p>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-black/10 pt-4 text-xs">
          <div className="space-y-1 text-gray-600">
            <p>{signal.period ?? "No current period"}</p>
            <p>{signal.geography}{signal.publishedAt ? ` · Published ${signal.publishedAt}` : ""}</p>
          </div>
          <StateBadge state={signal.state} />
        </div>
      </Link>
      </Reveal>
    </li>
  );
}

export default function NationalEvidenceEdition({ initialEdition }: { initialEdition: Edition }) {
  const [edition, setEdition] = useState(initialEdition);

  useEffect(() => {
    let active = true;
    fetchMetricsSnapshot()
      .then(({ payload }) => {
        if (active) setEdition(selectNationalEvidenceEdition(payload));
      })
      .catch(() => {
        // Keep the server-rendered edition when a browser refresh fails.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="national-signals" tabIndex={-1} aria-labelledby="national-evidence-title" className="scroll-mt-24 focus:outline-none">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-8 grid gap-5 border-b border-black/20 pb-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">The public data edition</p>
            <h2 id="national-evidence-title" className="section-title mt-2">Latest figures</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 md:text-base">
              A clear reading of the latest verified releases. Every figure has its own period, geography and original source.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            {edition.counts.current} current · {edition.counts["update-due"]} update due · {edition.counts.unavailable} unavailable
          </p>
        </div>

        <Reveal>
          <LeadStory signal={edition.lead} />
        </Reveal>

        <section aria-labelledby="at-a-glance-title" className="mt-12 md:mt-16">
          <div className="border-b border-black/20 pb-5">
            <p className="eyebrow">National signals</p>
            <h3 id="at-a-glance-title" className="font-display mt-2 text-3xl leading-tight md:text-5xl">The country at a glance</h3>
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {edition.signals.map((signal, index) => (
              <SignalCard key={signal.id} signal={signal} index={index} />
            ))}
          </ul>
        </section>

        {/* British 538 Data Spotlight: Government Spending & Contracts */}
        <section aria-labelledby="spending-spotlight-title" className="mt-12 md:mt-16">
          <div className="border border-[#14243b] bg-white p-6 shadow-[3px_3px_0_#14243b] md:p-8 lg:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/15 pb-5">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#1f5c8a]">
                  Public Procurement & Spending · Find a Tender Service
                </p>
                <h3 id="spending-spotlight-title" className="font-display mt-2 text-2xl font-bold md:text-3xl">
                  UK Government Contracts: Where Public Money Goes
                </h3>
              </div>
              <Link
                href="/section/government-contracts"
                prefetch={false}
                className="inline-flex min-h-10 items-center gap-2 bg-[#14243b] px-4 py-2 font-mono text-xs font-bold text-white transition-colors hover:bg-[#1f5c8a]"
              >
                <span>Explore Spending Pipeline</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border-l-4 border-[#1f5c8a] bg-[#f4f6f8] p-4">
                <p className="font-mono text-xs font-semibold uppercase text-gray-500">Total Tracked Value</p>
                <p className="headline-figure mt-1 text-3xl font-extrabold text-[#14243b] md:text-4xl">£13.15B</p>
                <p className="mt-2 text-xs text-gray-600">Across 100 active notices & frameworks</p>
              </div>

              <div className="border-l-4 border-[#0f6b63] bg-[#f4f6f8] p-4">
                <p className="font-mono text-xs font-semibold uppercase text-gray-500">Peak Spend Month</p>
                <p className="headline-figure mt-1 text-3xl font-extrabold text-[#0f6b63] md:text-4xl">£2.66B</p>
                <p className="mt-2 text-xs text-gray-600">March 2026 fiscal year-end allocation</p>
              </div>

              <div className="border-l-4 border-[#8a5a12] bg-[#f4f6f8] p-4">
                <p className="font-mono text-xs font-semibold uppercase text-gray-500">Top 5 Concentration</p>
                <p className="headline-figure mt-1 text-3xl font-extrabold text-[#8a5a12] md:text-4xl">30.8%</p>
                <p className="mt-2 text-xs text-gray-600">£4.05B held by top 5 major suppliers</p>
              </div>

              <div className="border-l-4 border-[#5a4b9c] bg-[#f4f6f8] p-4">
                <p className="font-mono text-xs font-semibold uppercase text-gray-500">Monthly Mean Spend</p>
                <p className="headline-figure mt-1 text-3xl font-extrabold text-[#5a4b9c] md:text-4xl">£1.46B</p>
                <p className="mt-2 text-xs text-gray-600">Average monthly award commitment</p>
              </div>
            </div>
          </div>
        </section>

        <section id="more-evidence" aria-labelledby="more-evidence-title" className="mt-12 border-y border-black/20 py-8 md:mt-16">
          <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
            <div>
              <p className="eyebrow">More evidence</p>
              <h3 id="more-evidence-title" className="font-display mt-2 text-3xl leading-tight">Go deeper by topic.</h3>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {DIRECT_EVIDENCE_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch={false} className="editorial-lift group flex min-h-28 items-start justify-between gap-4 bg-white p-5 transition-colors hover:bg-[#f9fbfc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black british-538-border">

                    <span>
                      <span className="text-lg font-semibold">{item.label}</span>
                      <span className="mt-2 block text-sm leading-6 text-gray-600">{item.description}</span>
                    </span>
                    <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
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
