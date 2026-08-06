import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionNav from "@/app/components/SectionNav";
import SiteFooter from "@/app/components/SiteFooter";
import { SECTIONS } from "@/app/lib/sections";

const TRUST_PAGES = {
  about: {
    title: "About public-data.org",
    eyebrow: "Independent public evidence",
    intro:
      "public-data.org turns important UK publications into readable, source-linked evidence without inventing missing values or combining incompatible measures.",
    sections: [
      [
        "What the publication does",
        "The service selects bounded public-interest measures, preserves each source's observation period and revision status, and links readers back to the original publisher.",
      ],
      [
        "What it does not do",
        "It does not present itself as an official statistics producer, a polling average, a forecast service or a substitute for the named source publication.",
      ],
      [
        "Ownership",
        "Source publishers own their publications. public-data.org owns its selection, presentation, validation rules and editorial explanations.",
      ],
    ],
  },
  "editorial-policy": {
    title: "Editorial and evidence policy",
    eyebrow: "How publication decisions are made",
    intro:
      "The editorial rule is simple: show the latest evidence that can be reproduced and explained, or show an explicit unavailable state.",
    sections: [
      [
        "Evidence classes",
        "Official statistics, administrative data, primary polling and commercial market signals remain visibly separate. Their values are never added into a synthetic national score.",
      ],
      [
        "Dates and revisions",
        "Observation, publication, retrieval and revision dates are separate fields. A later technical check does not renew the age of unchanged evidence.",
      ],
      [
        "Fail-closed publication",
        "A value is withheld when provenance, completeness, currentness or the intended comparison cannot be proved from the source contract.",
      ],
    ],
  },
  independence: {
    title: "Independence and funding disclosure",
    eyebrow: "Editorial independence",
    intro:
      "No sponsor, advertiser, political party or source publisher is given control over metric selection, ranking or wording.",
    sections: [
      [
        "Current disclosure",
        "The publication does not claim external institutional funding or sponsorship. Any future material funding, paid partnership or conflict will be disclosed here before related editorial work is published.",
      ],
      [
        "Commercial boundaries",
        "Contract values are not labelled waste or fraud without direct evidence. Betting prices are labelled commercial signals, not forecasts or official statistics.",
      ],
      [
        "Audit trail",
        "Material product and evidence decisions are reviewable through the public repository, source register and dated correction record.",
      ],
    ],
  },
  contact: {
    title: "Contact public-data.org",
    eyebrow: "Questions, evidence and corrections",
    intro:
      "Use the public repository for a traceable response. Do not include private, confidential or legally restricted information.",
    sections: [
      [
        "Report an evidence problem",
        "Open a GitHub issue with the page, displayed value, source publication and the correction you believe is required.",
      ],
      [
        "Suggest a dataset",
        "Name the primary publisher, stable publication route, update cadence, geography, definition and why the measure is useful to the public.",
      ],
      [
        "Public contact route",
        "GitHub issues are the supported contact channel so evidence, decisions and resolution remain visible and auditable.",
      ],
    ],
  },
  corrections: {
    title: "Corrections policy",
    eyebrow: "Correct the record, visibly",
    intro:
      "Material errors are corrected at the evidence contract or publication layer and recorded with the reason, affected period and verification proof.",
    sections: [
      [
        "What counts as a correction",
        "Wrong values, dates, units, geography, source attribution, comparison wording or revision handling require a correction. A routine source revision is labelled as a revision rather than hidden.",
      ],
      [
        "Correction sequence",
        "Reproduce the problem, withdraw unsafe output where necessary, fix the narrowest shared cause, run the relevant contracts and record the decision in the repository.",
      ],
      [
        "Historical integrity",
        "A corrected edition does not pretend the earlier edition never existed. Release evidence and repository history preserve the audit trail.",
      ],
    ],
  },
} as const;

type TrustPage = keyof typeof TRUST_PAGES;

export function generateStaticParams() {
  return Object.keys(TRUST_PAGES).map((trust) => ({ trust }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trust: string }>;
}): Promise<Metadata> {
  const { trust } = await params;
  const page = TRUST_PAGES[trust as TrustPage];
  if (!page) return {};
  return {
    title: page.title,
    description: page.intro,
    alternates: { canonical: `/${trust}` },
  };
}

export default async function TrustPageRoute({
  params,
}: {
  params: Promise<{ trust: string }>;
}) {
  const { trust } = await params;
  const page = TRUST_PAGES[trust as TrustPage];
  if (!page) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50 bg-white">
        <SectionNav sections={SECTIONS} />
      </div>
      <main>
        <header className="border-b border-black/15 px-4 py-10 md:px-6 md:py-14">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold text-accent">{page.eyebrow}</p>
            <h1 className="mt-3 font-display text-4xl leading-tight md:text-6xl">
              {page.title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-700">
              {page.intro}
            </p>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
          <div className="grid gap-8 md:grid-cols-3">
            {page.sections.map(([heading, body]) => (
              <section key={heading} className="border-t border-black/20 pt-4">
                <h2 className="text-xl font-semibold">{heading}</h2>
                <p className="mt-3 text-sm leading-6 text-gray-700">{body}</p>
              </section>
            ))}
          </div>
          {trust === "about" ? (
            <section id="open-code" className="mt-10 border border-black/15 bg-white p-6 md:p-8">
              <p className="text-sm font-semibold text-accent">Public code and accountability</p>
              <h2 className="mt-3 font-display text-3xl leading-tight md:text-4xl">
                Inspect how the service is built.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-700">
                The public repository contains the site, evidence contracts, source-specific validation, tests and deployment configuration. It is there so readers and contributors can inspect the rules behind the publication, raise a traceable issue and follow material decisions.
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-700">
                The repository is public for inspection, but it does not currently declare a project-wide open-source licence. That means this transparency statement is not a blanket permission to reuse the software. The named publishers, government data, fonts and other third-party materials keep their own licence terms.
              </p>
              <a
                className="mt-6 inline-flex min-h-11 items-center border border-foreground px-5 py-3 text-sm font-semibold hover:bg-foreground hover:text-white"
                href="https://github.com/wilfgrainger/gov-pulse"
                target="_blank"
                rel="noreferrer"
              >
                Inspect the public repository
              </a>
            </section>
          ) : null}
          {trust === "contact" ? (
            <a
              className="mt-10 inline-flex min-h-11 items-center border border-foreground px-5 py-3 text-sm font-semibold hover:bg-foreground hover:text-white"
              href="https://github.com/wilfgrainger/gov-pulse/issues/new"
              target="_blank"
              rel="noreferrer"
            >
              Open a public GitHub issue
            </a>
          ) : null}
          <p className="mt-10 text-sm text-gray-600">
            <Link href="/sources" className="font-semibold underline underline-offset-4">
              Review sources and update dates
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
