import { useId } from "react";

export type SeriesEvidenceItem = {
  id: string;
  label: string;
  period: string;
  publisher: string;
  sourceUrl: string;
  retrievedAt: string | Date | null;
  revisionStatus: string;
  evidenceClass: string;
  publishedAt?: string | Date | null;
  note?: string;
};

function asDate(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatDate(value: string | Date | null | undefined, includeTime = false) {
  const date = asDate(value);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit" as const,
          minute: "2-digit" as const,
          hour12: false,
        }
      : {}),
    timeZone: "UTC",
  }).format(date);
}

export default function SeriesEvidence({
  items,
  title = "Series evidence",
}: {
  items: SeriesEvidenceItem[];
  title?: string;
}) {
  const titleId = useId();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="border-y border-black/20 py-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-accent">Evidence by series</p>
          <h4 id={titleId} className="mt-1 text-xl font-semibold">
            {title}
          </h4>
        </div>
        <p className="max-w-xl text-xs leading-5 text-gray-600">
          The observation period and the date last checked are different. Each series keeps both.
        </p>
      </div>

      <div className="divide-y divide-black/15 border-y border-black/15">
        {items.map((item) => {
          const retrieved = formatDate(item.retrievedAt, true);
          return (
            <article
              key={item.id}
              className="grid gap-3 py-4 md:grid-cols-[minmax(10rem,0.8fr)_minmax(0,2fr)]"
            >
              <div>
                <h5 className="font-semibold text-foreground">{item.label}</h5>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                  {item.evidenceClass}
                </p>
              </div>
              <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs text-gray-500">Observation period</dt>
                  <dd className="mt-1 font-semibold text-foreground">{item.period}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Publisher</dt>
                  <dd className="mt-1">
                    <a
                      className="font-semibold underline underline-offset-4"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.publisher}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Last checked</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {retrieved === "Unavailable" ? retrieved : `${retrieved} UTC`}
                  </dd>
                </div>
                {item.publishedAt ? (
                  <div>
                    <dt className="text-xs text-gray-500">Published</dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {formatDate(item.publishedAt)}
                    </dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500">Revision status</dt>
                  <dd className="mt-1 leading-6 text-gray-700">{item.revisionStatus}</dd>
                </div>
                {item.note ? (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="text-xs text-gray-500">Important distinction</dt>
                    <dd className="mt-1 leading-6 text-gray-700">{item.note}</dd>
                  </div>
                ) : null}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
