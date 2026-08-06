import type { ReactNode } from "react";

export default function CoreEvidenceExplanation({
  idPrefix,
  why,
  definition,
  unit,
  geography,
  interpretation,
  caveat,
  sourceLabel,
  sourceUrl,
  sourceDate,
  additionalSources = [],
  explainLabel = "Explain this number",
}: {
  idPrefix: string;
  why: ReactNode;
  definition: ReactNode;
  unit: ReactNode;
  geography: ReactNode;
  interpretation?: ReactNode;
  caveat: ReactNode;
  sourceLabel: string;
  sourceUrl: string;
  sourceDate: ReactNode;
  additionalSources?: Array<{ label: string; url: string }>;
  explainLabel?: string;
}) {
  return (
    <>
      <section
        aria-labelledby={`${idPrefix}-why-title`}
        className="border-l-4 border-foreground pl-4"
      >
        <h3 id={`${idPrefix}-why-title`} className="text-lg font-semibold">
          Why it matters
        </h3>
        <div className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">{why}</div>
      </section>

      <details className="border-y border-black/20 py-4">
        <summary className="cursor-pointer text-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
          {explainLabel}
        </summary>
        <div className="mt-5 grid gap-6 text-sm leading-6 text-gray-700 md:grid-cols-2">
          <div>
            <h4 className="font-semibold text-foreground">Definition</h4>
            <div className="mt-1">{definition}</div>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Unit and geography</h4>
            <p className="mt-1">
              {unit} · {geography}
            </p>
          </div>
          {interpretation ? (
            <div>
              <h4 className="font-semibold text-foreground">How to interpret it</h4>
              <div className="mt-1">{interpretation}</div>
            </div>
          ) : null}
          <div>
            <h4 className="font-semibold text-foreground">Important caveat</h4>
            <div className="mt-1">{caveat}</div>
          </div>
          <div className="md:col-span-2">
            <h4 className="font-semibold text-foreground">Source and date</h4>
            <p className="mt-1">
              <a
                className="font-semibold underline underline-offset-4 hover:text-accent"
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sourceLabel}
              </a>
              {" · "}
              {sourceDate}
              {additionalSources.map((source) => (
                <span key={source.url}>
                  {" · "}
                  <a
                    className="font-semibold underline underline-offset-4 hover:text-accent"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.label}
                  </a>
                </span>
              ))}
            </p>
          </div>
        </div>
      </details>
    </>
  );
}
