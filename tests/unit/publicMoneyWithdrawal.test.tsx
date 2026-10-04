import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicMoneyPage, { metadata } from "@/app/money/page";
import SectionPage, { generateMetadata } from "@/app/section/[id]/page";
import SiteFooter from "@/app/components/SiteFooter";
import NationalEvidenceEdition from "@/app/components/NationalEvidenceEdition";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTIONS } from "@/app/lib/sections";
import { DIRECT_EVIDENCE_LINKS } from "@/app/lib/nationalEvidence";
import sitemap from "@/app/sitemap";

vi.mock("@/app/components/SectionNav", () => ({ default: () => null }));
vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot: vi.fn(async () => null) }));
vi.mock("@/app/lib/metricsSnapshot", async (original) => ({
  ...await original<typeof import("@/app/lib/metricsSnapshot")>(),
  fetchMetricsSnapshot: vi.fn(async () => { throw new Error("offline"); }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("temporary public-money withdrawal", () => {
  it.each(["/money/", "/section/government-contracts/"])("serves a withdrawal notice without reading award data on %s", async (route) => {
    const page = route === "/money/" ? await PublicMoneyPage() : await SectionPage({ params: Promise.resolve({ id: "government-contracts" }) });
    render(page);
    expect(screen.getByRole("heading", { name: "Public money is temporarily unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/return once the data has been reverified/i)).toBeInTheDocument();
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/£|Open notice dossier|Download filtered notices CSV/);
  });

  it("removes withdrawn destinations from navigation, homepage links, footer and sitemap", () => {
    const withdrawn = /\/(?:money|section\/government-contracts)\/?$/;
    expect(SECTIONS.flatMap((group) => group.sections).map((section) => section.id)).not.toContain("government-contracts");
    expect(DIRECT_EVIDENCE_LINKS.some((link) => withdrawn.test(link.href))).toBe(false);
    expect(sitemap().some((entry) => withdrawn.test(entry.url))).toBe(false);
    render(<SiteFooter />);
    expect(screen.getAllByRole("link").some((link) => withdrawn.test(link.getAttribute("href") ?? ""))).toBe(false);
  });

  it("does not promote the withdrawn explorer from the homepage", () => {
    render(<NationalEvidenceEdition initialEdition={{ generatedAt: null, lead: null, signals: [], counts: { current: 0, "update-due": 0, unavailable: 0 } }} />);
    expect(screen.queryAllByRole("link", { name: /public-money records|Government contracts/i })).toHaveLength(0);
  });

  it("marks both withdrawn pages as unavailable to search indexing", async () => {
    expect(metadata.robots).toMatchObject({ index: false });
    expect((await generateMetadata({ params: Promise.resolve({ id: "government-contracts" }) })).robots).toMatchObject({ index: false });
  });
});
