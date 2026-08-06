import Link from "next/link";
import { SECTIONS } from "../lib/sections";
import BrandLogo from "./BrandLogo";

const publicationLinks = [
  ["Sources and methods", "/sources"],
  ["About", "/about"],
  ["Editorial policy", "/editorial-policy"],
  ["Independence and funding", "/independence"],
  ["Corrections", "/corrections"],
  ["Contact", "/contact"],
] as const;

export default function SiteFooter() {
  return (
    <footer className="v3-footer border-t border-[#263852] px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 border-b border-white/20 pb-9 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="eyebrow eyebrow-on-dark">Independent public evidence</p>
            <h2 className="font-display mt-3 max-w-4xl text-4xl leading-[0.98] text-white md:text-5xl">
              Evidence worth inspecting.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Start with the latest accepted figure, then inspect its period, definition, caveat and original publisher.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/" prefetch={false} className="inline-flex min-h-11 items-center border border-white bg-white px-4 py-2 text-sm font-semibold !text-[#172234] hover:!bg-[#f6a5ad]">
              Latest edition
            </Link>
            <Link href="/sources" prefetch={false} className="inline-flex min-h-11 items-center border border-white/50 px-4 py-2 text-sm font-semibold text-white hover:border-white">
              Sources and methods
            </Link>
          </div>
        </div>

        <div className="grid gap-10 pt-10 lg:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))]">
          <div>
            <BrandLogo inverse />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
              Independent UK public evidence, checked against the original publication.
            </p>
            <p className="mt-5 text-xs leading-5 text-slate-400">
              Figures remain subject to the definitions, revisions and limitations of their named publishers.
            </p>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              Contains public sector information licensed under the{" "}
              <a
                href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-white/30 underline-offset-4"
              >
                Open Government Licence v3.0
              </a>
              , except where otherwise stated.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Educational and public-evidence information only; not financial, investment or betting advice.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              This static website does not place cookies on your device or collect personal data.
            </p>
          </div>

          {SECTIONS.map((group) => (
            <nav key={group.category} aria-label={`${group.category} footer links`}>
              <h2 className="eyebrow eyebrow-on-dark">{group.category}</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                {group.sections.map((section) => (
                  <li key={section.id}>
                    <Link
                      href={`/section/${section.id}`}
                      prefetch={false}
                      className="underline decoration-white/20 underline-offset-4 transition-colors hover:decoration-white"
                    >
                      {section.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <nav aria-label="Publication information">
            <h2 className="eyebrow eyebrow-on-dark">Publication</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {publicationLinks.map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    prefetch={false}
                    className="underline decoration-white/20 underline-offset-4 transition-colors hover:decoration-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/wilfgrainger/gov-pulse"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-white/20 underline-offset-4 transition-colors hover:decoration-white"
                >
                  Code and decisions
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
