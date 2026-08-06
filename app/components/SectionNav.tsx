"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CategoryGroup } from "../lib/sections";
import BrandLogo from "./BrandLogo";
import DataHealthBar from "./DataHealthBar";
import EvidenceSearch from "./EvidenceSearch";

const QUICK_LINK_IDS = [
  "gdp",
  "economy",
  "nhs",
  "migration",
  "election-polls",
  "crime-stats",
  "government-contracts",
] as const;

export default function SectionNav({ sections }: { sections: CategoryGroup[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const allSections = useMemo(
    () => sections.flatMap((group) => group.sections),
    [sections]
  );
  const quickLinks = QUICK_LINK_IDS.flatMap((id) => {
    const section = allSections.find((item) => item.id === id);
    return section ? [section] : [];
  });

  const isActive = (id: string) => pathname === `/section/${id}`;

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      const targetElement = target instanceof Element ? target : null;
      const insideMenu = menuRef.current?.contains(target) ?? false;
      const insideSearch = searchRef.current?.contains(target) ?? false;
      const insideToggle = Boolean(
        targetElement?.closest("[data-publication-panel-toggle]")
      );

      if (!insideMenu && !insideSearch && !insideToggle) {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (menuOpen) menuToggleRef.current?.focus();
      if (searchOpen) searchToggleRef.current?.focus();
      setMenuOpen(false);
      setSearchOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, searchOpen]);

  function toggleSearch() {
    setMenuOpen(false);
    setSearchOpen((open) => !open);
  }

  function toggleMenu() {
    setSearchOpen(false);
    setMenuOpen((open) => !open);
  }

  function closePanels() {
    setMenuOpen(false);
    setSearchOpen(false);
  }

  const focusClasses =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172234]";

  return (
    <>
      <DataHealthBar />
      <nav className="border-b border-[#c8c1b5] bg-white" aria-label="public-data.org navigation">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2 md:px-6 md:py-3">
          <Link
            href="/"
            prefetch={false}
            className={`inline-flex min-h-11 shrink-0 items-center ${focusClasses}`}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <BrandLogo compact />
          </Link>

          <p className="hidden border-l border-[#d8d3c8] pl-4 text-xs leading-5 text-[#68707b] lg:block">
            Independent UK public evidence
          </p>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/sources"
              prefetch={false}
              className={`hidden min-h-11 items-center px-3 text-sm font-semibold underline decoration-black/20 underline-offset-4 hover:text-accent sm:inline-flex ${focusClasses}`}
              aria-current={pathname === "/sources" ? "page" : undefined}
            >
              Sources
            </Link>
            <button
              ref={searchToggleRef}
              type="button"
              data-publication-panel-toggle
              onClick={toggleSearch}
              className={`inline-flex min-h-11 items-center border border-[#172234] px-3 py-2 text-sm font-semibold text-[#172234] transition-colors hover:bg-[#f2eee6] sm:px-4 ${focusClasses}`}
              aria-label="Search evidence"
              aria-expanded={searchOpen}
              aria-controls="global-evidence-search-panel"
            >
              Search
            </button>
            <button
              ref={menuToggleRef}
              type="button"
              data-publication-panel-toggle
              onClick={toggleMenu}
              className={`inline-flex min-h-11 items-center gap-2 bg-[#172234] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8a3540] sm:px-4 ${focusClasses}`}
              aria-expanded={menuOpen}
              aria-controls="all-topic-navigation"
            >
              <span>Topics</span>
              <span aria-hidden="true" className={`text-base transition-transform ${menuOpen ? "rotate-45" : ""}`}>+</span>
            </button>
          </div>
        </div>

        <div className="hidden border-t border-[#e4dfd6] md:block">
          <div className="mx-auto flex max-w-7xl items-center overflow-x-auto px-6 text-xs">
            <Link
              href="/"
              prefetch={false}
              className={`inline-flex min-h-11 shrink-0 items-center border-r border-[#e4dfd6] pr-4 font-semibold transition-colors hover:text-accent ${focusClasses}`}
              aria-current={pathname === "/" ? "page" : undefined}
            >
              Latest
            </Link>
            {quickLinks.map((section) => (
              <Link
                key={section.id}
                href={`/section/${section.id}`}
                prefetch={false}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-r border-[#e4dfd6] px-3 font-medium transition-colors last:border-r-0 hover:bg-[#f2eee6] hover:text-accent ${focusClasses} ${
                  isActive(section.id)
                    ? "bg-[#172234] font-semibold text-white hover:bg-[#172234] hover:text-white"
                    : "text-[#172234]"
                }`}
                aria-current={isActive(section.id) ? "page" : undefined}
              >
                {section.shortLabel ?? section.label}
              </Link>
            ))}
          </div>
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            id="all-topic-navigation"
            className="border-t border-[#d8d3c8] bg-[#f7f3eb] shadow-[0_18px_42px_rgba(23,34,52,0.18)]"
          >
            <div className="mx-auto max-h-[75vh] max-w-7xl overflow-y-auto px-4 py-6 md:px-6 md:py-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#c8c1b5] pb-5">
                <div>
                  <p className="eyebrow">Evidence library</p>
                  <h2 className="font-display mt-2 text-3xl leading-tight md:text-4xl">Choose a public question.</h2>
                </div>
                <div className="flex flex-wrap gap-4 text-sm font-semibold">
                  <Link href="/" prefetch={false} onClick={closePanels} className="underline underline-offset-4">Latest edition</Link>
                  <Link href="/sources" prefetch={false} onClick={closePanels} className="underline underline-offset-4">Sources and methods</Link>
                </div>
              </div>

              <div className="grid gap-px border border-[#c8c1b5] bg-[#c8c1b5] md:grid-cols-2 lg:grid-cols-4">
                {sections.map((group) => (
                  <section key={group.category} aria-labelledby={`topic-group-${group.category.toLowerCase().replace(/\s+/g, "-")}`} className="bg-white p-5">
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
                            className={`flex min-h-11 items-center justify-between gap-3 border-b border-[#eeeae3] py-2 text-sm transition-colors hover:text-accent ${focusClasses} ${
                              isActive(section.id) ? "font-semibold text-accent" : "text-[#172234]"
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
        )}

        {searchOpen && (
          <div
            ref={searchRef}
            id="global-evidence-search-panel"
            className="border-t border-[#d8d3c8] bg-white shadow-[0_18px_42px_rgba(23,34,52,0.18)]"
          >
            <EvidenceSearch onNavigate={closePanels} />
          </div>
        )}
      </nav>
    </>
  );
}
