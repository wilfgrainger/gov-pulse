"use client";

import Link from "next/link";

interface TickerMetric {
  label: string;
  value: string;
  source: string;
  href: string;
  badge?: string;
  trend?: "up" | "down" | "neutral";
}

const TICKER_METRICS: TickerMetric[] = [
  {
    label: "Gov Spending & Contracts",
    value: "£13.15B",
    source: "Find a Tender",
    href: "/section/government-contracts",
    badge: "100 Active Awards",
  },
  {
    label: "Monthly GDP",
    value: "+0.1%",
    source: "ONS",
    href: "/section/gdp",
    trend: "up",
  },
  {
    label: "CPI Inflation",
    value: "3.4%",
    source: "ONS D7G7",
    href: "/section/economy",
    trend: "down",
  },
  {
    label: "Bank of England Rate",
    value: "5.25%",
    source: "BoE IUDBEDR",
    href: "/section/economy",
    trend: "neutral",
  },
  {
    label: "NHS Waiting List",
    value: "7.57M",
    source: "NHS England",
    href: "/section/nhs",
  },
  {
    label: "Unemployment Rate",
    value: "4.4%",
    source: "ONS MGSX",
    href: "/section/employment",
  },
  {
    label: "Average House Price",
    value: "£288k",
    source: "HM Land Registry",
    href: "/section/house-price-index",
  },
];

export default function BritishDatelineTicker() {
  return (
    <aside
      aria-label="UK Public Evidence Live Dateline"
      className="border-b border-[#14243b] bg-[#14243b] text-white"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs md:px-6">
        {/* Left: Dateline Tag */}
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          </span>
          <span className="font-mono text-[0.6875rem] font-bold tracking-widest uppercase text-emerald-300">
            LIVE UK EVIDENCE
          </span>
          <span className="hidden text-white/40 md:inline" aria-hidden="true">
            |
          </span>
          <span className="hidden font-mono text-[0.6875rem] tracking-wider text-slate-300 md:inline">
            INDEPENDENT DATA JOURNALISM
          </span>
        </div>

        {/* Center/Right: Micro-Metrics Scroll */}
        <div
          tabIndex={0}
          aria-label="Scrollable key metrics ticker"
          className="flex items-center gap-4 overflow-x-auto py-0.5 text-[0.75rem] scrollbar-thin scrollbar-thumb-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {TICKER_METRICS.map((metric) => (
            <Link
              key={metric.label}
              href={metric.href}
              prefetch={false}
              className="group flex shrink-0 items-center gap-1.5 transition-colors hover:text-emerald-300"
            >
              <span className="text-slate-300">{metric.label}:</span>
              <span className="font-mono font-bold text-white transition-colors group-hover:text-emerald-300">
                {metric.value}
              </span>
              {metric.badge && (
                <span className="rounded bg-emerald-950/80 px-1 py-0.2 font-mono text-[0.625rem] font-semibold text-emerald-300 border border-emerald-500/30">
                  {metric.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
