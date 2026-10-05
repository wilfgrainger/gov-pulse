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

function LeadCard({ signal }: { signal: SignalPresentation | null }) {
  if (!signal || !signal.value || !signal.leadHeadline) {
    return (
      <article
        data-testid="lead-card"
        data-evidence-state="unavailable"
        className="dashboard-card border border-[var(--line)] bg-white p-6 md:p-8"
      >
        <p className="eyebrow">Lead figure</p>
        <h3 className="font-display mt-3 max-w-4xl text-3xl leading-tight md:text-4xl">
          No current lead figure is available.
        </h3>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-700 md:text-base">
          Older figures are not substituted for a current publication. Topic pages show the latest available evidence and its source when a series is verified.
        </p>
        <Link href="/sources" prefetch={false} className="v3-secondary-action mt-6">
          Browse sources
        </Link>
      </article>
    );
  }

  return (
    <article
      data-testid="lead-card"
      data-evidence-state={signal.state}
      data-signal-id={signal.id}
      className="dashboard-card border border-[var(--line)] bg-white p-6 md:p-8"
      aria-labelledby="lead-card-title"
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="eyebrow">Lead figure · {signal.kicker}</p>
        <StateBadge state={signal.state} />
      </div>
      <p className="headline-figure mt-4 text-[clamp(2.75rem,8vw,4.75rem)] tracking-[-0.05em] text-[#14243b]">
        {signal.value}
      </p>
      <h3 id="lead-card-title" className="font-display mt-4 max-w-4xl text-2xl leading-tight md:text-3xl">
        {signal.leadHeadline}
      </h3>
      {signal.leadSummary ? (
        <p className="mt-3 max-w-3xl text-base leading-7 text-gray-700">{signal.leadSummary}</p>
      ) : null}
      <p className="mt-4 text-sm font-semibold text-[#14243b]">
        {signal.geography} · {signal.period} · published {signal.publishedAt}
      </p>
      {signal.comparison ? (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">{signal.comparison}</p>
      ) : null}
      {signal.caveat ? (
        <p className="mt-4 border-l-2 border-accent pl-3 text-xs leading-5 text-gray-700">{signal.caveat}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--line)] pt-4 text-sm font-semibold">
        <Link
          href={signal.href}
          prefetch={false}
          className="inline-flex min-h-11 items-center text-[#14243b] underline-offset-4 hover:underline"
        >
          Understand this figure <span aria-hidden="true">→</span>
        </Link>
        {signal.sourceUrl ? (
          <a
            href={signal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-[#14243b] underline-offset-4 hover:underline"
          >
            Primary source <span aria-hidden="true">↗</span>
          </a>
        ) : null}
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
        className="dashboard-card border border-[var(--line)] bg-white p-6 md:p-8"
        role="status"
      >
        <p className="eyebrow">History</p>
        <h3 className="font-display mt-3 text-2xl leading-tight md:text-3xl">History unavailable</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-700">
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
        className="dashboard-card border border-[var(--line)] bg-white p-6 md:p-8"
        role="status"
      >
        <p className="eyebrow">History · {signal.title}</p>
        <h3 className="font-display mt-3 text-2xl leading-tight md:text-3xl">Comparable history unavailable</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-700">
          The lead figure is current, but this edition does not yet carry two verified points for a history card. Open the topic page for the full source record.
        </p>
        <Link
          href={signal.href}
          prefetch={false}
          className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#14243b] underline-offset-4 hover:underline"
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
      className="dashboard-card border border-[var(--line)] bg-white p-6 md:p-8"
      aria-labelledby="history-card-title"
    >
      <p className="eyebrow">History · {signal.geography}</p>
      <h3 id="history-card-title" className="font-display mt-3 text-2xl leading-tight md:text-3xl">
        {signal.title} over recent observations
      </h3>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">
        {history.length} verified points from {firstLabel} to {lastLabel}. Gaps stay gaps; the scale is fitted to these observations and does not start at zero.
      </p>
      <div className="mt-2 text-[#08766c]">
        <TrendSparkline label={signal.title} points={history} large />
      </div>
      <p className="mt-4 text-sm font-semibold text-[#14243b]">
        Latest in this series: {signal.value} · {signal.period} · published {signal.publishedAt}
      </p>
      {signal.caveat ? (
        <p className="mt-3 border-l-2 border-accent pl-3 text-xs leading-5 text-gray-700">{signal.caveat}</p>
      ) : null}
      <Link
        href={signal.href}
        prefetch={false}
        className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#14243b] underline-offset-4 hover:underline"
      >
        Full chart and source notes <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export default function LeadHistoryCards({ signal }: { signal: SignalPresentation | null }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <Reveal>
        <LeadCard signal={signal} />
      </Reveal>
      <Reveal delay={0.05}>
        <HistoryCard signal={signal} />
      </Reveal>
    </div>
  );
}

export { StateBadge, STATE_LABELS };
