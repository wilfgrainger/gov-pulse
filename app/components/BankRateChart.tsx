"use client";

import FinancialTimeSeriesChart, { type FinancialChartPoint } from "@/app/components/FinancialTimeSeriesChart";

type BankRateChartProps = {
  publisher: string;
  sourceUrl: string;
  publishedAt: string;
  period: string;
  revisionStatus: string;
  data: FinancialChartPoint[];
};

export default function BankRateChart({ publisher, sourceUrl, publishedAt, period, revisionStatus, data }: BankRateChartProps) {
  const citation = `${publisher} · ${sourceUrl} · published ${publishedAt} · observation period ${period} · ${revisionStatus}; this is not a household borrowing rate.`;
  return <FinancialTimeSeriesChart
    title="Bank Rate: published decisions"
    description="The Bank of England policy rate, plotted as dated official decisions. It does not estimate a household borrowing rate."
    citation={citation}
    data={data}
    series={[{ key: "value", label: "Bank Rate", color: "#08766c", lineType: "stepAfter" }]}
    valueFormatter={(value) => `${value.toFixed(2)}%`}
    showEvents={false}
  />;
}
