"use client";

import { useSyncExternalStore } from "react";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";
import { isCurrentBettingMarketPayload } from "@/contracts/betting-markets";

const FALLBACK = {
  available: false,
  provider: "",
  observedAt: "",
  expiresAt: "",
  markets: [],
  evidencePolicy: {
    sourceClass: "commercial-market-snapshot",
    priceType: "",
    probabilityMethod: "",
    predictiveClaim: false,
    secondaryFallbackAllowed: false,
  },
};

type Runner = {
  name: string;
  decimalOdds: number;
  impliedProbability: number;
};

type Market = {
  id: "nextPrimeMinister" | "mostSeats" | "electionYear";
  title: string;
  sourceUrl: string;
  runnerCount: number;
  marketBookPercent: number;
  runners: Runner[];
};

const CLOCK_INTERVAL_MS = 60_000;
const clockListeners = new Set<() => void>();
let clientNowMs = Date.now();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function publishClockTick() {
  clientNowMs = Date.now();
  for (const listener of clockListeners) listener();
}

function subscribeToClock(listener: () => void) {
  clockListeners.add(listener);
  publishClockTick();
  if (clockTimer === null) clockTimer = setInterval(publishClockTick, CLOCK_INTERVAL_MS);
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function getClientClockSnapshot() {
  return clientNowMs;
}

function getServerClockSnapshot() {
  return 0;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function displayRunners(market: Market) {
  return market.runners.slice(0, 6);
}

export default function BettingOdds() {
  const metrics = useMetrics("bettingOdds", FALLBACK);
  const nowMs = useSyncExternalStore(
    subscribeToClock,
    getClientClockSnapshot,
    getServerClockSnapshot
  );
  const valid =
    nowMs > 0 &&
    metrics.isLive &&
    metrics.cacheState === "fresh" &&
    isCurrentBettingMarketPayload(metrics.data, new Date(nowMs));
  const markets = valid ? (metrics.data.markets as Market[]) : [];
  const nextPm = markets.find((market) => market.id === "nextPrimeMinister") ?? null;
  const shortest = nextPm?.runners[0] ?? null;

  return (
    <div className="space-y-8">
      {valid && nextPm && shortest ? (
        <>
          <section aria-labelledby="betting-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Fresh commercial market snapshot</p>
            <h3
              id="betting-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              {shortest.name} has the shortest listed next-PM price at {shortest.decimalOdds.toFixed(2)}.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              Its raw reciprocal price is {shortest.impliedProbability.toFixed(1)}%. This is a market signal, not a forecast, poll or probability endorsed by public-data.org.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Observed {formatTimestamp(metrics.data.observedAt)} · expires after four hours · best available decimal odds shown by Oddschecker.
            </p>
          </section>

          <section aria-labelledby="market-snapshot-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Current named markets</p>
              <h4 id="market-snapshot-title" className="mt-1 text-2xl font-semibold">
                Three exact markets, shown without synthetic normalization
              </h4>
            </div>
            <div className="grid gap-8 lg:grid-cols-3">
              {markets.map((market) => (
                <article key={market.id} className="border-y border-black/20 py-4">
                  <div className="min-h-24">
                    <h5 className="text-lg font-semibold leading-6">{market.title}</h5>
                    <p className="mt-2 text-xs leading-5 text-gray-600">
                      {market.runnerCount} runners captured · reciprocal prices total {market.marketBookPercent.toFixed(1)}%, so these figures should not be read as a probability distribution.
                    </p>
                  </div>
                  <ol className="mt-4 divide-y divide-black/10">
                    {displayRunners(market).map((runner) => (
                      <li key={runner.name} className="grid grid-cols-[1fr_auto] gap-3 py-3">
                        <span className="text-sm font-semibold">{runner.name}</span>
                        <span className="text-right font-mono text-xs tabular-nums">
                          {runner.decimalOdds.toFixed(2)} · {runner.impliedProbability.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ol>
                  {market.runnerCount > 6 ? (
                    <p className="mt-2 text-xs text-gray-600">
                      Showing the six shortest prices from {market.runnerCount} captured runners.
                    </p>
                  ) : null}
                  <a
                    className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
                    href={market.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open this exact Oddschecker market
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="betting-trend-title" className="border-y border-black/20 py-4">
            <h3 id="betting-trend-title" className="text-lg font-semibold">
              Historical direction is not yet available
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
              The verified feed is a four-hour market snapshot, not a stable historical series. Prices, runners and market rules can change, so public-data.org will only draw a trend after it has accumulated like-for-like snapshots for the same named market.
            </p>
          </section>

          <section aria-labelledby="betting-why-title" className="border-l-4 border-foreground pl-4">
            <h3 id="betting-why-title" className="text-lg font-semibold">Why it matters</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
              Political market prices can move within minutes and reflect liquidity, bookmaker margins, market rules and trader behaviour. public-data.org therefore shows raw reciprocal prices, names the exact market and withdraws the panel completely when the snapshot is older than four hours.
            </p>
          </section>

          <details className="border-y border-black/20 py-4">
            <summary className="cursor-pointer text-lg font-semibold">Explain these prices</summary>
            <div className="mt-4 grid gap-5 text-sm leading-6 text-gray-700 md:grid-cols-3">
              <div>
                <strong className="text-foreground">Decimal odds</strong>
                <p>The listed return including stake for each £1 wager, subject to the provider&apos;s terms.</p>
              </div>
              <div>
                <strong className="text-foreground">Implied percentage</strong>
                <p>Calculated as 100 divided by decimal odds. public-data.org does not force the market to sum to 100%.</p>
              </div>
              <div>
                <strong className="text-foreground">Evidence boundary</strong>
                <p>No embedded prices, candidate roles or secondary fallback are used. An incomplete, redirected or expired snapshot is unavailable.</p>
              </div>
            </div>
          </details>
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Current betting market snapshot unavailable</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            public-data.org does not have a complete verified snapshot inside its four-hour evidence window. It will not display stale, partial, redirected or embedded political betting prices.
          </p>
        </section>
      )}

      <MetricsStatus section="bettingOdds" status={metrics} />
    </div>
  );
}
