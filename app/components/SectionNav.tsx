"use client";

import Link from "next/link";
import { publicationRoutePublished } from "@/contracts/publication-policy";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CategoryGroup } from "../lib/sections";
import BrandLogo from "./BrandLogo";
import EvidenceSearch from "./EvidenceSearch";
import PublicationFreshnessIndicator from "./PublicationFreshnessIndicator";
import SectionNavTopicsPanel from "./SectionNavTopicsPanel";

const QUICK_LINK_IDS = [
  "gdp",
  "economy",
  "nhs",
  "migration",
  "election-polls",
  "crime-stats",
] as const;

export default function SectionNav({ sections: configuredSections }: { sections: CategoryGroup[] }) {
  const sections = useMemo(() => configuredSections.map((group) => ({ ...group, sections: group.sections.filter((section) => publicationRoutePublished(`/section/${section.id}/`)) })).filter((group) => group.sections.length), [configuredSections]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const allSections = useMemo(() => sections.flatMap((group) => group.sections), [sections]);
  const quickLinks = QUICK_LINK_IDS.flatMap((id) => {
    const section = allSections.find((item) => item.id === id);
    return section ? [section] : [];
  });

  const isActive = (id: string) => pathname?.replace(/\/$/, "") === `/section/${id}`;

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      const targetElement = target instanceof Element ? target : null;
      const insideMenu = menuRef.current?.contains(target) ?? false;
      const insideSearch = searchRef.current?.contains(target) ?? false;
      const insideToggle = Boolean(targetElement?.closest("[data-publication-panel-toggle]"));
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
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  return (
    <header role="banner" className="w-full premium-sticky-chrome">
      <nav className="publication-masthead" aria-label="public-data.org navigation">
        <div className="edition-masthead-shell">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <Link
              href="/"
              prefetch={false}
              className={`inline-flex min-h-11 shrink-0 items-center ${focusClasses}`}
              aria-current={pathname === "/" ? "page" : undefined}
            >
              <BrandLogo compact />
            </Link>
            <PublicationFreshnessIndicator />
          </div>

          <div className="edition-doors order-3 w-full md:order-none md:w-auto md:justify-self-center">
            <Link href="/" prefetch={false} aria-current={pathname === "/" ? "page" : undefined} className={`edition-door ${focusClasses}`}>Latest</Link>
            <Link href="/explore/" prefetch={false} aria-current={pathname?.replace(/\/$/, "") === "/explore" ? "page" : undefined} className={`edition-door ${focusClasses}`}>Look up</Link>
            <Link href="/compare/" prefetch={false} aria-current={pathname?.replace(/\/$/, "") === "/compare" ? "page" : undefined} className={`edition-door ${focusClasses}`}>Compare</Link>
          </div>

          <div className="ml-auto flex items-center gap-1 justify-self-end sm:gap-2">
            <Link
              href="/sources"
              prefetch={false}
              className={`hidden min-h-11 items-center px-2 text-sm font-semibold text-[var(--muted)] underline decoration-white/20 underline-offset-4 hover:text-[var(--accent-on-dark)] sm:inline-flex ${focusClasses}`}
              aria-current={pathname === "/sources" ? "page" : undefined}
            >
              Sources
            </Link>
            <button
              ref={searchToggleRef}
              type="button"
              data-publication-panel-toggle
              onClick={toggleSearch}
              className={`inline-flex min-h-11 items-center border border-[var(--line-strong)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-white max-[359px]:px-2 sm:px-4 ${focusClasses}`}
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
              className={`inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors max-[359px]:px-2 sm:px-4 ${focusClasses}`}
              aria-expanded={menuOpen}
              aria-controls="all-topic-navigation"
            >
              <span>Topics</span>
              <span aria-hidden="true" className={`text-base transition-transform ${menuOpen ? "rotate-45" : ""}`}>+</span>
            </button>
          </div>
        </div>

        <div className="edition-quick-rail hidden md:block">
          <div className="mx-auto flex max-w-7xl items-center overflow-x-auto px-6 text-xs">
            <Link
              href="/"
              prefetch={false}
              className={`inline-flex min-h-11 shrink-0 items-center border-r border-[var(--line)] pr-4 font-semibold transition-colors hover:text-[var(--accent-on-dark)] ${focusClasses}`}
              aria-current={pathname === "/" ? "page" : undefined}
            >
              Latest
            </Link>
            {quickLinks.map((section) => (
              <Link
                key={section.id}
                href={`/section/${section.id}`}
                prefetch={false}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-r border-[var(--line)] px-3 font-medium transition-colors last:border-r-0 hover:text-[var(--accent-on-dark)] ${focusClasses} ${
                  isActive(section.id)
                    ? "bg-[var(--accent)] font-semibold text-white hover:bg-[var(--accent)] hover:text-white"
                    : "text-[var(--muted)]"
                }`}
                aria-current={isActive(section.id) ? "page" : undefined}
              >
                {section.shortLabel ?? section.label}
              </Link>
            ))}
          </div>
        </div>

        {menuOpen ? (
          <SectionNavTopicsPanel
            sections={sections}
            pathname={pathname}
            focusClasses={focusClasses}
            closePanels={closePanels}
            isActive={isActive}
            menuRef={menuRef}
          />
        ) : null}

        {searchOpen ? (
          <div ref={searchRef} id="global-evidence-search-panel" className="border-t border-[var(--line)] bg-[#11151a]">
            <EvidenceSearch onNavigate={closePanels} />
          </div>
        ) : null}
      </nav>
    </header>
  );
}
