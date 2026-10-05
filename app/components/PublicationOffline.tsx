import Link from "next/link";
import { publicationRouteEnabled } from "@/contracts/publication-policy";
import BrandLogo from "./BrandLogo";

export default function PublicationOffline({ title = "Evidence is being reverified" }: { title?: string }) {
  const evidenceDoors = [
    ["Explore", "/explore"],
    ["Compare", "/compare"],
    ["Briefing", "/briefing"],
  ] as const;
  const enabledEvidenceDoors = evidenceDoors.filter(([, href]) => publicationRouteEnabled(href));
  const sourcesEnabled = publicationRouteEnabled("/sources");

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
            {enabledEvidenceDoors.map(([label, href]) => (
              <Link key={href} prefetch={false} href={href} className="edition-door">
                {label}
              </Link>
            ))}
          </nav>
          <p className="justify-self-end text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Offline edition
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(14rem,0.55fr)] lg:items-start">
          <article className="premium-offline__panel evidence-unavailable-shell">
            <p className="eyebrow">Publication review</p>
            <h1 className="font-display mt-4 text-[clamp(2.4rem,7vw,4.75rem)] leading-[0.94]">{title}</h1>
            <p className="mt-6 max-w-[58ch] text-base leading-7 text-[var(--muted)] md:text-lg md:leading-8">
              The publication is deliberately failing closed while sources are checked. Figures return one verified section at a time; nothing is shown as current until its source, observation period, publication date and geography reconcile.
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Missing evidence is not replaced with an older number, a zero, an estimate or an interpolated value. Individual verified sections may return before the full edition is restored.
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
              {sourcesEnabled ? (
                <Link prefetch={false} href="/sources">
                  Sources
                </Link>
              ) : null}
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
