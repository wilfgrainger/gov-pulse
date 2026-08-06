"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ClientOnlyChart from "@/app/components/ClientOnlyChart";
import { METRICS_SNAPSHOT_PATH } from "@/app/lib/config";

export type FinancialChartPoint = {
  observedAt: number;
  period: string;
  [key: string]: string | number | null;
};

export type FinancialChartSeries = {
  key: string;
  label: string;
  color: string;
  lineType?: "linear" | "stepAfter";
  dashed?: boolean;
};

type Props = {
  title: string;
  description: string;
  data: FinancialChartPoint[];
  series: FinancialChartSeries[];
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  referenceValue?: number;
  referenceLabel?: string;
  downloadLabel?: string;
  heightClass?: string;
};

function formatAxisDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatTooltipDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function FinancialTimeSeriesChart({
  title,
  description,
  data,
  series,
  valueFormatter,
  axisFormatter = valueFormatter,
  referenceValue,
  referenceLabel,
  downloadLabel = "Download published data (JSON)",
  heightClass = "h-[300px]",
}: Props) {
  const first = data.at(0);
  const latest = data.at(-1);
  const range =
    first && latest ? `${first.period} to ${latest.period}` : "Published history unavailable";

  return (
    <figure className="border-y border-black/20 bg-[#fbfaf7] py-5">
      <figcaption className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h4 className="text-xl font-semibold tracking-[-0.015em]">{title}</h4>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">{description}</p>
        </div>
        <p className="font-mono text-xs tabular-nums text-gray-500">{range}</p>
      </figcaption>
      <div
        role="img"
        aria-label={`${title}. ${description}. Period shown: ${range}.`}
        className="border-t border-black/10 pt-3"
      >
        <ClientOnlyChart heightClass={heightClass}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 640, height: 300 }}
          >
            <LineChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#d8d4cc" strokeDasharray="2 4" />
              <XAxis
                dataKey="observedAt"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatAxisDate}
                tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: "#5f5b55" }}
                axisLine={{ stroke: "#111827", strokeWidth: 1 }}
                tickLine={false}
                tickCount={6}
                minTickGap={44}
              />
              <YAxis
                tickFormatter={axisFormatter}
                tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: "#5f5b55" }}
                axisLine={false}
                tickLine={false}
                width={62}
                domain={["auto", "auto"]}
              />
              {referenceValue !== undefined ? (
                <ReferenceLine
                  y={referenceValue}
                  stroke="#8b8680"
                  strokeDasharray="4 4"
                  label={
                    referenceLabel
                      ? { value: referenceLabel, position: "insideTopRight", fontSize: 10, fill: "#5f5b55" }
                      : undefined
                  }
                />
              ) : null}
              <Tooltip
                cursor={{ stroke: "#8b8680", strokeWidth: 1 }}
                contentStyle={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  border: "1px solid rgba(23, 34, 52, 0.15)",
                  borderRadius: "4px",
                  background: "rgba(255, 255, 255, 0.85)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
                }}
                labelFormatter={(value) => formatTooltipDate(Number(value))}
                formatter={(value, name) => [
                  typeof value === "number" ? valueFormatter(value) : "Not available",
                  String(name),
                ]}
              />
              {series.map((entry) => (
                <Line
                  key={entry.key}
                  type={entry.lineType ?? "linear"}
                  dataKey={entry.key}
                  name={entry.label}
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeDasharray={entry.dashed ? "5 4" : undefined}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 1, fill: "#fff" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ClientOnlyChart>
      </div>
      {latest ? (
        <p className="sr-only">
          Latest published values for {latest.period}:{" "}
          {series
            .map((entry) => {
              const value = latest[entry.key];
              return `${entry.label}: ${typeof value === "number" ? valueFormatter(value) : "not available"}`;
            })
            .join("; ")}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-gray-600">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {series.map((entry) => (
            <span key={entry.key} className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-5"
                style={{ backgroundColor: entry.color }}
              />
              {entry.label}
            </span>
          ))}
        </div>
        <a
          href={METRICS_SNAPSHOT_PATH}
          download
          className="font-semibold underline decoration-black/30 underline-offset-4 hover:decoration-black"
        >
          {downloadLabel}
        </a>
      </div>
    </figure>
  );
}
