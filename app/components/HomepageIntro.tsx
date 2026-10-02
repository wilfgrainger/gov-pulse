import Link from "next/link";
import Reveal from "./Reveal";

export default function HomepageIntro() {
  return (
    <header className="v3-page-header v3-hero border-b border-black/15 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto grid max-w-7xl gap-5 min-[72rem]:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)] min-[72rem]:items-end">
        <Reveal>
          <p className="eyebrow !text-[#0f6b63]">Free, independent UK public evidence</p>
          <h1
            aria-label="Britain, in evidence."
            className="page-title mt-3 text-balance text-[#14243b]"
          >
            Britain, <span className="text-accent">in evidence.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 md:text-lg md:leading-8">
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
        <Reveal delay={0.1} className="flex flex-wrap gap-2 min-[72rem]:justify-end">
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
    </header>
  );
}
