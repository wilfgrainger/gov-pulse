import {
  SITE_DISCOVERY,
  absoluteUrl,
  publicationEntries,
} from "@/app/lib/discovery";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

export const dynamic = "force-static";
export const revalidate = false;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function validDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function GET() {
  const publications = publicationEntries().sort((left, right) =>
    (right.publication?.dateModified ?? "").localeCompare(
      left.publication?.dateModified ?? ""
    )
  );
  const lastBuildDate = publications
    .map((entry) => validDate(entry.publication?.dateModified))
    .find((date) => date !== null);
  const entries = publications
    .map(({ title, description, path, publication }) => {
      const link = absoluteUrl(path);
      const publishedDate = validDate(publication?.dateModified);
      const period = publication?.temporalCoverage
        ? ` Observation period: ${publication.temporalCoverage}.`
        : "";

      return [
        "<item>",
        `<title>${escapeXml(title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `<description>${escapeXml(`${description}${period}`)}</description>`,
        publishedDate ? `<pubDate>${escapeXml(publishedDate.toUTCString())}</pubDate>` : "",
        "</item>",
      ].filter(Boolean).join("");
    })
    .join("");

  const snapshot = BUILD_METRICS_SNAPSHOT as MetricsSnapshot | null;
  const summary = snapshot?.meta?.editionSummary;
  const summaryDate = validDate(summary?.publishedAt);
  const summaryEntry = summary && summary.changes.length ? [
    "<item>",
    `<title>${escapeXml(`Evidence update: ${summary.changes.length} published change${summary.changes.length === 1 ? "" : "s"}`)}</title>`,
    `<link>${escapeXml(absoluteUrl("/briefing/"))}</link>`,
    `<guid isPermaLink="false">${escapeXml(summary.id)}</guid>`,
    `<description>${escapeXml(summary.changes.map((change) => `${change.measureId}, ${change.period ?? "method"}: ${change.previous ?? "not previously available"} → ${change.next ?? "unavailable"} (${change.kind})`).join("; "))}</description>`,
    summaryDate ? `<pubDate>${escapeXml(summaryDate.toUTCString())}</pubDate>` : "",
    "</item>",
  ].filter(Boolean).join("") : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(`${SITE_DISCOVERY.name} — latest verified evidence`)}</title>
    <link>${escapeXml(SITE_DISCOVERY.origin)}</link>
    <description>${escapeXml(SITE_DISCOVERY.description)}</description>
    <language>en-gb</language>
    ${lastBuildDate ? `<lastBuildDate>${escapeXml(lastBuildDate.toUTCString())}</lastBuildDate>` : ""}
    ${summaryEntry}
    ${entries}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
