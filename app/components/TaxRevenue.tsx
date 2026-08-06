"use client";

import { useState } from "react";
import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";
import procurementData from "@/data/contracts-procurement/procurement-data.json";

const FALLBACK = {
  available: false,
  headline: {
    period: "",
    observedAt: 0,
    releaseDate: "",
    receiptsBillion: 0,
    yearChangeBillion: 0,
  },
  history: [] as Array<{
    period: string;
    observedAt: number;
    receiptsBillion: number;
  }>,
  methodology: {
    measure: "",
    status: "",
    caveat: "",
  },
  source: {
    bulletinUrl: "",
    landingUrl: "",
  },
};

function parseDateOnlyUtc(value: unknown) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : new Date(Number.NaN);
}

function formatReleaseDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(parseDateOnlyUtc(value));
}

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `£${(value / 1_000_000_000).toFixed(2)}bn`;
  }
  return `£${(value / 1_000_000).toFixed(1)}m`;
}

function validPayload(value: typeof FALLBACK) {
  return (
    value?.available === true &&
    typeof value.headline?.period === "string" &&
    value.headline.period.trim().length > 0 &&
    typeof value.headline.observedAt === "number" &&
    Number.isFinite(value.headline.observedAt) &&
    !Number.isNaN(parseDateOnlyUtc(value.headline.releaseDate).getTime()) &&
    typeof value.headline.receiptsBillion === "number" &&
    Number.isFinite(value.headline.receiptsBillion) &&
    value.headline.receiptsBillion >= 0 &&
    typeof value.headline.yearChangeBillion === "number" &&
    Number.isFinite(value.headline.yearChangeBillion) &&
    Array.isArray(value.history) &&
    value.history.length >= 13 &&
    value.history.every(
      (point) =>
        typeof point.observedAt === "number" &&
        Number.isFinite(point.observedAt) &&
        typeof point.receiptsBillion === "number" &&
        Number.isFinite(point.receiptsBillion)
    ) &&
    typeof value.methodology?.measure === "string" &&
    typeof value.methodology?.caveat === "string" &&
    typeof value.source?.bulletinUrl === "string" &&
    value.source.bulletinUrl.startsWith("https://www.ons.gov.uk/")
  );
}

type TabId = "receipts" | "spending" | "contracts" | "outsourcers";

export default function TaxRevenue() {
  const metrics = useMetrics("taxRevenue", FALLBACK);
  const data = metrics.data;
  const valid = validPayload(data);
  const [activeTab, setActiveTab] = useState<TabId>("receipts");
  const [searchQuery, setSearchQuery] = useState("");
  const procurementVerified = false;

  const filteredContracts = procurementData.top50Contracts.filter((contract) => {
    const query = searchQuery.toLowerCase();
    return (
      contract.supplier.toLowerCase().includes(query) ||
      contract.authority.toLowerCase().includes(query) ||
      contract.sector.toLowerCase().includes(query) ||
      contract.description.toLowerCase().includes(query) ||
      contract.sourceNoticeId.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <nav aria-label="Tax and Spending Subsections" className="flex flex-wrap border-b border-black/15">
        <button
          onClick={() => setActiveTab("receipts")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "receipts"
              ? "border-accent text-accent"
              : "border-transparent text-gray-600 hover:text-black"
          }`}
        >
          ONS Receipts
        </button>
        <button
          onClick={() => setActiveTab("spending")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "spending"
              ? "border-accent text-accent"
              : "border-transparent text-gray-600 hover:text-black"
          }`}
        >
          Spending by Sector
        </button>
        <button
          onClick={() => setActiveTab("contracts")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "contracts"
              ? "border-accent text-accent"
              : "border-transparent text-gray-600 hover:text-black"
          }`}
        >
          Top 50 Contracts
        </button>
        <button
          onClick={() => setActiveTab("outsourcers")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "outsourcers"
              ? "border-accent text-accent"
              : "border-transparent text-gray-600 hover:text-black"
          }`}
        >
          Largest Outsourcers
        </button>
      </nav>

      {/* Tab Contents */}
      {activeTab === "receipts" && (
        <>
          {valid ? (
            <>
              <section aria-labelledby="receipts-briefing-title" className="border-y border-foreground py-6">
                <p className="text-sm font-semibold text-accent">Latest ONS public-finance release</p>
                <h3
                  id="receipts-briefing-title"
                  className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
                >
                  Central government receipts were £{data.headline.receiptsBillion.toFixed(1)}bn in {data.headline.period}.
                </h3>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
                  That was £{Math.abs(data.headline.yearChangeBillion).toFixed(1)}bn {data.headline.yearChangeBillion >= 0 ? "more" : "less"} than in the comparable month a year earlier.
                </p>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  Published {formatReleaseDate(data.headline.releaseDate)}. Public-finance estimates can be revised as more complete data arrive.
                </p>
              </section>

              <section aria-labelledby="receipts-numbers-title">
                <div className="mb-4 border-b border-black/15 pb-3">
                  <p className="text-sm font-semibold text-accent">What changed?</p>
                  <h4 id="receipts-numbers-title" className="mt-1 text-2xl font-semibold">
                    One monthly receipts measure, compared like for like
                  </h4>
                </div>
                <dl className="grid border-y border-black/20 md:grid-cols-2 md:divide-x md:divide-black/15">
                  <div className="p-4 md:p-5">
                    <dt className="text-sm text-gray-600">Central government receipts</dt>
                    <dd className="mt-1 text-4xl font-semibold tabular-nums">£{data.headline.receiptsBillion.toFixed(1)}bn</dd>
                    <dd className="mt-2 text-sm text-gray-600">{data.headline.period}</dd>
                  </div>
                  <div className="border-t border-black/15 p-4 md:border-l md:border-t-0 md:p-5">
                    <dt className="text-sm text-gray-600">Change from a year earlier</dt>
                    <dd className="mt-1 text-4xl font-semibold tabular-nums text-accent">
                      {data.headline.yearChangeBillion >= 0 ? "+" : "-"}£{Math.abs(data.headline.yearChangeBillion).toFixed(1)}bn
                    </dd>
                    <dd className="mt-2 text-sm text-gray-600">Same monthly measure and accounting basis.</dd>
                  </div>
                </dl>
              </section>

              <FinancialTimeSeriesChart
                title="Central government receipts: ten-year direction"
                description="Monthly ONS current receipts on a consistent cash basis. The seasonal pattern is why the annual comparison uses the same month one year earlier."
                data={data.history}
                series={[{ key: "receiptsBillion", label: "Monthly receipts", color: "#172234" }]}
                valueFormatter={(value) => `£${value.toFixed(1)}bn`}
                axisFormatter={(value) => `£${Math.round(value)}bn`}
              />

              <CoreEvidenceExplanation
                idPrefix="receipts"
                why={
                  <p>
                    Receipts help determine how much government must borrow to fund spending. A monthly receipts figure is not the same thing as the annual tax burden or an estimate of what an average person pays.
                  </p>
                }
                definition={<p>{data.methodology.measure}.</p>}
                unit="£ billions"
                geography="United Kingdom"
                interpretation={
                  <p>
                    The annual comparison uses the same monthly measure and accounting basis, so it shows whether receipts were higher or lower than one year earlier.
                  </p>
                }
                caveat={<p>{data.methodology.caveat}</p>}
                sourceLabel="ONS public-sector-finance bulletin"
                sourceUrl={data.source.bulletinUrl}
                sourceDate={`Published ${formatReleaseDate(data.headline.releaseDate)} · observation period ${data.headline.period}`}
              />
            </>
          ) : (
            <section role="status" className="border border-black/20 bg-white p-6">
              <h3 className="text-xl font-semibold">Current receipts estimate unavailable</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                public-data.org could not verify one complete current ONS public-finance release, so it is not showing the older annual estimate or a forecast.
              </p>
            </section>
          )}
        </>
      )}

      {activeTab === "spending" && procurementVerified && (
        <section aria-labelledby="spending-title" className="space-y-6">
          <div className="border-b border-black/15 pb-3">
            <p className="text-sm font-semibold text-accent">HM Treasury Spending Statistics</p>
            <h3 id="spending-title" className="text-2xl font-semibold">Government Spend by Sector and Department</h3>
            <p className="mt-1 text-sm text-gray-600">
              Annual departmental expenditure limits and budgets. Sourced from the HMT Public Expenditure Statistical Analyses (PESA).
            </p>
          </div>

          <div className="overflow-x-auto border border-black/20">
            <table className="min-w-full divide-y divide-black/15 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <tr>
                  <th scope="col" className="px-6 py-3">Sector</th>
                  <th scope="col" className="px-6 py-3">Responsible Department</th>
                  <th scope="col" className="px-6 py-3 text-right">Spend (£ Billion)</th>
                  <th scope="col" className="px-6 py-3">Fiscal Year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 bg-white">
                {procurementData.departmentSpend.map((row) => (
                  <tr key={`${row.department}-${row.sector}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-black">{row.sector}</td>
                    <td className="px-6 py-4 text-gray-700">{row.department}</td>
                    <td className="px-6 py-4 text-right font-mono font-semibold tabular-nums text-black">
                      £{row.spendBillion.toFixed(1)}bn
                    </td>
                    <td className="px-6 py-4 text-gray-600">{row.fiscalYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-l-4 border-foreground pl-4 text-xs text-gray-600">
            <p><strong>Source:</strong> HM Treasury Public Expenditure Statistical Analyses (PESA) 2024. Figures represent outturn and planned department budgets.</p>
          </div>
        </section>
      )}

      {activeTab === "contracts" && procurementVerified && (
        <section aria-labelledby="contracts-title" className="space-y-6">
          <div className="border-b border-black/15 pb-3">
            <p className="text-sm font-semibold text-accent">Find a Tender & Contracts Finder Register</p>
            <h3 id="contracts-title" className="text-2xl font-semibold">Top 50 Government Contracts Awarded (Last 12 Months)</h3>
            <p className="mt-1 text-sm text-gray-600">
              Procurement awards matching Cabinet Office disclosure standards, ranked by value.
            </p>
          </div>

          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search contracts by supplier, department, sector, or notice ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="overflow-x-auto border border-black/20">
            <table className="min-w-full divide-y divide-black/15 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-3 text-center">Rank</th>
                  <th scope="col" className="px-4 py-3">Supplier</th>
                  <th scope="col" className="px-4 py-3">Department / Authority</th>
                  <th scope="col" className="px-4 py-3 text-right">Award Value</th>
                  <th scope="col" className="px-4 py-3">Award Date</th>
                  <th scope="col" className="px-4 py-3">Details</th>
                  <th scope="col" className="px-4 py-3">Source Notice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 bg-white">
                {filteredContracts.length > 0 ? (
                  filteredContracts.map((contract) => (
                    <tr key={contract.rank} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-4 text-center font-mono font-medium text-gray-500">{contract.rank}</td>
                      <td className="px-4 py-4 font-semibold text-black">{contract.supplier}</td>
                      <td className="px-4 py-4 text-gray-700">{contract.authority}</td>
                      <td className="px-4 py-4 text-right font-mono font-semibold tabular-nums text-black">
                        {formatCurrency(contract.value)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600">{contract.awardDate}</td>
                      <td className="px-4 py-4 text-xs text-gray-600 max-w-xs">{contract.description}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs">
                        <a
                          href={contract.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline font-mono"
                        >
                          {contract.sourceNoticeId}
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No contracts found matching your search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-l-4 border-foreground pl-4 text-xs text-gray-600">
            <p><strong>Notice:</strong> This index lists only the 50 largest procurement awards published on Find a Tender in the last 12 months. All values represent contract award totals at the date of publication, subject to variation.</p>
          </div>
        </section>
      )}

      {activeTab === "outsourcers" && procurementVerified && (
        <section aria-labelledby="outsourcers-title" className="space-y-6">
          <div className="border-b border-black/15 pb-3">
            <p className="text-sm font-semibold text-accent">Cabinet Office Procurement Audit</p>
            <h3 id="outsourcers-title" className="text-2xl font-semibold">Largest Departmental Outsourcing Partners</h3>
            <p className="mt-1 text-sm text-gray-600">
              Aggregated strategic suppliers with the largest total contract award values by department.
            </p>
          </div>

          <div className="overflow-x-auto border border-black/20">
            <table className="min-w-full divide-y divide-black/15 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <tr>
                  <th scope="col" className="px-6 py-3">Department</th>
                  <th scope="col" className="px-6 py-3">Strategic Supplier</th>
                  <th scope="col" className="px-6 py-3 text-right">Total Awarded Value</th>
                  <th scope="col" className="px-6 py-3 text-center">Active Contracts</th>
                  <th scope="col" className="px-6 py-3">Key Sector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 bg-white">
                {procurementData.largestOutsourcers.map((row) => (
                  <tr key={`${row.department}-${row.supplier}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-black">{row.department}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{row.supplier}</td>
                    <td className="px-6 py-4 text-right font-mono font-semibold tabular-nums text-black">
                      £{row.totalValueMillion.toLocaleString()}m
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-gray-600">{row.contractsCount}</td>
                    <td className="px-6 py-4 text-gray-600">{row.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-l-4 border-foreground pl-4 text-xs text-gray-600">
            <p><strong>Note:</strong> Aggregations include only active major contracts awarded to strategic suppliers as defined by the Cabinet Office. Values exclude frameworks unless individual call-off awards are published.</p>
          </div>
        </section>
      )}

      {activeTab !== "receipts" && !procurementVerified && (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Procurement and spending data unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            These views are withheld until each dataset has its own verified primary feed, publication date, observation period and freshness status. The ONS receipts status does not validate procurement or spending claims.
          </p>
        </section>
      )}

      {/* Withdrawn sections description */}
      <section aria-labelledby="tax-withdrawn-title" className="border-l-4 border-foreground pl-4">
        <h3 id="tax-withdrawn-title" className="text-lg font-semibold">Tax breakdown and burden forecast withdrawn</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
          The previous page mixed a financial-year total, category estimates, a tax-to-GDP series, an average-per-person calculation and an OBR forecast. They remain unavailable until the period, accounting basis and source for each measure can be verified.
        </p>
      </section>

      <MetricsStatus section="taxRevenue" status={metrics} />
    </div>
  );
}

