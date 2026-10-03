import Link from "next/link";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import BankRateChart from "@/app/components/BankRateChart";
import { availableMeasures, type MeasureCatalog, type MeasureRecord } from "@/app/lib/measureCatalog";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

type EconomicSeries = { id: string; label: string; value: number | null; unit: string; status: string; period: string; sourceUrl: string; publisher: string; publishedAt: string; revisionStatus: string; history: { period: string; observedAt: string; value: number | null }[] };

function latestMatchedObservation(left: MeasureRecord | undefined, right: MeasureRecord | undefined) {
  if (!left || !right) return null;
  const leftByDate = new Map(left.points.filter((point) => point.value !== null).map((point) => [point.observedAt, point]));
  return [...right.points]
    .filter((point) => point.value !== null && leftByDate.has(point.observedAt))
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .map((rightPoint) => ({ left: leftByDate.get(rightPoint.observedAt)!, right: rightPoint }))
    .at(-1) ?? null;
}

function pounds(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

function percent(value: number) {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)}%`;
}

export default function CostOfLivingLens({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const catalog = snapshot?.meta.measureCatalog as MeasureCatalog | undefined;
  const measures = catalog ? availableMeasures(catalog) : [];
  const inflation = measures.find((measure) => measure.id === "inflation");
  const realPay = measures.find((measure) => measure.id === "regularPayRealGrowth");
  const privateRent = measures.find((measure) => measure.id === "privateRentAnnualChange");
  const averageRent = measures.find((measure) => measure.id === "privateRentAverage");
  const housePriceChange = measures.find((measure) => measure.id === "housePriceChange");
  const housePriceAverage = measures.find((measure) => measure.id === "housePriceAverage");
  const matchedPricesAndRent = latestMatchedObservation(inflation, privateRent);
  const pulse = snapshot?.sentimentPulse as { series?: Record<string, EconomicSeries> } | undefined;
  const bank = pulse?.series?.bankRate;
  const bankHistory = bank?.history.map((point) => ({ observedAt: Date.parse(point.observedAt), period: point.period, value: point.value })) ?? [];
  return <div className="space-y-10">
    <section className="grid gap-4 border-y-2 border-foreground bg-white p-5 md:grid-cols-3 md:p-8">
      <div><p className="eyebrow">Prices</p><h2 className="mt-2 text-2xl font-black">CPI inflation</h2><p className="mt-3 text-sm leading-6 text-gray-700">The official annual CPI change describes a defined index, not any one household&apos;s costs.</p></div>
      <div><p className="eyebrow">Earnings</p><h2 className="mt-2 text-2xl font-black">Real regular pay</h2><p className="mt-3 text-sm leading-6 text-gray-700">ONS&apos;s CPIH-adjusted regular-pay growth series excludes bonuses and has its own reporting period.</p></div>
      <div><p className="eyebrow">Policy rate</p><h2 className="mt-2 text-2xl font-black">Bank Rate</h2><p className="mt-3 text-sm leading-6 text-gray-700">A Bank of England policy setting; it is not a mortgage or savings rate paid by every household.</p></div>
    </section>
    {inflation ? <EvidenceFigure measure={inflation} title="CPI inflation: published observations" description="Annual change in the Consumer Prices Index. This is an official price measure, not a personal household inflation rate." window={{ start: inflation.points[0]?.observedAt ?? inflation.observationPeriod.start, end: inflation.points.at(-1)?.observedAt ?? inflation.observationPeriod.end }} variant="line"/> : <p role="status" className="border-l-4 border-accent bg-white p-5 text-sm">The CPI catalog record is unavailable in this edition.</p>}
    {inflation && privateRent ? <section aria-labelledby="matched-price-rent-title" className="border-y border-line bg-white p-5 md:p-8">
      <p className="eyebrow">Matched observation · UK · annual change</p><h2 id="matched-price-rent-title" className="mt-2 text-2xl font-black">Prices and private rents: matched annual changes</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">Both series use annual percentage changes for the same observation month. CPI covers a broad consumer basket; PIPR measures rents paid for privately rented homes. Neither is a household-specific cost-of-living rate, and the series are not added together.</p>
      {matchedPricesAndRent ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[34rem] border-collapse text-left text-sm"><caption className="sr-only">Latest shared month of UK annual percentage changes</caption><thead><tr className="border-b border-foreground text-xs uppercase tracking-wide text-gray-600"><th scope="col" className="py-2 pr-4">Measure</th><th scope="col" className="py-2 pr-4">Observation month</th><th scope="col" className="py-2 pr-4">Annual change</th><th scope="col" className="py-2">Publisher</th></tr></thead><tbody>
        {[{ label: "CPI inflation", measure: inflation, point: matchedPricesAndRent.left }, { label: "Private rent change (PIPR)", measure: privateRent, point: matchedPricesAndRent.right }].map(({ label, measure, point }) => <tr key={measure.id} className="border-b border-line"><th scope="row" className="py-3 pr-4 font-semibold">{label}</th><td className="py-3 pr-4">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${point.observedAt}T00:00:00.000Z`))}</td><td className="py-3 pr-4 font-mono font-bold tabular-nums">{percent(point.value!)}</td><td className="py-3"><a className="underline" href={measure.sourceUrl}>{measure.publisher ?? "Primary source"}</a></td></tr>)}
      </tbody></table></div> : <p role="status" className="mt-4 text-sm">No shared current observation month is available for these two series.</p>}
    </section> : null}
    {privateRent || averageRent ? <section aria-labelledby="private-rent-title" className="space-y-5 border-y-2 border-foreground bg-white p-5 md:p-8">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.7fr)] md:items-end">
        <div><p className="eyebrow">Renting · ONS PIPR</p><h2 id="private-rent-title" className="mt-2 text-3xl font-black">Private rent</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">PIPR measures changes in rents paid for privately rented homes. Its average monthly rent is a separate level measure. Neither estimates what an individual household pays.</p></div>
        {averageRent ? <div className="border-l-4 border-accent bg-[#fff2df] p-4"><p className="text-sm font-semibold">Average monthly UK private rent · {averageRent.observationPeriod.label}</p><p className="mt-1 text-3xl font-black tabular-nums">{averageRent.value === null ? "Unavailable" : pounds(averageRent.value)}</p><p className="mt-2 text-xs leading-5 text-gray-700">{averageRent.caveats.join(" ")}</p><Link href={averageRent.sourceUrl} className="mt-3 inline-block text-sm font-bold underline">ONS bulletin · published {averageRent.publishedAt.slice(0, 10)} →</Link></div> : <p role="status" className="border-l-4 border-accent bg-[#fff2df] p-4 text-sm">Average UK private-rent level is unavailable in this edition.</p>}
      </div>
      {privateRent ? <><EvidenceFigure measure={privateRent} title="Private rent: annual change in published observations" description="Annual change in the ONS Price Index of Private Rents (PIPR). This series remains separate from CPI, pay and house-price measures." window={{ start: privateRent.points[0]?.observedAt ?? privateRent.observationPeriod.start, end: privateRent.points.at(-1)?.observedAt ?? privateRent.observationPeriod.end }} variant="line"/><p className="text-xs leading-5 text-gray-600">Source: <a className="underline" href={privateRent.sourceUrl}>Office for National Statistics, Private rent and house prices, UK</a> · published {privateRent.publishedAt.slice(0, 10)} · {privateRent.caveats.join(" ")}</p></> : <p role="status" className="text-sm">Private-rent annual-change history is unavailable in this edition.</p>}
    </section> : <aside aria-labelledby="rent-source-status" className="border-l-4 border-accent bg-[#fff2df] p-5 md:p-7"><p className="eyebrow">Housing costs</p><h2 id="rent-source-status" className="mt-2 text-2xl font-black">Verified private-rent evidence unavailable</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">This edition has no current, reconciled ONS private-rent publication. We do not estimate household rent, mortgage payments or a personal inflation basket.</p><Link href="/sources/" className="mt-4 inline-block font-bold underline">Review source coverage →</Link></aside>}
    {housePriceChange || housePriceAverage ? <section aria-labelledby="buying-title" className="space-y-5 border-y-2 border-foreground bg-white p-5 md:p-8">
      <div><p className="eyebrow">Buying · UK HPI</p><h2 id="buying-title" className="mt-2 text-3xl font-black">House prices</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">The average price level and annual index change describe the national UK housing market. Neither predicts an asking price, mortgage payment or a household&apos;s ability to buy.</p></div>
      {housePriceAverage ? <div className="max-w-md border-l-4 border-[#135f94] bg-[#eef4f8] p-4"><p className="text-sm font-semibold">Average UK house price · {housePriceAverage.observationPeriod.label}</p><p className="mt-1 text-3xl font-black tabular-nums">{housePriceAverage.value === null ? "Unavailable" : pounds(housePriceAverage.value)}</p><p className="mt-2 text-xs leading-5 text-gray-700">{housePriceAverage.caveats.join(" ")}</p><Link href={housePriceAverage.sourceUrl} className="mt-3 inline-block text-sm font-bold underline">ONS bulletin · published {housePriceAverage.publishedAt.slice(0, 10)} →</Link></div> : <p role="status" className="text-sm">Average UK house price is unavailable in this edition.</p>}
      {housePriceChange ? <EvidenceFigure measure={housePriceChange} title="House prices: published observations" description="Annual percentage change in the UK House Price Index. This transaction-based measure remains separate from private rents and CPI." window={{ start: housePriceChange.points[0]?.observedAt ?? housePriceChange.observationPeriod.start, end: housePriceChange.points.at(-1)?.observedAt ?? housePriceChange.observationPeriod.end }} variant="line"/> : <p role="status" className="text-sm">UK house-price annual-change history is unavailable in this edition.</p>}
    </section> : null}
    {realPay ? <EvidenceFigure measure={realPay} title="Real regular pay growth: published observations" description="ONS regular pay growth adjusted directly using CPIH. It remains separate from consumer prices and household budgets." window={{ start: realPay.points[0]?.observedAt ?? realPay.observationPeriod.start, end: realPay.points.at(-1)?.observedAt ?? realPay.observationPeriod.end }} variant="line"/> : <p role="status" className="border-l-4 border-accent bg-white p-5 text-sm">The real-pay catalog record is unavailable in this edition.</p>}
    {bank?.status === "current" && bankHistory.length ? <BankRateChart
      publisher={bank.publisher}
      sourceUrl={bank.sourceUrl}
      publishedAt={bank.publishedAt}
      period={bank.period}
      revisionStatus={bank.revisionStatus}
      data={bankHistory}
    /> : <p role="status" className="border-l-4 border-accent bg-white p-5 text-sm">Bank Rate history is unavailable or expired in this edition.</p>}
  </div>;
}
