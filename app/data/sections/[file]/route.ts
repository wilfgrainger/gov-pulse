import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTION_DOWNLOAD_IDS, sectionCsv, sectionDistribution } from "@/app/lib/sectionDownloads";
import { filterCurrentSnapshot } from "@/worker/publication-currentness";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

export function generateStaticParams() {
  return SECTION_DOWNLOAD_IDS.flatMap((section) => [
    { file: `${section}.json` }, { file: `${section}.csv` },
  ]);
}

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await context.params;
  const match = /^(\w+)\.(json|csv)$/.exec(file);
  const section = match?.[1];
  const format = match?.[2];
  if (!section || !SECTION_DOWNLOAD_IDS.some((id) => id === section)) {
    return new Response("Unknown section or format", { status: 404 });
  }
  const candidate = await readServerMetricsSnapshot();
  const current = candidate && filterCurrentSnapshot(candidate, new Date()) as MetricsSnapshot | null;
  const distribution = current ? sectionDistribution(current, section) : null;
  if (!distribution) {
    return new Response("No current verified download for this section", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const isJson = format === "json";
  return new Response(isJson ? `${JSON.stringify(distribution, null, 2)}\n` : sectionCsv(distribution), {
    headers: {
      "Content-Type": isJson ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "public, max-age=0, must-revalidate, no-transform",
    },
  });
}
