import Link from "next/link";
import BrandLogo from "./BrandLogo";

export default function PublicationOffline({ title = "Data publications are temporarily offline" }: { title?: string }) {
  return (
    <div className="premium-offline">
      <header className="publication-masthead sticky top-0 z-50">
        <div className="edition-masthead-shell">
          <div className="flex flex-wrap items-center gap-3">
            <BrandLogo compact />
            <span className="edition-status-pill" data-status="offline" role="status">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Reverifying
            </span>
          </div>
          <nav aria-label="Edition" className="edition-doors justify-self-start md:justify-self-center">
            <Link prefetch={false} href="/" className="edition-door" aria-current="page">
              Latest
            </Link>
            <Link prefetch={false} href="/explore/" className="edition-door">
              Look up
            </Link>
            <Link prefetch={false} href="/compare/" className="edition-door">
              Compare
            </Link>
          </nav>
          <p className="justify-self-end text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Offline edition
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(14rem,0.55fr)] lg:items-start">
          <article className="premium-offline__panel">
            <p className="eyebrow">Publication review</p>
            <h1 className="font-display mt-4 text-[clamp(2.4rem,7vw,4.75rem)] leading-[0.94]">{title}</h1>
            <p className="mt-6 max-w-[58ch] text-base leading-7 text-[var(--muted)] md:text-lg md:leading-8">
              We have taken data publications offline while we reverify the evidence. Figures return one verified section at a time. Nothing is shown until the source, period and geography can be checked.
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              NHS referral-to-treatment stays unavailable until a permitted download of the official CSV exists. Debt may appear alone when that series is current.
            </p>
            <div className="premium-offline__actions">
              <Link prefetch={false} href="/about">
                About
              </Link>
              <Link prefetch={false} href="/editorial-policy">
                Editorial policy
              </Link>
              <Link prefetch={false} href="/contact">
                Contact
              </Link>
              <Link prefetch={false} href="/sources">
                Sources
              </Link>
            </div>
          </article>

          <aside className="border border-[var(--line)] bg-[#11151a] p-5 text-sm leading-6 text-[var(--muted)] md:p-6">
            <p className="eyebrow">Still available</p>
            <p className="mt-3 text-[var(--foreground)]">Trust pages and methods stay open while evidence is checked.</p>
            <ul className="mt-4 list-none space-y-2 p-0">
              <li>No invented or interpolated figures</li>
              <li>No previous value labelled as current</li>
              <li>Unavailable stays unavailable</li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
