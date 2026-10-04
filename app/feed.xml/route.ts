import {
  SITE_DISCOVERY,
  absoluteUrl,
  publicationEntries,
} from "@/app/lib/discovery";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";
import { publicSnapshot } from "@/worker/public-snapshot";
import householdStory from "@/app/content/stories/household-budgets";
import publicFinanceStory from "@/app/content/stories/public-finances";

export const dynamic = "force-static";
export const revalidate = false;
const STORIES = [householdStory, publicFinanceStory];

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

export function renderRssFeed(input: unknown) {
  const snapshot = publicSnapshot(input) as MetricsSnapshot | null;
  const publications = publicationEntries(input).sort((left, right) =>
    (right.publication?.dateModified ?? "").localeCompare(left.publication?.dateModified ?? "")
  );
  const datasetEntries = publications
    .map(({ title, description, path, publication }) => {
      const link = absoluteUrl(path);
      const publishedDate = validDate(publication?.dateModified);
      const period = publication?.temporalCoverage
        ? ` Observation period: ${publication.temporalCoverage}.`
        : "";
      const publicationDisclosure = publishedDate ? "" : " The verified record does not disclose a publisher publication date.";

      return [
        "<item>",
        `<title>${escapeXml(title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `<description>${escapeXml(`${description}${period}${publicationDisclosure}`)}</description>`,
        publishedDate ? `<pubDate>${escapeXml(publishedDate.toUTCString())}</pubDate>` : "",
        "<category>Source data publication</category>",
        "</item>",
      ].filter(Boolean).join("");
    })
    .join("");

  const summary = snapshot?.meta?.editionSummary;
  const sameEdition = Boolean(summary?.id && summary.previousEditionId === summary.id);
  const summaryDate = validDate(summary?.publishedAt);
  const summaryDescription = summary?.changes.length ? summary.changes.map((change) => {
    const measure = snapshot?.meta.measureCatalog?.measures[change.measureId];
    const label = measure?.label ?? change.measureId;
    const values = change.kind === "method-change"
      ? "The definition, method, unit or geography changed; no like-for-like numeric comparison is asserted."
      : change.kind === "metadata-change"
        ? `Source metadata changed (${(change.changedFields ?? []).join(", ") || "details not recorded"}); no numeric change is inferred.`
        : `${change.previous === null ? "not previously reported" : `${change.previous} ${change.previousUnit ?? change.nextUnit ?? measure?.unit ?? ""}`} → ${change.next === null ? "unavailable" : `${change.next} ${change.nextUnit ?? measure?.unit ?? ""}`}`;
    const geography = measure?.geography.label ?? "geography unavailable";
    const source = [change.previousSourceUrl, change.nextSourceUrl ?? measure?.sourceUrl].filter((url): url is string => Boolean(url))
      .map((url, index) => ` ${index === 0 && change.previousSourceUrl ? "Previous" : "Current"} primary publication: ${url}.`).join("");
    const sourceDates = ` Source publication date: ${change.previousSourcePublishedAt?.slice(0, 10) ?? "not recorded"} → ${change.nextSourcePublishedAt?.slice(0, 10) ?? "not recorded"}.`;
    const caveat = measure?.caveats.length ? ` ${measure.caveats.join(" ")}` : "";
    return `${label}, ${change.period ?? "measure definition"} (${change.kind}): ${values}; ${geography}; source edition ${change.previousSourceEditionId ?? "not previously recorded"} → ${change.nextSourceEditionId}.${sourceDates}${source}${caveat}`;
  }).join("; ") : sameEdition
    ? "The accepted edition is unchanged; no evidence changes were recorded."
    : summary?.previousEditionId === null
      ? "No comparable earlier publication was available; no evidence changes are inferred from a missing baseline."
    : summary?.previousEditionId
      ? `No observation, revision, metadata or method changes were recorded against previous catalog ${summary.previousEditionId}; a retrieval alone is not evidence of a change.`
      : "The stored edition does not record whether a comparable earlier publication was available; no changes are inferred.";
  const summaryTitle = summary?.changes.length
    ? `Evidence edition ${summary.id}: ${summary.changes.length} published change${summary.changes.length === 1 ? "" : "s"}`
    : `Evidence edition ${summary?.id ?? "unidentified"}: ${sameEdition ? "accepted edition is unchanged" : summary?.previousEditionId === null ? "no comparable baseline" : summary?.previousEditionId ? "no changes from prior catalog" : "comparison baseline not recorded"}`;
  const summaryEntry = summary ? [
    "<item>",
    `<title>${escapeXml(summaryTitle)}</title>`,
    `<link>${escapeXml(absoluteUrl("/briefing/"))}</link>`,
    `<guid isPermaLink="false">${escapeXml(`urn:public-data:edition:${summary.id}`)}</guid>`,
    `<description>${escapeXml(summaryDescription)}</description>`,
    summaryDate ? `<pubDate>${escapeXml(summaryDate.toUTCString())}</pubDate>` : "",
    "<category>Evidence edition</category>",
    "</item>",
  ].filter(Boolean).join("") : "";
  const storyEntries = STORIES.map((story) => {
    const link = absoluteUrl(`/stories/${story.slug}/`);
    const publishedDate = validDate(story.publishedAt);
    return [
      "<item>",
      `<title>${escapeXml(story.title)}</title>`,
      `<link>${escapeXml(link)}</link>`,
      `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `<description>${escapeXml(`${story.introduction} This authored guide links to source-owned observations on the page; unavailable values stay unavailable.`)}</description>`,
      publishedDate ? `<pubDate>${escapeXml(publishedDate.toUTCString())}</pubDate>` : "",
      "<category>Authored story</category>",
      publishedDate ? "" : "<category>Publication date not disclosed</category>",
      "</item>",
    ].filter(Boolean).join("");
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(`${SITE_DISCOVERY.name} — latest verified evidence`)}</title>
    <link>${escapeXml(SITE_DISCOVERY.origin)}</link>
    <description>${escapeXml(SITE_DISCOVERY.description)}</description>
    <language>en-gb</language>
    ${summaryEntry}
    ${storyEntries}
    ${datasetEntries}
  </channel>
</rss>
`;
}

export function GET() {
  return new Response(renderRssFeed(BUILD_METRICS_SNAPSHOT), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
