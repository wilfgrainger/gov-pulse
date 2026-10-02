import Link from "next/link";
import Reveal from "./Reveal";

export default function HomepageIntro() {
  return (
    <header className="v3-page-header v3-hero border-b border-black/15 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)] lg:items-end">
        <Reveal>
          <p className="eyebrow !text-[#0f6b63]">Free, independent UK public evidence</p>
          <h1
            aria-label="Britain, in evidence."
            className="page-title mt-5 text-balance text-[#14243b]"
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
        </Reveal>
        <Reveal delay={0.1} className="flex flex-wrap gap-3 lg:justify-end">
          <Link href="/explore/" prefetch={false} className="v3-primary-action">
            Explore the data <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/sources"
            prefetch={false}
            className="v3-secondary-action"
          >
            Sources and dates
          </Link>
          <Link href="/briefing/" prefetch={false} className="v3-secondary-action">Read the latest briefing</Link>
        </Reveal>
      </div>
      <nav aria-label="Start with a question" className="mx-auto mt-10 grid max-w-7xl gap-3 border-t border-black/15 pt-6 text-sm font-semibold sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/section/nhs" prefetch={false} className="editorial-lift group flex min-h-16 items-center justify-between gap-4 border-l-4 border-[#0f6b63] bg-white px-4 py-3 shadow-sm hover:bg-[#dceaf4] british-538-border">Is the NHS waiting list shrinking? <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span></Link>
        <Link href="/section/gdp" prefetch={false} className="editorial-lift group flex min-h-16 items-center justify-between gap-4 border-l-4 border-[#0f6b63] bg-white px-4 py-3 shadow-sm hover:bg-[#dceaf4] british-538-border">Is the economy growing? <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span></Link>
        <Link href="/section/government-contracts" prefetch={false} className="editorial-lift group flex min-h-16 items-center justify-between gap-4 border-l-4 border-[#1f5c8a] bg-white px-4 py-3 shadow-sm hover:bg-[#dceaf4] british-538-border">Where is government money spent? <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span></Link>
        <Link href="/section/national-debt" prefetch={false} className="editorial-lift group flex min-h-16 items-center justify-between gap-4 border-l-4 border-[#8a5a12] bg-white px-4 py-3 shadow-sm hover:bg-[#dceaf4] british-538-border">How much does the UK owe? <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span></Link>
      </nav>
    </header>
  );
}
