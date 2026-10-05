"use client";

import { useState } from "react";
import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import MetricsStatus from "@/app/components/MetricsStatus";
import PollingPublicationChart from "@/app/components/PollingPublicationChart";
import PollingTable from "@/app/components/PollingTable";
import { barWidthPercent } from "@/app/lib/chartModel";
import {
  acceptedCorrections,
  FALLBACK,
  fieldworkLabel,
  PARTY_META,
  formatDate,
  publicationDateLabel,
  rankedParties,
  sourceStatusLabel,
  validPayload,
  type PartyKey,
  type PollSource,
  type PrimaryPoll,
} from "@/app/lib/electionPollingSupport";
import {
  filterPollingPublications,
  pollingLabOptions,
  serializePollingCorrectionCsv,
  serializePollingCorrectionJson,
} from "@/app/lib/pollingLab";
import { useMetrics } from "@/app/lib/useMetrics";

export default function ElectionPolling() {
  const metrics = useMetrics("electionPolling", FALLBACK);
  const data = metrics.data;
  const correctionHistory = acceptedCorrections();
  const valid = metrics.isLive && metrics.cacheState === "fresh" && validPayload(data);
  const allPolls = valid ? (data.polls as PrimaryPoll[]) : [];
  const [filters, setFilters] = useState({ pollster: "all", from: "", to: "", publicationFrom: "", publicationTo: "" });
  const pollsters = pollingLabOptions(allPolls);
  const polls = filterPollingPublications(allPolls, filters);
  const latest = polls[0] ?? null;
  const parties = latest ? rankedParties(latest) : [];
  const leader = parties[0] ?? null;

  function downloadCorrections(format: "csv" | "json") {
    const content = format === "csv"
      ? serializePollingCorrectionCsv(correctionHistory)
      : serializePollingCorrectionJson(correctionHistory);
    const mime = format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `poll-correction-history.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const pollingFilters = valid ? (
    <section aria-labelledby="polling-lab-title" className="border-y border-foreground bg-white p-5 md:p-6">
      <p className="eyebrow">Explore the source publications</p>
      <h3 id="polling-lab-title" className="mt-2 text-2xl font-bold">Polling lab</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">
        Filter actual pollster releases by publisher, fieldwork window and disclosed publication date. Each result remains one named publication; no poll average or seat forecast is calculated.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-sm font-semibold">
          <span>Pollster</span>
          <select aria-label="Filter polling by pollster" value={filters.pollster} onChange={(event) => setFilters((current) => ({ ...current, pollster: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3">
            <option value="all">All verified pollsters</option>
            {pollsters.map((pollster) => <option key={pollster} value={pollster}>{pollster}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          <span>Fieldwork from</span>
          <input aria-label="Polling fieldwork from" type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          <span>Fieldwork to</span>
          <input aria-label="Polling fieldwork to" type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          <span>Published from</span>
          <input aria-label="Polling publication from" type="date" value={filters.publicationFrom} onChange={(event) => setFilters((current) => ({ ...current, publicationFrom: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          <span>Published to</span>
          <input aria-label="Polling publication to" type="date" value={filters.publicationTo} onChange={(event) => setFilters((current) => ({ ...current, publicationTo: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3" />
        </label>
      </div>
      <p className="mt-3 text-sm text-gray-600" aria-live="polite">Showing {polls.length} of {allPolls.length} verified publications.</p>
      {Array.isArray((data as { sources?: unknown }).sources) ? (
        <ul aria-label="Pollster source status" className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
          {(data as { sources: PollSource[] }).sources.map((source) => <li key={source.pollster}>{sourceStatusLabel(source)}</li>)}
        </ul>
      ) : null}
    </section>
  ) : null;

  return (
    <div className="space-y-8">
      {valid && polls.length === 0 ? (
        <>
          {pollingFilters}
          <section role="status" className="border-l-4 border-accent bg-white p-6">
            <h3 className="text-xl font-semibold">No poll publications match these filters</h3>
            <p className="mt-2 text-sm text-gray-700">Widen the fieldwork window or select another verified pollster. No values are filled in between publications.</p>
          </section>
        </>
      ) : latest && leader ? (
        <>
          <section aria-labelledby="polling-briefing-title" className="polling-lead grid min-w-0 gap-6 border-y-2 border-foreground bg-[#fff2df] p-4 sm:p-6 lg:grid-cols-[minmax(16rem,0.82fr)_minmax(0,1.18fr)]">
            <div className="flex min-w-0 flex-col justify-center">
              <p className="eyebrow">Latest verified poll · {latest.pollster}</p>
              <h3 id="polling-briefing-title" className="font-display mt-3 text-3xl leading-tight sm:text-4xl">{PARTY_META[leader[0]].label}</h3>
              <p className="mt-1 w-fit border-l-[0.45rem] pl-3 text-6xl font-extrabold leading-none tracking-[-0.055em] text-[#14243b] sm:text-7xl" style={{ borderColor: PARTY_META[leader[0]].color }}>{leader[1].toFixed(0)}%</p>
              <p className="mt-4 max-w-md text-sm leading-6 text-gray-700">{latest.pollster} reports {PARTY_META[leader[0]].label} at {leader[1].toFixed(0)}%. One poll publication, not a polling average.</p>
              <p className="mt-3 text-xs font-semibold leading-5 text-gray-600">
                Fieldwork {fieldworkLabel(latest)} · {latest.sampleSize.toLocaleString("en-GB")} {latest.population}<br />
                {publicationDateLabel(latest)} · {latest.geography} · {latest.mode ?? "Mode not disclosed"}.
                {latest.sampleSizeNote ? <><br />{latest.sampleSizeNote}</> : null}
              </p>
            </div>
            <section aria-labelledby="poll-results-title" className="min-w-0 border-t border-black/15 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="mb-4">
                <p className="eyebrow">Published headline result</p>
                <h4 id="poll-results-title" className="mt-2 text-lg font-bold sm:text-xl">Party shares · latest verified publication</h4>
              </div>
              <div className="space-y-3">
                {parties.map(([key, share]) => (
                  <div key={key} className="grid grid-cols-[minmax(6.5rem,9rem)_minmax(3rem,1fr)_2.8rem] items-center gap-2 sm:grid-cols-[9rem_1fr_3.5rem] sm:gap-3">
                    <span className="truncate text-xs font-semibold sm:text-sm">{PARTY_META[key].label}</span>
                    <div className="h-4 border border-black/20 bg-white" aria-hidden="true">
                      <div className="h-full" style={{ width: `${barWidthPercent(share, 100)}%`, backgroundColor: PARTY_META[key].color }} />
                    </div>
                    <span className="text-right font-mono text-xs font-bold tabular-nums sm:text-sm">{share.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </section>
          </section>
          {pollingFilters}
          <section aria-labelledby="poll-change-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4 id="poll-change-title" className="mt-1 text-2xl font-semibold">One current publication; no trend is inferred</h4>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-700">The latest accepted publication places {PARTY_META[leader[0]].label} at {leader[1].toFixed(0)}%. public-data.org does not compare this with a differently designed poll or claim a movement from one observation.</p>
          </section>
          <section aria-labelledby="poll-uncertainty-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Uncertainty over time</p>
              <h4 id="poll-uncertainty-title" className="mt-1 text-2xl font-semibold">Individual publications and disclosed uncertainty, not an average</h4>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-700">Each point below is one verified primary poll publication, kept separate from every other publication. public-data.org does not compute, show, or imply a polling average or composite line across these points.</p>
            {polls.length < 2 ? (
              <p role="status" className="mt-4 border-l-2 border-foreground/30 pl-4 text-sm leading-6 text-gray-600">A timeline needs more than one verified poll publication. The latest result and original publication remain available on this page.</p>
            ) : (
              <div className="mt-4">
                <PollingPublicationChart polls={polls} partyMeta={PARTY_META} partyOrder={Object.keys(PARTY_META) as PartyKey[]} />
              </div>
            )}
          </section>
          <section aria-labelledby="poll-method-title" className="border-l-4 border-foreground pl-4">
            <h3 id="poll-method-title" className="text-lg font-semibold">Evidence method</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">public-data.org does not scrape Wikipedia or calculate an unweighted average. It displays each accepted British Polling Council member publication separately with its direct source, fieldwork, sample and method.</p>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500">Electoral compliance: Under Section 66A of the Representation of the People Act 1983, it is a criminal offence to publish any exit poll or forecast of how people have voted on a parliamentary election day before the close of polls (10:00 PM). public-data.org does not publish exit polls or voting estimates on polling days before the close of polls.</p>
          </section>
          <CoreEvidenceExplanation
            idPrefix="election-poll"
            why={<p>Voting-intention polls are snapshots of stated preference and can show the shape of public opinion at the time of fieldwork. They do not directly forecast seats, turnout or the eventual election result.</p>}
            definition={<p>{latest.questionText ?? "Question wording is not disclosed in this publication."} The displayed headline uses this method: {latest.headlineMethod}. Read the pollster&apos;s <a className="font-semibold underline underline-offset-4" href={latest.methodologyUrl} target="_blank" rel="noopener noreferrer">methodology</a>.</p>}
            unit="Published party share (%)"
            geography={latest.geography}
            interpretation={<p>Party shares describe this publication only. Differences of a few percentage points may fall within the poll&apos;s stated uncertainty and should not be treated as a durable trend.</p>}
            caveat={<p>{latest.uncertainty ?? "No publication-specific numeric interval was verified, so no uncertainty interval is shown. Sample size alone is not used to estimate one."}</p>}
            sourceLabel={`Open ${latest.pollster} publication`}
            sourceUrl={latest.sourceUrl}
            sourceDate={`${publicationDateLabel(latest)} · fieldwork ${fieldworkLabel(latest)}`}
            explainLabel="Explain this number"
          />
          <PollingTable polls={polls} corrections={correctionHistory} />
        </>
      ) : (
        <section role="status" className="border-y-2 border-foreground bg-[#e8f2ef] p-5 md:p-6">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-8">
            <div>
              <p className="eyebrow !text-[#08766c]">Evidence status</p>
              <h3 className="mt-2 text-2xl font-bold leading-tight">Current primary polling evidence unavailable</h3>
            </div>
            <p className="text-sm leading-6 text-gray-700">No complete verified poll publication qualifies for the current window. Results return when a primary release passes the source and date checks; older polls and secondary averages are not presented as current.</p>
          </div>
        </section>
      )}
      {correctionHistory.length > 0 ? (
        <section aria-labelledby="poll-correction-history-title" className="border-y-2 border-foreground bg-white p-5 md:p-6">
          <p className="eyebrow">Publisher-documented historical change</p>
          <h3 id="poll-correction-history-title" className="mt-2 text-2xl font-bold">Poll correction history</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">These archived corrections are separate from current polling and do not extend a poll&apos;s freshness. Values below reproduce the publisher&apos;s own before-and-after notice; linked original tables may no longer be available.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
            <button type="button" onClick={() => downloadCorrections("csv")} className="min-h-11 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Download correction history CSV</button>
            <button type="button" onClick={() => downloadCorrections("json")} className="min-h-11 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Download correction history JSON</button>
          </div>
          <div className="mt-4 space-y-5">
            {correctionHistory.map((correction) => (
              <article key={correction.id} className="border-t border-line pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-lg font-semibold">{correction.title}</h4>
                  <p className="font-mono text-xs text-gray-600">{correction.pollster} · {correction.geography} · {correction.observationPeriod} · corrected {formatDate(correction.correctedAt)}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-700">{correction.reason}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">{correction.measure} results before and after the publisher correction</caption>
                    <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-gray-600"><th scope="col" className="py-2 pr-4">Party</th><th scope="col" className="py-2 pr-4">Originally reported</th><th scope="col" className="py-2">Corrected</th></tr></thead>
                    <tbody>{correction.results.map((result) => <tr key={result.partyId} className="border-b border-line"><th scope="row" className="py-2 pr-4 text-left font-medium">{result.label}</th><td className="py-2 pr-4 tabular-nums">{result.original}{correction.unit}</td><td className="py-2 tabular-nums">{result.corrected}{correction.unit}</td></tr>)}</tbody>
                  </table>
                </div>
                <a className="mt-3 inline-block min-h-11 text-sm font-semibold underline underline-offset-4" href={correction.sourceUrl} target="_blank" rel="noopener noreferrer">{correction.pollster} correction notice ↗</a>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <MetricsStatus section="electionPolling" status={metrics} showCurrentness={valid} />
    </div>
  );
}
