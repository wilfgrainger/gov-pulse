/**
 * Client-side chart image export: serialise a chart's live, rendered
 * <svg> element to an SVG file, and rasterise that same SVG to a PNG via an
 * offscreen canvas. Both paths run entirely in the browser -- no server
 * round-trip, no new dependency beyond the native Blob/Canvas/Image APIs
 * already available in every supported browser.
 *
 * This exports the chart *as currently rendered* (Recharts' live SVG DOM
 * node, or a hand-rolled inline <svg>), not a re-render from raw data, so
 * the exported image always matches what the reader is looking at.
 */

const XMLNS = "http://www.w3.org/2000/svg";
const SVG_MIME = "image/svg+xml;charset=utf-8";

/**
 * Finds the chart's rendered <svg> element inside a container (the ref
 * handed to ClientOnlyChart / the chart's wrapping <div>, or a container
 * that already *is* the <svg> for hand-rolled inline-SVG charts).
 * Recharts' ResponsiveContainer renders exactly one top-level <svg>, so the
 * first descendant match is always the chart itself, never a decorative
 * icon -- gov-pulse charts don't nest icon SVGs inside the chart container.
 */
export function findChartSvg(container: Element | null): SVGSVGElement | null {
  if (!container) return null;
  if (container instanceof SVGSVGElement) return container;
  return container.querySelector("svg");
}

type ExportMetadata = {
  /** Chart title, embedded as an SVG <title> for citation/accessibility. */
  title?: string;
  /** Short source-citation line, rendered as a watermark at the image foot. */
  citation?: string;
};

/**
 * Clones the given <svg>, inlines its own computed size as width/height
 * attributes (so the standalone file has no dependency on the page's CSS
 * or responsive container), injects an accessible <title>, and appends an
 * unobtrusive citation line along the bottom edge when supplied.
 */
function prepareSvgClone(svg: SVGSVGElement, metadata: ExportMetadata): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", XMLNS);

  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox?.baseVal;
  const width = Math.round(rect.width) || viewBox?.width || Number(svg.getAttribute("width")) || 640;
  const height = Math.round(rect.height) || viewBox?.height || Number(svg.getAttribute("height")) || 360;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox") && viewBox) {
    clone.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  }

  // A background rect so a PNG export isn't transparent-on-dark-mode-reader;
  // matches the pale chart-shell background used across the site's figures.
  const background = clone.ownerDocument.createElementNS(XMLNS, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", "#f7f9fb");
  clone.insertBefore(background, clone.firstChild);

  if (metadata.title) {
    const existingTitle = clone.querySelector(":scope > title");
    if (existingTitle) existingTitle.textContent = metadata.title;
    else {
      const titleEl = clone.ownerDocument.createElementNS(XMLNS, "title");
      titleEl.textContent = metadata.title;
      clone.insertBefore(titleEl, clone.firstChild?.nextSibling ?? null);
    }
  }

  if (metadata.citation) {
    const footerHeight = 18;
    clone.setAttribute("height", String(height + footerHeight));
    if (clone.getAttribute("viewBox")) {
      const [x, y, w, h] = clone.getAttribute("viewBox")!.split(/\s+/).map(Number);
      clone.setAttribute("viewBox", `${x} ${y} ${w} ${h + footerHeight}`);
    }
    background.setAttribute("height", "100%");
    const text = clone.ownerDocument.createElementNS(XMLNS, "text");
    text.setAttribute("x", "8");
    text.setAttribute("y", String(height + footerHeight - 5));
    text.setAttribute("font-size", "10");
    text.setAttribute("font-family", "ui-monospace, monospace");
    text.setAttribute("fill", "#6b7280");
    text.textContent = metadata.citation;
    clone.appendChild(text);
  }

  return clone;
}

/** Serialises a chart <svg> element to a standalone SVG document string. */
export function serializeChartSvg(svg: SVGSVGElement, metadata: ExportMetadata = {}): string {
  const prepared = prepareSvgClone(svg, metadata);
  const serializer = new XMLSerializer();
  const body = serializer.serializeToString(prepared);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${body}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads the chart as a standalone .svg file. */
export function downloadChartSvg(svg: SVGSVGElement, filename: string, metadata: ExportMetadata = {}) {
  const markup = serializeChartSvg(svg, metadata);
  triggerDownload(new Blob([markup], { type: SVG_MIME }), filename);
}

/**
 * Browser support for the canvas rasterisation path. SVG export only needs
 * Blob + XMLSerializer (near-universal); PNG export additionally needs
 * canvas 2D + Image decoding, so this is checked separately and the PNG
 * button is omitted when it's unavailable rather than failing silently.
 */
export function canRasterizeToPng(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return typeof canvas.getContext === "function" && !!canvas.getContext("2d") && typeof window.Image === "function";
}

/**
 * Rasterises a chart <svg> element to a PNG Blob via an offscreen canvas:
 * serialise -> data URL -> Image -> canvas -> toBlob. Runs at devicePixelRatio
 * so exported charts stay crisp on high-DPI screens without a huge file.
 */
export async function rasterizeChartToPng(
  svg: SVGSVGElement,
  metadata: ExportMetadata = {},
): Promise<Blob> {
  const prepared = prepareSvgClone(svg, metadata);
  const width = Number(prepared.getAttribute("width")) || 640;
  const height = Number(prepared.getAttribute("height")) || 360;
  const markup = new XMLSerializer().serializeToString(prepared);
  const dataUrl = `data:${SVG_MIME},${encodeURIComponent(markup)}`;

  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not decode chart SVG for PNG export."));
  });
  image.src = dataUrl;
  await loaded;

  const scale = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 3) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable for PNG export.");
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas could not produce a PNG blob."));
    }, "image/png");
  });
}

/** Downloads the chart as a rasterised .png file. */
export async function downloadChartPng(svg: SVGSVGElement, filename: string, metadata: ExportMetadata = {}) {
  const blob = await rasterizeChartToPng(svg, metadata);
  triggerDownload(blob, filename);
}

/** Slugifies a chart title into a filesystem-safe base filename. */
export function chartExportFilename(title: string, extension: "svg" | "png"): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "chart";
  return `public-data-${slug}.${extension}`;
}
