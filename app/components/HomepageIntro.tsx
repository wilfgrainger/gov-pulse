import Link from "next/link";

const HOME_LINKS = [
  ["Explore", "/explore/", "Explore measures and places"],
  ["Compare", "/compare/", "Compare"],
  ["Editions", "/editions/", "Edition archive"],
  ["Sources", "/sources", "Sources and dates"],
] as const;

export default function HomepageIntro() {
  return (
    <header className="v3-page-header v3-home-cover border-b border-[var(--line)]">
      <div className="premium-hero">
        <div>
          <p className="eyebrow">Independent UK public evidence</p>
          <h1
            aria-label="Britain, in evidence."
            className="page-title mt-3 text-balance"
          >
            Britain, <span>in evidence.</span>
          </h1>
          <p className="editorial-prose mt-5 text-[var(--muted)]">
            What changed, what it means, and the{" "}
            <Link
              href="https://www.ons.gov.uk/"
              className="font-semibold text-[var(--foreground)] underline decoration-[var(--accent)] underline-offset-4"
            >
              official sources
            </Link>{" "}
            behind the numbers. Paid-for clarity, free to read.
          </p>
        </div>

        <div className="premium-hero__meta">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--accent-on-dark)]">
            Edition desk
          </p>
          <p className="mt-3 text-sm leading-6">
            One lead figure. Six topic cards. Geography, period and source on every number.
          </p>
          <nav aria-label="Explore this publication" className="mt-5 flex flex-wrap gap-x-4 gap-y-1">
            {HOME_LINKS.map(([label, href, accessibleName]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                aria-label={accessibleName}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--foreground)] underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--accent)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
