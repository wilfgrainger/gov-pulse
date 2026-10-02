import Link from "next/link";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import { availableMeasures, type MeasureCatalog } from "@/app/lib/measureCatalog";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

type EconomicSeries = { id: string; label: string; value: number | null; unit: string; status: string; period: string; sourceUrl: string; publisher: string; publishedAt: string; revisionStatus: string; history: { period: string; observedAt: string; value: number | null }[] };

export default function CostOfLivingLens({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const catalog = snapshot?.meta.measureCatalog as MeasureCatalog | undefined;
  const measures = catalog ? availableMeasures(catalog) : [];
  const inflation = measures.find((measure) => measure.id === "inflation");
  const realPay = measures.find((measure) => measure.id === "regularPayRealGrowth");
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
    {realPay ? <EvidenceFigure measure={realPay} title="Real regular pay growth: published observations" description="ONS regular pay growth adjusted directly using CPIH. It remains separate from consumer prices and household budgets." window={{ start: realPay.points[0]?.observedAt ?? realPay.observationPeriod.start, end: realPay.points.at(-1)?.observedAt ?? realPay.observationPeriod.end }} variant="line"/> : <p role="status" className="border-l-4 border-accent bg-white p-5 text-sm">The real-pay catalog record is unavailable in this edition.</p>}
    {bank?.status === "current" && bankHistory.length ? <FinancialTimeSeriesChart title="Bank Rate: published decisions" description="The Bank of England policy rate, plotted as dated official decisions. It does not estimate a household borrowing rate." citation={`${bank.publisher} · ${bank.sourceUrl} · published ${bank.publishedAt} · observation period ${bank.period} · ${bank.revisionStatus}; this is not a household borrowing rate.`} data={bankHistory} series={[{ key: "value", label: "Bank Rate", color: "#08766c", lineType: "stepAfter" }]} valueFormatter={(value) => `${value.toFixed(2)}%`} showEvents={false}/> : <p role="status" className="border-l-4 border-accent bg-white p-5 text-sm">Bank Rate history is unavailable or expired in this edition.</p>}
    <aside aria-labelledby="rent-source-status" className="border-l-4 border-accent bg-[#fff2df] p-5 md:p-7"><p className="eyebrow">Housing costs</p><h2 id="rent-source-status" className="mt-2 text-2xl font-black">Official private-rent history is not yet verified</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700">This edition has no validated ONS private-rent series. We do not estimate a household rent, mortgage payment or personal inflation basket. The official rent collector remains blocked pending a verified publisher route and live source response.</p><Link href="/sources/" className="mt-4 inline-block font-bold underline">Review source coverage →</Link></aside>
  </div>;
}
