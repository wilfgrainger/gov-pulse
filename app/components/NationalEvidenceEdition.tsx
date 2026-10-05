"use client";

import Link from "next/link";
import { publicationRouteEnabled } from "@/contracts/publication-policy";
import { useEffect, useState } from "react";
import { fetchMetricsSnapshot } from "@/app/lib/metricsSnapshot";
import {
  DIRECT_EVIDENCE_LINKS,
  selectNationalEvidenceEdition,
  type NationalEvidenceEdition as Edition,
  type SignalPresentation,
} from "@/app/lib/nationalEvidence";
import EvidenceClassBadge from "./EvidenceClassBadge";
import LeadHistoryCards, { StateBadge } from "./LeadHistoryCards";
import Reveal from "./Reveal";
import TrendSparkline from "./TrendSparkline";

function AwardNoticeContext() {
  if (!publicationRouteEnabled("/money/")) return null;

  return (
    <section aria-labelledby="award-notice-context-title" className="mt-12 border-y-2 border-foreground bg-surface-warm md:mt-16">
      <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-8">
        <div>
          <p className="eyebrow">Public money · procurement records</p>
          <h3 id="award-notice-context-title" className="font-display mt-2 max-w-3xl text-3xl leading-tight md:text-4xl">
            Contract awards show commitments, not cash paid.
          </h3>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-700 md:text-base">
            Published notice values can cover several years, include framework ceilings or multiple lots, and change later. Check the original notice before comparing an award with public expenditure.
          </p>
        </div>
        <Link href="/money/" prefetch={false} className="v3-primary-action shrink-0">
          Explore public-money records <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

const SIGNAL_DOMAIN: Record<string, "economy" | "prices" | "health" | "population" | "public-money" | "politics" | "society"> = {
  inflation: "prices",
  unemployment: "economy",
  "national-debt": "public-money",
  "private-rents": "prices",
  "nhs-waiting-list": "health",
  "government-contracts": "public-money",
};

function SignalCard({ signal, index = 0 }: { signal: SignalPresentation; index?: number }) {
  const unavailable = signal.state === "unavailable" || !signal.value;
  const domain = SIGNAL_DOMAIN[signal.id] ?? "society";

  return (
    <li id={signal.anchorId ?? undefined} className="scroll-mt-24">
      <Reveal delay={Math.min(index, 5) * 0.05} y={10} className="h-full">
      <Link
        href={signal.href}
        prefetch={false}
        data-testid="signal-card"
        data-evidence-state={signal.state}
        data-domain={domain}
        className="editorial-lift group flex h-full min-h-64 flex-col bg-[var(--surface)] p-5 text-[var(--ink)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] md:p-6"
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
          <div className="mb-5 text-[var(--card-accent,var(--accent))]"><TrendSparkline label={signal.title} points={signal.history} /></div>
        ) : (
          <p className="my-5 text-xs text-gray-600">{unavailable ? "Source check pending" : "Comparable trend unavailable"}</p>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-black/10 pt-4 text-xs">
          <div className="space-y-1 text-gray-600">
            <p>{signal.period ?? "No current period"}</p>
            <p>{signal.geography}{signal.publishedAt ? ` · ${signal.dateLabel ?? "Published"} ${signal.publishedAt}` : ""}</p>
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
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-5">
        <div className="mb-5 grid gap-3 border-b border-[var(--line)] pb-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">The public data edition</p>
            <h2 id="national-evidence-title" className="font-display mt-1 text-3xl leading-none tracking-[-0.04em] md:text-4xl">Latest figures</h2>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-[var(--muted)]">
              Each release keeps its own period, geography and original source.
            </p>
          </div>
          <p className="font-mono text-xs text-[var(--muted)] md:pb-1 md:text-sm">
            {edition.counts.current} current · {edition.counts["update-due"]} update due · {edition.counts.unavailable} unavailable
          </p>
        </div>

        <LeadHistoryCards signal={edition.lead} />

        <section aria-labelledby="at-a-glance-title" className="mt-9 md:mt-12">
          <div className="border-b border-[var(--line)] pb-5">
            <p className="eyebrow">Six topics</p>
            <h3 id="at-a-glance-title" className="font-display mt-2 text-3xl leading-tight md:text-5xl">The country at a glance</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Prices, jobs, debt, rents, the NHS waiting list and contracts. A card without verified evidence says so.
            </p>
          </div>
          <ul data-testid="topic-cards" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {edition.signals.map((signal, index) => (
              <SignalCard key={signal.id} signal={signal} index={index} />
            ))}
          </ul>
        </section>

        <AwardNoticeContext />

        <section id="more-evidence" aria-labelledby="more-evidence-title" className="mt-12 border-y border-[var(--line)] py-8 md:mt-16">
          <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
            <div>
              <p className="eyebrow">More evidence</p>
              <h3 id="more-evidence-title" className="font-display mt-2 text-3xl leading-tight">Go deeper by topic.</h3>
            </div>
            <ul className="grid gap-px bg-[var(--line)] sm:grid-cols-2">
              {DIRECT_EVIDENCE_LINKS.filter((item) => publicationRouteEnabled(item.href)).map((item) => (
                <li key={item.href} className="bg-background">
                  <Link href={item.href} prefetch={false} className="editorial-lift group flex min-h-28 items-start justify-between gap-4 bg-[var(--surface)] p-5 text-[var(--ink)] transition-colors hover:bg-[var(--surface-warm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                    <span>
                      <span className="text-lg font-semibold">{item.label}</span>
                      <span className="mt-2 block text-sm leading-6 text-[#51565f]">{item.description}</span>
                    </span>
                    <span aria-hidden="true" className="text-[var(--accent)] transition-transform group-hover:translate-x-1">→</span>
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
