"use client";

import { useState, useSyncExternalStore, type RefObject } from "react";
import {
  canRasterizeToPng,
  chartExportFilename,
  downloadChartPng,
  downloadChartSvg,
  findChartSvg,
  serializeChartMetadataCsv,
} from "@/app/lib/chartExport";
import type { ChartMetadata } from "@/app/lib/chartExport";
import { exportPackageCitation, serializeMeasureExportCsv, serializeMeasureExportJson, type ExportPackage } from "@/app/lib/chartModel";

type Props = {
  /** Ref to the chart's container element (holds the rendered <svg>). */
  containerRef: RefObject<HTMLElement | SVGSVGElement | null>;
  /** Chart title, embedded as the exported file's accessible <title>. */
  title?: string;
  exportPackage?: ExportPackage;
  /** Source-citation line reused verbatim from the chart's own citation, if any. */
  citation?: string;
  chartMetadata?: ChartMetadata;
  className?: string;
  /** Hide image exports when this component is used to export missing data only. */
  dataOnly?: boolean;
};

const subscribeToPngSupport = () => () => {};
const getServerPngSupport = () => false;
function getClientPngSupport() {
  return canRasterizeToPng();
}

/**
 * "Download chart as image" controls, alongside a chart's existing
 * CSV/JSON download link. Finds the chart's live rendered <svg> at click
 * time (not on mount) so it always reflects the current view -- comparison
 * overlays, selected history window, etc.
 *
 * SVG export only needs Blob + XMLSerializer and is offered unconditionally.
 * PNG export additionally needs canvas rasterisation support; the button is
 * omitted (rather than shown and failing) when that is not available.
 */
export default function ChartExportButtons({ containerRef, title, exportPackage, citation, chartMetadata, className, dataOnly = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const pngSupported = useSyncExternalStore(subscribeToPngSupport, getClientPngSupport, getServerPngSupport);
  const exportTitle = exportPackage?.title ?? chartMetadata?.title ?? title ?? "Evidence chart";
  const exportCitation = exportPackage ? exportPackageCitation(exportPackage) : citation ?? chartMetadata?.sourceCitation;

  function withSvg(action: (svg: SVGSVGElement) => void) {
    const svg = findChartSvg(containerRef.current ?? null);
    if (!svg) {
      setError("Chart image is not ready yet. Try again once the chart has finished loading.");
      return;
    }
    setError(null);
    action(svg);
  }

  function downloadData(extension: "csv" | "json") {
    const packageTitle = exportPackage?.title ?? chartMetadata?.title;
    if (!packageTitle) return;
    const content = exportPackage
      ? extension === "csv" ? serializeMeasureExportCsv(exportPackage) : serializeMeasureExportJson(exportPackage)
      : extension === "csv" && chartMetadata
        ? serializeChartMetadataCsv(chartMetadata)
        : JSON.stringify(chartMetadata, null, 2);
    const mime = extension === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = chartExportFilename(packageTitle, extension);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleSvgDownload() {
    withSvg((svg) => downloadChartSvg(svg, chartExportFilename(exportTitle, "svg"), { title: exportTitle, citation: exportCitation, exportPackage, chartMetadata }));
  }

  async function handlePngDownload() {
    withSvg((svg) => {
      downloadChartPng(svg, chartExportFilename(exportTitle, "png"), { title: exportTitle, citation: exportCitation, exportPackage, chartMetadata }).catch(() => {
        setError("Could not create a PNG image of this chart. SVG export remains available.");
      });
    });
  }

  return (
    <div className={className}>
      {exportPackage || chartMetadata ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-semibold text-gray-600">Download selected observations:</span>
          <button type="button" onClick={() => downloadData("csv")} className="min-h-11 font-semibold underline decoration-black/30 underline-offset-4 hover:decoration-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14243b]">CSV</button>
          <button type="button" onClick={() => downloadData("json")} className="min-h-11 font-semibold underline decoration-black/30 underline-offset-4 hover:decoration-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14243b]">JSON</button>
        </div>
      ) : null}
      {!dataOnly ? <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs font-semibold text-gray-600">Download chart as image:</span>
        <button
          type="button"
          onClick={handleSvgDownload}
          className="text-xs font-semibold underline decoration-black/30 underline-offset-4 hover:decoration-black"
        >
          SVG
        </button>
        {pngSupported ? (
          <button
            type="button"
            onClick={handlePngDownload}
            className="text-xs font-semibold underline decoration-black/30 underline-offset-4 hover:decoration-black"
          >
            PNG
          </button>
        ) : null}
      </div> : null}
      {error ? (
        <p role="status" className="mt-1 text-xs text-amber-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
