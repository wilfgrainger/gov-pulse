import Link from "next/link";

export default function HomepageIntro() {
  return (
    <header className="v3-hero border-b border-black/15 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
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
      </div>
    </header>
  );
}
