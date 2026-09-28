import Link from "next/link";

export default function HomepageIntro() {
  return (
    <header className="border-b border-black/15 bg-[#f0eee5] px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)] lg:items-end">
        <div>
          <p className="eyebrow !text-[#0b6b69]">Free, independent UK public evidence</p>
          <h1
            aria-label="Britain, in evidence."
            className="font-display mt-5 text-5xl leading-[0.98] tracking-tight md:text-7xl lg:text-[5.75rem]"
          >
            Britain, <span className="text-accent">in evidence.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 md:text-xl">
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
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link href="/explore/" prefetch={false} className="v3-primary-action">
            Explore 7 measures <span aria-hidden="true">→</span>
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
      <nav aria-label="Start with a question" className="mx-auto mt-10 grid max-w-7xl gap-3 border-t border-black/15 pt-6 text-sm font-semibold sm:grid-cols-3">
        <Link href="/section/nhs" prefetch={false} className="flex min-h-16 items-center justify-between gap-4 border-l-4 border-[#0b6b69] bg-white px-4 py-3 hover:bg-[#e4f1ec]">Is the NHS waiting list shrinking? <span aria-hidden="true">↗</span></Link>
        <Link href="/section/gdp" prefetch={false} className="flex min-h-16 items-center justify-between gap-4 border-l-4 border-[#0b6b69] bg-white px-4 py-3 hover:bg-[#e4f1ec]">Is the economy growing? <span aria-hidden="true">↗</span></Link>
        <Link href="/section/national-debt" prefetch={false} className="flex min-h-16 items-center justify-between gap-4 border-l-4 border-[#0b6b69] bg-white px-4 py-3 hover:bg-[#e4f1ec]">How much does the UK owe? <span aria-hidden="true">↗</span></Link>
      </nav>
    </header>
  );
}
