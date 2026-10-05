"use client";

import Link from "next/link";
import type { EvidenceState, SignalPresentation } from "@/app/lib/nationalEvidence";
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
      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--surface)]"
      : state === "update-due"
        ? "border-[#8a5a12] bg-[#efe9de] text-[#3a4657]"
        : "border-[#cfc7b8] bg-[#efe9de] text-[#5c6570]";

  return (
    <span className={`british-538-badge ${tone}`}>
      {STATE_LABELS[state]}
    </span>
  );
}

function LeadCard({ signal }: { signal: SignalPresentation | null }) {
  if (!signal || !signal.value || !signal.leadHeadline) {
    return (
      <article
        data-testid="lead-card"
        data-evidence-state="unavailable"
        className="premium-lead"
      >
        <div>
          <p className="eyebrow">Lead figure</p>
          <h3 className="font-display mt-3 max-w-4xl text-3xl leading-tight md:text-4xl">
            No current lead figure is available.
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#51565f] md:text-base">
            Older figures are not substituted for a current publication. Topic pages show the latest available evidence and its source when a series is verified.
          </p>
          <Link href="/sources" prefetch={false} className="v3-secondary-action mt-6">
            Browse sources
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article
      data-testid="lead-card"
      data-evidence-state={signal.state}
      data-signal-id={signal.id}
      className="premium-lead"
      aria-labelledby="lead-card-title"
    >
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">Lead figure · {signal.kicker}</p>
          <StateBadge state={signal.state} />
        </div>
        <p className="headline-figure mt-4">{signal.value}</p>
        <h3 id="lead-card-title" className="font-display mt-4 max-w-4xl text-2xl leading-tight md:text-3xl">
          {signal.leadHeadline}
        </h3>
        {signal.leadSummary ? (
          <p className="mt-3 max-w-3xl text-base leading-7 text-[#51565f]">{signal.leadSummary}</p>
        ) : null}
      </div>
      <div className="premium-lead__rail">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-[var(--accent)]">Provenance</p>
        <p className="mt-3 text-sm font-semibold text-[var(--ink)]">
          {signal.geography} · {signal.period} · published {signal.publishedAt}
        </p>
        {signal.comparison ? (
          <p className="mt-3 text-sm leading-6 text-[#51565f]">{signal.comparison}</p>
        ) : null}
        {signal.caveat ? (
          <p className="mt-4 border-l-2 border-[var(--accent)] pl-3 text-xs leading-5 text-[#51565f]">{signal.caveat}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--line-on-paper)] pt-4 text-sm font-semibold">
          <Link
            href={signal.href}
            prefetch={false}
            className="inline-flex min-h-11 items-center text-[var(--ink)] underline-offset-4 hover:underline"
          >
            Understand this figure <span aria-hidden="true">→</span>
          </Link>
          {signal.sourceUrl ? (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[var(--ink)] underline-offset-4 hover:underline"
            >
              Primary source <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function HistoryCard({ signal }: { signal: SignalPresentation | null }) {
  const history = signal?.history ?? [];
  const hasHistory = Boolean(signal?.value && history.length >= 2);

  if (!signal || !signal.value || !signal.leadHeadline) {
    return (
      <article
        data-testid="history-card"
        data-evidence-state="unavailable"
        className="dashboard-card p-6 md:p-8"
        role="status"
      >
        <p className="eyebrow">History</p>
        <h3 className="font-display mt-3 text-2xl leading-tight md:text-3xl">History unavailable</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#51565f]">
          A history card is shown only when a current lead figure has at least two verified observations. No earlier figure is invented to fill the gap.
        </p>
      </article>
    );
  }

  if (!hasHistory) {
    return (
      <article
        data-testid="history-card"
        data-evidence-state={signal.state}
        data-signal-id={signal.id}
        className="dashboard-card p-6 md:p-8"
        role="status"
      >
        <p className="eyebrow">History · {signal.title}</p>
        <h3 className="font-display mt-3 text-2xl leading-tight md:text-3xl">Comparable history unavailable</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#51565f]">
          The lead figure is current, but this edition does not yet carry two verified points for a history card. Open the topic page for the full source record.
        </p>
        <Link
          href={signal.href}
          prefetch={false}
          className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--ink)] underline-offset-4 hover:underline"
        >
          Open {signal.title} <span aria-hidden="true">→</span>
        </Link>
      </article>
    );
  }

  const first = history[0];
  const last = history[history.length - 1];
  const firstLabel = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(first.observedAt));
  const lastLabel = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(last.observedAt));

  return (
    <article
      data-testid="history-card"
      data-evidence-state={signal.state}
      data-signal-id={signal.id}
      className="dashboard-card p-6 md:p-8"
      aria-labelledby="history-card-title"
    >
      <p className="eyebrow">History · {signal.geography}</p>
      <h3 id="history-card-title" className="font-display mt-3 text-2xl leading-tight md:text-3xl">
        {signal.title} over recent observations
      </h3>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51565f]">
        {history.length} verified points from {firstLabel} to {lastLabel}. Gaps stay gaps; the scale is fitted to these observations and does not start at zero.
      </p>
      <div className="mt-2 text-[var(--accent)]">
        <TrendSparkline label={signal.title} points={history} large />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--ink)]">
        Latest in this series: {signal.value} · {signal.period} · published {signal.publishedAt}
      </p>
      {signal.caveat ? (
        <p className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-xs leading-5 text-[#51565f]">{signal.caveat}</p>
      ) : null}
      <Link
        href={signal.href}
        prefetch={false}
        className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--ink)] underline-offset-4 hover:underline"
      >
        Full chart and source notes <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export default function LeadHistoryCards({ signal }: { signal: SignalPresentation | null }) {
  return (
    <div className="grid gap-px bg-[var(--line)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
      <Reveal className="bg-background">
        <LeadCard signal={signal} />
      </Reveal>
      <Reveal delay={0.05} className="bg-background">
        <HistoryCard signal={signal} />
      </Reveal>
    </div>
  );
}

export { StateBadge, STATE_LABELS };
