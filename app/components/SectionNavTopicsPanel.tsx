"use client";

import Link from "next/link";
import type { CategoryGroup } from "../lib/sections";
import { publicationRoutePublished } from "@/contracts/publication-policy";

type Props = {
  sections: CategoryGroup[];
  pathname: string | null;
  focusClasses: string;
  closePanels: () => void;
  isActive: (id: string) => boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
};

export default function SectionNavTopicsPanel({
  sections,
  pathname,
  focusClasses,
  closePanels,
  isActive,
  menuRef,
}: Props) {
  return (
    <div ref={menuRef} id="all-topic-navigation" className="border-t border-[var(--line)] bg-[#11151a]">
      <div className="mx-auto max-h-[75vh] max-w-7xl overflow-y-auto px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div>
            <p className="eyebrow">Evidence library</p>
            <h2 className="font-display mt-2 text-3xl leading-tight text-[var(--foreground)] md:text-4xl">Choose a public question.</h2>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/" prefetch={false} onClick={closePanels} className="underline underline-offset-4">Latest edition</Link>
            <Link href="/sources" prefetch={false} onClick={closePanels} className="underline underline-offset-4">Sources and methods</Link>
          </div>
        </div>

        <nav aria-label="More tools" className="mb-6 border border-[var(--line)] bg-[#151a21] p-4 md:p-5">
          <p className="eyebrow">More tools</p>
          <ul className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Explore data", "/explore/"],
              ["Measure library", "/measure/"],
              ["Compare", "/compare/"],
              ["Briefing", "/briefing/"],
              ["Release calendar", "/calendar/"],
              ["Cost of living", "/cost-of-living/"],
              ["Public money", "/money/"],
              ["Editions", "/editions/"],
            ].filter(([, href]) => publicationRoutePublished(href)).map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={false}
                  onClick={closePanels}
                  className={`flex min-h-11 items-center justify-between gap-3 border-b border-[var(--line)] py-2 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent-on-dark)] ${focusClasses}`}
                  aria-current={pathname?.replace(/\/$/, "") === href.replace(/\/$/, "") ? "page" : undefined}
                >
                  {label}<span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-px border border-[var(--line)] bg-[var(--line)] md:grid-cols-2 lg:grid-cols-4">
          {sections.map((group) => (
            <section key={group.category} aria-labelledby={`topic-group-${group.category.toLowerCase().replace(/\s+/g, "-")}`} className="bg-[#151a21] p-5">
              <h2 id={`topic-group-${group.category.toLowerCase().replace(/\s+/g, "-")}`} className="eyebrow">
                {group.category}
              </h2>
              <ul className="mt-4 space-y-1">
                {group.sections.map((section) => (
                  <li key={section.id}>
                    <Link
                      href={`/section/${section.id}`}
                      prefetch={false}
                      onClick={closePanels}
                      className={`flex min-h-11 items-center justify-between gap-3 border-b border-[var(--line)] py-2 text-sm transition-colors hover:text-[var(--accent-on-dark)] ${focusClasses} ${
                        isActive(section.id) ? "font-semibold text-[var(--accent-on-dark)]" : "text-[var(--foreground)]"
                      }`}
                      aria-current={isActive(section.id) ? "page" : undefined}
                    >
                      <span>{section.label}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
