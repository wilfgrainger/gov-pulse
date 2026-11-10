"use client";

import { useRef } from "react";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import type { ChartMetadata } from "@/app/lib/chartExport";

/** CSV/JSON download of the rank table shown beside it (data only; there is no chart image). */
export default function MeasureTableExport({ chartMetadata }: { chartMetadata: ChartMetadata }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref} className="mt-3"><ChartExportButtons containerRef={ref} chartMetadata={chartMetadata} dataOnly /></div>;
}
