"use client";

import { useState, useSyncExternalStore, type RefObject } from "react";
import {
  canRasterizeToPng,
  chartExportFilename,
  downloadChartPng,
  downloadChartSvg,
  findChartSvg,
} from "@/app/lib/chartExport";
import type { ChartMetadata } from "@/app/lib/chartExport";
import { exportPackageCitation, type ExportPackage } from "@/app/lib/chartModel";

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
export default function ChartExportButtons({ containerRef, title, exportPackage, citation, chartMetadata, className }: Props) {
  const [error, setError] = useState<string | null>(null);
  const pngSupported = useSyncExternalStore(subscribeToPngSupport, getClientPngSupport, getServerPngSupport);
  const exportTitle = exportPackage?.title ?? title ?? "Evidence chart";
  const exportCitation = exportPackage ? exportPackageCitation(exportPackage) : citation;

  function withSvg(action: (svg: SVGSVGElement) => void) {
    const svg = findChartSvg(containerRef.current ?? null);
    if (!svg) {
      setError("Chart image is not ready yet. Try again once the chart has finished loading.");
      return;
    }
    setError(null);
    action(svg);
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
      </div>
      {error ? (
        <p role="status" className="mt-1 text-xs text-amber-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
