import Link from "next/link";
import Reveal from "./Reveal";

const HOME_LINKS = [
  ["Explore", "/explore/", "Explore the data"],
  ["Measures", "/measure/", "Measure library"],
  ["Compare", "/compare/", "Compare"],
  ["Briefing", "/briefing/", "Read the latest briefing"],
  ["Sources", "/sources", "Sources and dates"],
] as const;

export default function HomepageIntro() {
  return (
    <header className="v3-page-header v3-home-cover border-b border-black/15 px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] md:items-center md:gap-8">
        <Reveal>
          <p className="eyebrow !text-[#0f6b63]">Free, independent UK public evidence</p>
          <h1
            aria-label="Britain, in evidence."
            className="page-title mt-2 text-balance text-[#14243b] !text-[clamp(2.5rem,5vw,4.25rem)] !leading-[0.92]"
          >
            Britain, <span className="text-accent">in evidence.</span>
          </h1>
        </Reveal>

        <div className="grid gap-3">
          <p className="max-w-xl text-sm leading-6 text-slate-700 md:text-base">
            What changed, what it means, and the{" "}
            <Link href="https://www.ons.gov.uk/" className="font-semibold text-[#14243b] underline decoration-accent underline-offset-4">
              official sources
            </Link>{" "}
            behind the numbers.
          </p>
          <nav aria-label="Explore this publication" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-black/15 pt-2">
            {HOME_LINKS.map(([label, href, accessibleName]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                aria-label={accessibleName}
                className="inline-flex min-h-11 items-center border-b border-transparent text-sm font-semibold text-[#14243b] underline-offset-4 transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14243b]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
