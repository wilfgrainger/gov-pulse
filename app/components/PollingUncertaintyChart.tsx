"use client";

import {
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ClientOnlyChart from "@/app/components/ClientOnlyChart";
import {
  fieldworkMidpointMs,
  marginOfErrorFromSampleSize,
} from "@/app/lib/pollingUncertainty";

type PartyMeta = { label: string; color: string };

type PollLike = {
  id: string;
  pollster: string;
  fieldworkStart: string;
  fieldworkEnd: string;
  sampleSize: number;
  parties: Record<string, number | undefined>;
};

type Props<PartyKey extends string> = {
  polls: PollLike[];
  partyMeta: Record<PartyKey, PartyMeta>;
  partyOrder: PartyKey[];
};

type ScatterPoint = {
  pollId: string;
  pollster: string;
  fieldworkMid: number;
  fieldworkLabel: string;
  share: number;
  moeLow: number;
  moeHigh: number;
  marginOfErrorPoints: number;
};

function formatAxisDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatTooltipDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function fieldworkLabel(poll: PollLike) {
  const start = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${poll.fieldworkStart}T00:00:00.000Z`));
  if (poll.fieldworkStart === poll.fieldworkEnd) return start;
  const end = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${poll.fieldworkEnd}T00:00:00.000Z`));
  return `${start}\u2013${end}`;
}

/**
 * Builds one Scatter series per party: each point is a single poll
 * publication, plotted at its fieldwork midpoint with a vertical error bar
 * spanning +/- the sample-size-derived margin of error. There is no line
 * connecting points, no fitted trend, and no averaging across polls --
 * each point stays independently traceable to its pollster and fieldwork
 * dates via the tooltip and the accessible data table below the chart.
 */
function buildSeries<PartyKey extends string>(polls: PollLike[], partyKey: PartyKey): ScatterPoint[] {
  return polls
    .map((poll) => {
      const share = poll.parties[partyKey];
      if (typeof share !== "number" || !Number.isFinite(share)) return null;
      const moe = marginOfErrorFromSampleSize(poll.sampleSize);
      return {
        pollId: poll.id,
        pollster: poll.pollster,
        fieldworkMid: fieldworkMidpointMs(poll.fieldworkStart, poll.fieldworkEnd),
        fieldworkLabel: fieldworkLabel(poll),
        share,
        moeLow: moe.marginOfErrorPoints,
        moeHigh: moe.marginOfErrorPoints,
        marginOfErrorPoints: moe.marginOfErrorPoints,
      } satisfies ScatterPoint;
    })
    .filter((point): point is ScatterPoint => point !== null);
}

export default function PollingUncertaintyChart<PartyKey extends string>({
  polls,
  partyMeta,
  partyOrder,
}: Props<PartyKey>) {
  const seriesByParty = partyOrder
    .map((key) => ({ key, meta: partyMeta[key], points: buildSeries(polls, key) }))
    .filter((series) => series.points.length > 0);

  const first = polls.at(-1);
  const latest = polls.at(0);
  const range =
    first && latest
      ? `${fieldworkLabel(first)} to ${fieldworkLabel(latest)}`
      : "Published history unavailable";

  return (
    <figure className="border-y border-black/20 bg-[#f7f9fb] py-5">
      <figcaption className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h4 className="text-xl font-semibold tracking-[-0.015em]">
            Each verified poll publication, with its own margin of error
          </h4>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
            Every point is one primary poll publication for one party, plotted at its
            fieldwork midpoint. The vertical bar is that poll&apos;s own margin of error --
            estimated from its disclosed sample size using the standard sampling-error
            formula at 95% confidence. public-data.org does not calculate a polling
            average, a rolling mean, or a trend line across these points.
          </p>
        </div>
        <p className="font-mono text-xs tabular-nums text-gray-500">{range}</p>
      </figcaption>
      <div
        role="img"
        aria-label={`Scatter plot of individual poll publications by party share, each with a sample-size-derived margin of error band. Period shown: ${range}. No average or trend line is shown. See the data table below for exact per-poll values.`}
        className="border-t border-black/10 pt-3"
      >
        <ClientOnlyChart heightClass="h-[340px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 640, height: 340 }}
          >
            <ScatterChart margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#d3dae1" strokeDasharray="2 4" />
              <XAxis
                dataKey="fieldworkMid"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatAxisDate}
                tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: "#586170" }}
                axisLine={{ stroke: "#111827", strokeWidth: 1 }}
                tickLine={false}
                tickCount={6}
                minTickGap={44}
                name="Fieldwork midpoint"
              />
              <YAxis
                dataKey="share"
                type="number"
                tickFormatter={(value: number) => `${value}%`}
                tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: "#586170" }}
                axisLine={false}
                tickLine={false}
                width={46}
                domain={["auto", "auto"]}
                name="Published party share"
                unit="%"
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  border: "1px solid rgba(20, 36, 59, 0.15)",
                  borderRadius: "4px",
                  background: "rgba(255, 255, 255, 0.9)",
                }}
                formatter={(value, name, item) => {
                  const point = item?.payload as ScatterPoint | undefined;
                  if (name === "share" && point) {
                    return [
                      `${point.share.toFixed(0)}% \u00b1 ${point.marginOfErrorPoints.toFixed(1)}pp (estimated from sample size)`,
                      `${point.pollster} \u00b7 ${point.fieldworkLabel}`,
                    ];
                  }
                  return [String(value), String(name)];
                }}
                labelFormatter={(value) => formatTooltipDate(Number(value))}
              />
              {seriesByParty.map((series) => (
                <Scatter
                  key={series.key}
                  name={series.meta.label}
                  data={series.points}
                  fill={series.meta.color}
                  line={false}
                  isAnimationActive={false}
                >
                  <ErrorBar
                    dataKey="moeHigh"
                    direction="y"
                    width={4}
                    strokeWidth={1.5}
                    stroke={series.meta.color}
                  />
                </Scatter>
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </ClientOnlyChart>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            Per-poll party shares with sample-size-derived margin of error, one row per
            party per publication.
          </caption>
          <thead>
            <tr className="border-b border-black/20 text-left text-xs uppercase tracking-[0.06em] text-gray-500">
              <th scope="col" className="py-2 pr-4">Pollster</th>
              <th scope="col" className="py-2 pr-4">Fieldwork</th>
              <th scope="col" className="py-2 pr-4">Party</th>
              <th scope="col" className="py-2 pr-4">Share</th>
              <th scope="col" className="py-2 pr-4">Margin of error (95% CI, est. from n)</th>
            </tr>
          </thead>
          <tbody>
            {polls.flatMap((poll) =>
              partyOrder
                .filter((key) => typeof poll.parties[key] === "number")
                .map((key) => {
                  const share = poll.parties[key] as number;
                  const moe = marginOfErrorFromSampleSize(poll.sampleSize);
                  return (
                    <tr key={`${poll.id}-${key}`} className="border-b border-black/10">
                      <td className="py-1.5 pr-4">{poll.pollster}</td>
                      <td className="py-1.5 pr-4">{fieldworkLabel(poll)}</td>
                      <td className="py-1.5 pr-4">{partyMeta[key].label}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{share.toFixed(0)}%</td>
                      <td className="py-1.5 pr-4 tabular-nums">
                        &plusmn;{moe.marginOfErrorPoints.toFixed(1)}pp
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-gray-600">
        {seriesByParty.map((series) => (
          <span key={series.key} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: series.meta.color }}
            />
            {series.meta.label}
          </span>
        ))}
      </div>
      <p className="mt-3 max-w-3xl px-1 text-xs leading-5 text-gray-500">
        Margin of error is estimated from each poll&apos;s disclosed sample size using the
        standard formula for a simple-random-sample proportion at 95% confidence
        (&plusmn;1.96&times;&radic;(0.5&times;0.5/n)), not a figure published by the pollster.
        Pollsters state their own uncertainty in different, non-numeric terms -- see each
        poll&apos;s uncertainty statement in the evidence register below.
      </p>
    </figure>
  );
}
