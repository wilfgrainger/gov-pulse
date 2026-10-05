import Link from "next/link";
import BrandLogo from "./BrandLogo";

export default function PublicationOffline({ title = "This edition is offline for verification" }: { title?: string }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
        <BrandLogo compact />
        <nav aria-label="Edition" className="flex items-center gap-4 text-sm font-semibold">
          <Link prefetch={false} href="/" className="underline underline-offset-4">Latest</Link>
          <Link prefetch={false} href="/explore/" className="underline underline-offset-4">Look up</Link>
          <Link prefetch={false} href="/compare/" className="underline underline-offset-4">Compare</Link>
        </nav>
        <p className="ml-auto text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Offline</p>
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <article className="border border-[var(--line)] bg-white p-6 md:p-10">
        <p className="eyebrow">Publication review</p>
        <h1 className="font-display mt-4 text-4xl leading-tight md:text-6xl">{title}</h1>
        <p className="mt-6 max-w-[62ch] text-lg leading-8">Publications return one verified section at a time. Figures are not shown until the source, period and geography can be checked.</p>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">NHS referral-to-treatment stays unavailable until a permitted download of the official CSV exists.</p>
      </article>
    </main>
  </div>;
}
