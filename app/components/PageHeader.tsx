import type { ReactNode } from "react";
import Link from "next/link";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  current: string;
  context?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  current,
  context,
}: PageHeaderProps) {
  return (
    <header className="page-header v3-page-header px-4 py-8 md:px-6 md:py-10">
      <div className={`relative mx-auto max-w-7xl ${context ? "grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.55fr)] lg:items-center lg:gap-10" : ""}`}>
        <div>
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <Link
              href="/"
              prefetch={false}
              className="font-semibold underline decoration-black/20 underline-offset-4 hover:text-accent"
            >
              Latest edition
            </Link>
            <span aria-hidden="true">/</span>
            <span>{current}</span>
          </nav>
          <p className="eyebrow mb-4">{eyebrow}</p>
          <h1 className="page-title section-title max-w-5xl">{title}</h1>
          <p className="editorial-prose editorial-prose--wide mt-5 text-[var(--muted)]">
            {subtitle}
          </p>
        </div>
        {context ? <div className="border-t border-black/20 pt-4 lg:border-l lg:border-t-0 lg:py-2 lg:pl-6">{context}</div> : null}
      </div>
    </header>
  );
}
