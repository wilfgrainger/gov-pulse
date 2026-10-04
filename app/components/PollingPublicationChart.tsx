"use client";

import { useRef, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import ClientOnlyChart from "@/app/components/ClientOnlyChart";
import { fieldworkMidpointMs } from "@/app/lib/pollingDates";
import { buildPublicationExportPackage, timeAxisDomain, timeAxisTicks } from "@/app/lib/chartModel";

type PartyMeta = { label: string; color: string };

type PollLike = {
  id: string;
  pollster: string;
  fieldworkStart: string;
  fieldworkEnd: string;
  sampleSize: number;
  title: string;
  commissioner: string | null;
  questionText: string | null;
  publicationDate: string | null;
  publicationDateStatus: "published" | "not-disclosed";
  geography: string;
  population: string;
  mode: string | null;
  sampleSizeNote: string | null;
  headlineMethod: string;
  sourceUrl: string;
  methodologyUrl: string;
  uncertainty: string | null;
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
 * publication, plotted at its fieldwork midpoint. There is no line
 * connecting points, no fitted trend, and no averaging across polls --
 * each point stays independently traceable to its pollster and fieldwork
 * dates via the tooltip and the accessible data table below the chart.
 */
function buildSeries<PartyKey extends string>(polls: PollLike[], partyKey: PartyKey): ScatterPoint[] {
  return polls
    .map((poll) => {
      const share = poll.parties[partyKey];
      if (typeof share !== "number" || !Number.isFinite(share)) return null;
      return {
        pollId: poll.id,
        pollster: poll.pollster,
        fieldworkMid: fieldworkMidpointMs(poll.fieldworkStart, poll.fieldworkEnd),
        fieldworkLabel: fieldworkLabel(poll),
        share,
      } satisfies ScatterPoint;
    })
    .filter((point): point is ScatterPoint => point !== null);
}

export default function PollingPublicationChart<PartyKey extends string>({
  polls,
  partyMeta,
  partyOrder,
}: Props<PartyKey>) {
  const [selectedParties, setSelectedParties] = useState<Set<PartyKey>>(() => new Set(partyOrder));
  const availablePartyOrder = partyOrder.filter((key) => polls.some((poll) => typeof poll.parties[key] === "number"));
  const visiblePartyOrder = availablePartyOrder.filter((key) => selectedParties.has(key));
  const seriesByParty = visiblePartyOrder
    .map((key) => ({ key, meta: partyMeta[key], points: buildSeries(polls, key) }))
    .filter((series) => series.points.length > 0);

  const first = polls.at(-1);
  const latest = polls.at(0);
  const fieldworkMidpoints = polls.map((poll) => fieldworkMidpointMs(poll.fieldworkStart, poll.fieldworkEnd));
  const axisDomain = timeAxisDomain(fieldworkMidpoints);
  const axisTicks = timeAxisTicks(fieldworkMidpoints);
  const axisTickCount = new Set(fieldworkMidpoints).size === 1 ? 3 : 6;
  const firstPeriod = first ? fieldworkLabel(first) : undefined;
  const latestPeriod = latest ? fieldworkLabel(latest) : undefined;
  const range =
    firstPeriod && latestPeriod
      ? firstPeriod === latestPeriod
        ? firstPeriod
        : `${firstPeriod} to ${latestPeriod}`
      : "Published history unavailable";
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartTitle = "Individual poll publications by party share";
  const exportPackage = polls.length ? buildPublicationExportPackage({
    title: chartTitle,
    dateWindow: {
      start: polls.map((poll) => poll.fieldworkStart).toSorted()[0],
      end: polls.map((poll) => poll.fieldworkEnd).toSorted().at(-1)!,
    },
    publications: polls.map((poll) => ({
      id: poll.id,
      publisher: poll.pollster,
      title: poll.title,
      commissioner: poll.commissioner ?? null,
      questionText: poll.questionText ?? null,
      headlineMethod: poll.headlineMethod,
      population: poll.population,
      geography: poll.geography,
      mode: poll.mode ?? null,
      sampleSize: poll.sampleSize,
      sampleSizeNote: poll.sampleSizeNote ?? null,
      partyResults: Object.fromEntries(Object.entries(poll.parties).filter((entry): entry is [string, number] => visiblePartyOrder.includes(entry[0] as PartyKey) && typeof entry[1] === "number")),
      sourceUrl: poll.sourceUrl,
      methodologyUrl: poll.methodologyUrl,
      publishedAt: poll.publicationDate ?? null,
      publicationDateStatus: poll.publicationDate
        ? poll.publicationDateStatus ?? "published"
        : "not-disclosed",
      fieldworkStart: poll.fieldworkStart,
      fieldworkEnd: poll.fieldworkEnd,
      disclosures: [
        poll.uncertainty ?? "No publication-specific numeric uncertainty statement verified.",
      ],
    })),
    caveats: ["Each mark is one publisher-reported poll result; the sample count is not used to calculate uncertainty. No average or forecast is presented."],
  }) : undefined;

  return (
    <figure className="border-y border-black/20 bg-[#f7f9fb] py-5">
      <figcaption className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h4 className="text-xl font-semibold tracking-[-0.015em]">
            {chartTitle}
          </h4>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
            Every point is a pollster-reported party share at the fieldwork midpoint.
            The disclosed sample count is shown in the table; it is not treated as a
            simple random sample and is not used to calculate an uncertainty interval.
            See the evidence register for the pollster&apos;s own uncertainty statement.
          </p>
        </div>
        <p className="font-mono text-xs tabular-nums text-gray-500">{range}</p>
      </figcaption>
      <fieldset className="mb-3 border-t border-black/10 pt-3">
        <legend className="text-xs font-semibold text-gray-700">Show party results</legend>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {availablePartyOrder.map((key) => <label key={key} className="inline-flex min-h-8 items-center gap-2 text-sm"><input type="checkbox" aria-label={`Show ${partyMeta[key].label}`} checked={selectedParties.has(key)} onChange={() => setSelectedParties((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; })} className="size-4 accent-[#14243b]"/>{partyMeta[key].label}</label>)}
        </div>
        {visiblePartyOrder.length === 0 ? <p role="status" className="mt-2 text-sm text-gray-600">Select at least one party to show publication results.</p> : null}
      </fieldset>
      <div
        ref={chartContainerRef}
        role="img"
        aria-label={`Scatter plot of individual poll publications for ${visiblePartyOrder.map((key) => partyMeta[key].label).join(", ") || "no selected parties"}. Period shown: ${range}. No average, uncertainty interval or trend line is shown. See the data table below for exact per-poll values and sample counts.`}
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
                domain={axisDomain}
                hide={axisTicks !== undefined}
                tickFormatter={formatAxisDate}
                tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: "#586170" }}
                axisLine={{ stroke: "#111827", strokeWidth: 1 }}
                tickLine={false}
                tickCount={axisTickCount}
                minTickGap={44}
                name="Fieldwork midpoint"
              />
              <YAxis
                dataKey="share"
                type="number"
                tickFormatter={(value: number) => String(value)}
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
                      `${point.share.toFixed(0)}% (pollster-reported)`,
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
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </ClientOnlyChart>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            Per-poll party shares and disclosed sample size, one row per
            party per publication.
          </caption>
          <thead>
            <tr className="border-b border-black/20 text-left text-xs uppercase tracking-[0.06em] text-gray-500">
              <th scope="col" className="py-2 pr-4">Pollster</th>
              <th scope="col" className="py-2 pr-4">Fieldwork</th>
              <th scope="col" className="py-2 pr-4">Party</th>
              <th scope="col" className="py-2 pr-4">Share</th>
              <th scope="col" className="py-2 pr-4">Disclosed sample</th>
            </tr>
          </thead>
          <tbody>
            {polls.flatMap((poll) =>
              visiblePartyOrder
                .filter((key) => typeof poll.parties[key] === "number")
                .map((key) => {
                  const share = poll.parties[key] as number;
                  return (
                    <tr key={`${poll.id}-${key}`} className="border-b border-black/10">
                      <td className="py-1.5 pr-4">{poll.pollster}</td>
                      <td className="py-1.5 pr-4">{fieldworkLabel(poll)}</td>
                      <td className="py-1.5 pr-4">{partyMeta[key].label}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{share.toFixed(0)}%</td>
                      <td className="py-1.5 pr-4 tabular-nums">
                        {poll.sampleSize.toLocaleString("en-GB")}
                        {poll.sampleSizeNote ? <span className="block text-xs text-gray-600">{poll.sampleSizeNote}</span> : null}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600">
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
        <ChartExportButtons containerRef={chartContainerRef} title={chartTitle} exportPackage={exportPackage} />
      </div>
      <p className="mt-3 max-w-3xl px-1 text-xs leading-5 text-gray-500">
        The sample count does not establish a representative simple random sample.
        public-data.org does not calculate an uncertainty interval from it; see each
        pollster&apos;s publication-specific uncertainty statement in the evidence register.
      </p>
    </figure>
  );
}
