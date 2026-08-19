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
        ? "border-[#a46811] bg-[#fff4d8] text-[#744600]"
        : "border-black/20 bg-[#f4f2ec] text-gray-600";

  return (
    <span className={`inline-flex min-h-7 items-center border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${tone}`}>
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
    <article className="grid overflow-hidden border-y border-foreground lg:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.6fr)]">
      <div className="bg-[#172234] p-6 text-white md:p-9 lg:p-12">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow eyebrow-on-dark">Lead figure</p>
          <span className="inline-flex min-h-7 items-center border border-white bg-white px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-foreground">
            {STATE_LABELS[signal.state]}
          </span>
        </div>
        <h3 className="font-display mt-5 max-w-5xl text-4xl leading-[0.98] md:text-6xl lg:text-[4.75rem]">
          {signal.leadHeadline}
        </h3>
        {signal.leadSummary ? (
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200 md:text-xl md:leading-9">
            {signal.leadSummary}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col bg-[#f0e8db] p-6 lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5d6470]">{signal.kicker}</p>
        <p className="mt-3 text-5xl font-semibold tabular-nums tracking-[-0.055em] md:text-6xl">{signal.value}</p>
        <dl className="mt-7 space-y-4 border-t border-black/20 pt-5 text-sm leading-6">
          <div>
            <dt className="font-semibold">Period</dt>
            <dd className="text-gray-700">{signal.period}</dd>
          </div>
          <div>
            <dt className="font-semibold">Comparison</dt>
            <dd className="text-gray-700">{signal.comparison}</dd>
          </div>
          <div>
            <dt className="font-semibold">Published</dt>
            <dd className="text-gray-700">{signal.publishedAt}</dd>
          </div>
        </dl>
        {signal.caveat ? (
          <p className="mt-5 border-l-2 border-accent pl-4 text-xs leading-5 text-gray-700">{signal.caveat}</p>
        ) : null}
        <Link href={signal.href} prefetch={false} className="mt-8 inline-flex min-h-11 items-center justify-between border-t border-black/20 pt-5 text-sm font-semibold underline decoration-black/30 underline-offset-4 hover:text-accent lg:mt-auto">
          Open full evidence
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
        className="group flex h-full min-h-64 flex-col border border-black/20 bg-white p-5 transition-colors hover:border-foreground hover:bg-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{signal.kicker}</p>
            <h4 className="mt-2 text-xl font-semibold tracking-[-0.025em]">{signal.title}</h4>
          </div>
          <span aria-hidden="true" className="text-xl transition-transform group-hover:translate-x-1">→</span>
        </div>

        <div className="mt-6">
          <p className={unavailable ? "max-w-xs text-2xl font-semibold leading-tight text-gray-600" : "text-4xl font-semibold tabular-nums tracking-[-0.045em] md:text-5xl"}>
            {unavailable ? "Current value unavailable" : signal.value}
          </p>
          <p className="mt-3 text-sm leading-6 text-gray-700">
            {signal.comparison ?? "Open the evidence page for the latest source information."}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-black/10 pt-5 text-xs">
          <div className="space-y-1 text-gray-600">
            <p>{signal.period ?? "No current period"}</p>
            <p>{signal.evidenceClass}</p>
          </div>
          <StateBadge state={signal.state} />
        </div>
      </Link>
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
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
        <div className="mb-8 grid gap-5 border-b border-black/20 pb-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">Latest figures</p>
            <h2 id="national-evidence-title" className="section-title mt-2">The latest evidence, first.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 md:text-base">
              Each figure keeps its own period, definition and source. Open a figure to inspect the full evidence.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            {edition.counts.current} current · {edition.counts["update-due"]} update due · {edition.counts.unavailable} unavailable
          </p>
        </div>

        <LeadStory signal={edition.lead} />

        <section aria-labelledby="at-a-glance-title" className="mt-12 md:mt-16">
          <div className="border-b border-black/20 pb-5">
            <p className="eyebrow">National signals</p>
            <h3 id="at-a-glance-title" className="font-display mt-2 text-3xl leading-tight md:text-5xl">Britain at a glance</h3>
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {edition.signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </ul>
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
                  <Link href={item.href} prefetch={false} className="group flex min-h-28 items-start justify-between gap-4 border border-black/20 bg-white p-5 transition-colors hover:border-foreground hover:bg-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
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
