import Link from "next/link";

export default function HomepageIntro() {
  return (
    <header className="border-b border-black/15 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Independent UK public evidence</p>
          <h1
            aria-label="Britain, in evidence."
            className="font-display mt-3 text-4xl leading-tight tracking-tight md:text-5xl"
          >
            Britain, <span className="text-accent">in evidence.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            What changed, what it means, and the{" "}
            <a
              href="https://www.ons.gov.uk/"
              className="underline underline-offset-4"
            >
              official sources
            </a>{" "}
            behind the numbers.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/explore/" prefetch={false} className="v3-primary-action">
            Explore 27 measures <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/sources"
            prefetch={false}
            className="v3-secondary-action"
          >
            Sources and dates
          </Link>
        </div>
      </div>
    </header>
  );
}
