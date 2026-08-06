import Link from "next/link";

const evidencePromises = [
  {
    label: "Current",
    text: "Every figure keeps the publication clock of its original release.",
  },
  {
    label: "Comparable",
    text: "Unlike definitions stay separate; no synthetic national score is calculated.",
  },
  {
    label: "Traceable",
    text: "Period, caveat and original publisher stay one action away.",
  },
] as const;

export default function HomepageIntro() {
  return (
    <header className="v3-hero border-b border-black/15 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="v3-hero-grid">
          <div className="max-w-5xl">
            <p className="eyebrow mb-4">Independent UK public evidence</p>
            <h1
              aria-label="Britain, in evidence."
              className="font-display text-[clamp(3.15rem,7.6vw,7.2rem)] leading-[0.88] tracking-[-0.055em]"
            >
              Britain,
              <span className="block text-accent">in evidence.</span>
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#47505d] md:text-2xl md:leading-10">
              The latest important public figures, explained in plain English and linked to the original publication.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#national-signals"
                className="v3-primary-action"
              >
                Read today&apos;s edition
                <span aria-hidden="true">↓</span>
              </a>
              <Link
                href="/sources"
                prefetch={false}
                className="v3-secondary-action"
              >
                Check sources and dates
              </Link>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#5d6470]">
              Primary publisher routes include the{" "}
              <a
                href="https://www.ons.gov.uk/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-foreground underline decoration-accent underline-offset-4"
              >
                Office for National Statistics
              </a>
              .
            </p>
          </div>

          <aside className="v3-reading-card" aria-labelledby="reading-card-title">
            <p className="eyebrow eyebrow-on-dark">How to read a figure</p>
            <h2 id="reading-card-title" className="font-display mt-3 text-3xl leading-tight text-white">
              Number, period, source.
            </h2>
            <ol className="mt-6 space-y-5 text-sm leading-6 text-slate-200">
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="v3-step-number" aria-hidden="true">1</span>
                <span><strong className="text-white">Start with the value.</strong> It is the latest accepted publication, not a projection between releases.</span>
              </li>
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="v3-step-number" aria-hidden="true">2</span>
                <span><strong className="text-white">Check the period.</strong> Observation date and publication date answer different questions.</span>
              </li>
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="v3-step-number" aria-hidden="true">3</span>
                <span><strong className="text-white">Open the evidence.</strong> Definitions, caveats and the original publisher remain visible.</span>
              </li>
            </ol>
            <p className="mt-6 border-t border-white/20 pt-5 text-xs leading-5 text-slate-300">
              No combined national score. Missing evidence stays missing rather than being guessed.
            </p>
          </aside>
        </div>

        <ul className="v3-trust-ribbon" aria-label="Evidence promises">
          {evidencePromises.map((promise) => (
            <li key={promise.label}>
              <p className="text-sm font-semibold text-foreground">{promise.label}</p>
              <p className="mt-1 text-sm leading-6 text-[#5d6470]">{promise.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
