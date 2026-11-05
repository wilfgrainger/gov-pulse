/**
 * Comparison series styling. Colour is never the only cue (WCAG 1.4.1): every series also
 * has a distinct dash pattern and marker shape, repeated in the legend.
 */
export type SeriesMarker = "circle" | "square" | "diamond" | "triangle" | "cross" | "triangle-down" | "plus" | "star";

export type SeriesStyle = { color: string; dash: string; marker: SeriesMarker };

export const SERIES_STYLES: readonly SeriesStyle[] = [
  { color: "#08766c", dash: "none", marker: "circle" },
  { color: "#a72d24", dash: "8 4", marker: "square" },
  { color: "#4d43a5", dash: "2 3", marker: "diamond" },
  { color: "#a45700", dash: "10 3 2 3", marker: "triangle" },
  { color: "#135f94", dash: "none", marker: "cross" },
  { color: "#7b3e76", dash: "8 4", marker: "triangle-down" },
  { color: "#4d6531", dash: "2 3", marker: "plus" },
  { color: "#273b4a", dash: "10 3 2 3", marker: "star" },
];

export function seriesStyle(index: number): SeriesStyle {
  return SERIES_STYLES[index % SERIES_STYLES.length];
}

/** SVG path for a marker centred on (0, 0) within a radius of about `r`. */
export function markerPath(marker: SeriesMarker, r: number): string {
  const h = r * 0.9;
  switch (marker) {
    case "circle": return `M ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
    case "square": return `M ${-h} ${-h} L ${h} ${-h} L ${h} ${h} L ${-h} ${h} Z`;
    case "diamond": return `M 0 ${-r * 1.2} L ${r * 1.2} 0 L 0 ${r * 1.2} L ${-r * 1.2} 0 Z`;
    case "triangle": return `M 0 ${-r * 1.2} L ${r * 1.1} ${r * 0.9} L ${-r * 1.1} ${r * 0.9} Z`;
    case "triangle-down": return `M 0 ${r * 1.2} L ${r * 1.1} ${-r * 0.9} L ${-r * 1.1} ${-r * 0.9} Z`;
    case "cross": return `M ${-h} ${-h} L ${h} ${h} M ${h} ${-h} L ${-h} ${h}`;
    case "plus": return `M ${-r * 1.2} 0 L ${r * 1.2} 0 M 0 ${-r * 1.2} L 0 ${r * 1.2}`;
    case "star": return `M 0 ${-r * 1.3} L ${r * 0.4} ${-r * 0.4} L ${r * 1.3} ${-r * 0.4} L ${r * 0.6} ${r * 0.2} L ${r * 0.8} ${r * 1.2} L 0 ${r * 0.6} L ${-r * 0.8} ${r * 1.2} L ${-r * 0.6} ${r * 0.2} L ${-r * 1.3} ${-r * 0.4} L ${-r * 0.4} ${-r * 0.4} Z`;
  }
}
