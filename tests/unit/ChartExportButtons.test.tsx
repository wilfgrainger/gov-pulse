import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import type { ChartMetadata } from "@/app/lib/chartExport";

const metadata: ChartMetadata = {
  schemaVersion: 2,
  title: "GDP growth",
  sourceCitation: "Office for National Statistics · https://www.ons.gov.uk/gdp",
  observationWindow: {
    start: { period: "August 2026", observedAt: "2026-08-01T00:00:00.000Z" },
    end: { period: "September 2026", observedAt: "2026-09-01T00:00:00.000Z" },
  },
  series: [{ key: "growth", label: "Monthly GDP growth" }],
  observations: [{ period: "September 2026", observedAt: "2026-09-01T00:00:00.000Z", values: { growth: 0.1 } }],
  caveats: ["Estimate subject to revision."],
};

describe("chart export controls", () => {
  it("offers selected CSV and JSON downloads for a chart with structured metadata", () => {
    const markup = renderToStaticMarkup(<ChartExportButtons containerRef={{ current: null }} chartMetadata={metadata} />);

    expect(markup).toContain("Download selected observations:");
    expect(markup).toContain(">CSV</button>");
    expect(markup).toContain(">JSON</button>");
    expect(markup).toContain("Download chart as image:");
    expect(markup).toContain(">SVG</button>");
  });
});
