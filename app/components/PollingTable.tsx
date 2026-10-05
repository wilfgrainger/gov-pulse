/**
 * Aligned party-column table of primary poll publications.
 * Corrections are separate rows. No average. No betting markets.
 */
"use client";

import {
  buildPollingTable,
  distinctPollsters,
  POLLING_TABLE_PARTY_LABELS,
  type PollingTablePollInput,
} from "@/app/lib/pollingTable";
import type { PollCorrection } from "@/app/lib/pollingLab";

function formatDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function fieldworkLabel(start: string, end: string) {
  return start === end ? formatDate(end) : `${formatDate(start)}–${formatDate(end)}`;
}

export default function PollingTable({
  polls,
  corrections = [],
}: {
  polls: readonly PollingTablePollInput[];
  corrections?: readonly PollCorrection[];
}) {
  const table = buildPollingTable(polls, corrections);
  const pollsters = distinctPollsters(table);

  if (table.rows.length === 0) {
    return (
      <section role="status" className="border-l-4 border-accent bg-white p-6" aria-labelledby="polling-table-empty">
        <h3 id="polling-table-empty" className="text-xl font-semibold">No verified poll publications for the table</h3>
        <p className="mt-2 text-sm leading-6 text-gray-700">
          A share cannot appear without a primary source URL. No polling average is shown. Betting markets are absent.
        </p>
        {table.omittedWithoutSource > 0 ? (
          <p className="mt-2 text-xs text-gray-600">
            {table.omittedWithoutSource} record{table.omittedWithoutSource === 1 ? "" : "s"} omitted for missing source links.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section aria-labelledby="polling-table-title" className="border-y border-black/15 bg-white">
      <div className="mb-4 border-b border-black/15 pb-3">
        <p className="text-sm font-semibold text-accent">Primary publications</p>
        <h3 id="polling-table-title" className="mt-1 text-2xl font-semibold">
          Polling table
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">
          Each row is one named publication{pollsters.length >= 2 ? ` from ${pollsters.join(" or ")}` : ""}.
          Party columns stay aligned. public-data.org does not compute a polling average or seat forecast.
          Correction notices appear as their own rows. Betting markets are absent.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">
            Verified primary voting-intention publications with aligned party shares and source links. No average.
          </caption>
          <thead>
            <tr className="border-b-2 border-foreground text-left text-xs uppercase tracking-wide text-gray-600">
              <th scope="col" className="py-2 pr-3">Pollster</th>
              <th scope="col" className="py-2 pr-3">Fieldwork</th>
              <th scope="col" className="py-2 pr-3">Sample</th>
              {table.partyColumns.map((partyId) => (
                <th key={partyId} scope="col" className="py-2 pr-2 text-right tabular-nums">
                  {POLLING_TABLE_PARTY_LABELS[partyId]}
                </th>
              ))}
              <th scope="col" className="py-2 pl-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${row.kind}-${row.id}`} className="border-b border-line align-top">
                <th scope="row" className="py-3 pr-3 text-left font-semibold">
                  {row.pollster}
                  {row.kind === "correction" ? (
                    <span className="mt-1 block text-xs font-normal text-gray-600">
                      Correction · {row.title}
                    </span>
                  ) : null}
                </th>
                <td className="py-3 pr-3">
                  {row.kind === "publication"
                    ? fieldworkLabel(row.fieldworkStart, row.fieldworkEnd)
                    : row.observationPeriod}
                  <span className="mt-1 block text-xs text-gray-600">
                    {row.kind === "publication"
                      ? row.publicationDate
                        ? `Published ${formatDate(row.publicationDate)}`
                        : "Publication date not disclosed"
                      : `Corrected ${formatDate(row.correctedAt)}`}
                  </span>
                </td>
                <td className="py-3 pr-3 tabular-nums">
                  {row.kind === "publication" ? row.sampleSize.toLocaleString("en-GB") : "—"}
                  <span className="mt-1 block text-xs text-gray-600">{row.geography}</span>
                </td>
                {table.partyColumns.map((partyId) => {
                  const share = row.shares[partyId];
                  const original =
                    row.kind === "correction" ? row.originalShares[partyId] : undefined;
                  return (
                    <td key={partyId} className="py-3 pr-2 text-right tabular-nums">
                      {share === undefined ? "—" : `${share}%`}
                      {original !== undefined && original !== share ? (
                        <span className="mt-1 block text-xs text-gray-500 line-through">{original}%</span>
                      ) : null}
                    </td>
                  );
                })}
                <td className="py-3 pl-2">
                  <a
                    className="font-semibold underline underline-offset-4"
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {row.kind === "correction" ? "Correction notice" : "Primary tables"}
                    {" "}↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.omittedWithoutSource > 0 ? (
        <p className="mt-3 text-xs text-gray-600" role="status">
          {table.omittedWithoutSource} record{table.omittedWithoutSource === 1 ? "" : "s"} omitted because a share cannot appear without a source URL.
        </p>
      ) : null}
      <p className="sr-only">
        includesAverage={String(table.includesAverage)}; includesBettingMarkets={String(table.includesBettingMarkets)}
      </p>
    </section>
  );
}
