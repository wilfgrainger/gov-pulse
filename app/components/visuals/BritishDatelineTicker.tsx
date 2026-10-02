"use client";

import Link from "next/link";
import { useInitialMetricsSnapshot } from "@/app/lib/MetricsSnapshotProvider";

function publicationDate(value: unknown) {
  if (typeof value !== "string") return null;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  return {
    iso: instant.toISOString(),
    label: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(instant),
  };
}

export default function BritishDatelineTicker() {
  const snapshot = useInitialMetricsSnapshot();
  const edition = snapshot?.meta.editionSummary;
  const published = publicationDate(edition?.publishedAt);

  return (
    <aside
      aria-label="Latest public evidence edition"
      className="border-b border-[#273a53] bg-[#14243b] text-white"
    >
      <div className="mx-auto flex min-h-9 max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-1 px-4 py-1.5 text-xs md:px-6">
        <span className="font-mono text-[0.6875rem] font-bold tracking-[0.14em] text-slate-200 uppercase">
          UK public evidence
        </span>
        {published ? (
          <Link
            href="/briefing/"
            prefetch={false}
            className="underline decoration-white/40 underline-offset-4 hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Latest evidence edition · Published{" "}
            <time dateTime={published.iso}>{published.label}</time>
          </Link>
        ) : (
          <span className="text-slate-200">Publication dates appear with each figure</span>
        )}
      </div>
    </aside>
  );
}
