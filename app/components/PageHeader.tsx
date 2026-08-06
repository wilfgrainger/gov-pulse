import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  current: string;
  children?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  current,
  children,
}: PageHeaderProps) {
  return (
    <header className="page-header v3-page-header px-4 py-10 md:px-6 md:py-16">
      <div className="relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
        <div>
          <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-xs text-gray-500">
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
          <h1 className="page-title max-w-5xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[#56606c] md:text-xl md:leading-9">
            {subtitle}
          </p>
        </div>

        <div className="v3-page-header-rail">
          {children ?? (
            <div>
              <p className="eyebrow">Evidence standard</p>
              <p className="mt-3 text-sm leading-6 text-gray-700">
                Read the value with its observation period, publication date, definition and primary source. Missing evidence is left unavailable rather than estimated.
              </p>
              <Link
                href="/sources"
                prefetch={false}
                className="mt-5 inline-flex text-sm font-semibold underline decoration-black/25 underline-offset-4 hover:text-accent"
              >
                Check sources and methods →
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
