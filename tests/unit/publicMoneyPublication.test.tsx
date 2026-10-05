import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicMoneyPage, { metadata } from "@/app/money/page";
import SectionPage, { generateMetadata } from "@/app/section/[id]/page";
import SiteFooter from "@/app/components/SiteFooter";
import NationalEvidenceEdition from "@/app/components/NationalEvidenceEdition";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { SECTION_DISCOVERY } from "@/app/lib/discovery";
import { SECTIONS } from "@/app/lib/sections";
import { DIRECT_EVIDENCE_LINKS } from "@/app/lib/nationalEvidence";
import sitemap from "@/app/sitemap";
import {
  CAVEATS,
  EVIDENCE_POLICY,
  buildGovernmentContractsPayload,
  buildSummary,
} from "@/contracts/government-contracts";

const { snapshotState } = vi.hoisted(() => ({ snapshotState: { value: null as unknown } }));

vi.mock("@/app/components/SectionNav", () => ({ default: () => null }));
vi.mock("@/app/components/PublicMoneyExplorer", () => ({
  default: ({ awards, windowLabel, completeWindowComparableAwardCount }: { awards: Array<{ releaseId: string }>; windowLabel: string; completeWindowComparableAwardCount: number }) => (
    <p>{awards.length} records from {windowLabel}; {completeWindowComparableAwardCount} comparable awards; first notice {awards[0]?.releaseId}</p>
  ),
}));
vi.mock("@/app/components/GovernmentContracts", () => ({
  default: () => <p>Government-contracts source reader</p>,
}));
vi.mock("@/app/lib/serverMetricsSnapshot", () => ({
  readServerMetricsSnapshot: vi.fn(async () => snapshotState.value),
}));

const WINDOW_LABEL = "2026-09-27 to 2026-10-03";
const OBSERVATION_TIME = new Date("2026-10-04T23:59:59.999Z");

function currentContractsPayload() {
  const awards = Array.from({ length: 100 }, (_, index) => {
    const ocid = `ocds-h6vhtk-${(index + 1).toString(16).padStart(8, "0")}`;
    const releaseId = `${String(92585 + index).padStart(6, "0")}-2026`;
    const awardId = `award-${index + 1}`;
    return {
      rank: index + 1,
      key: `${ocid}:${awardId}`,
      ocid,
      releaseId,
      awardId,
      title: `Public award ${index + 1}`,
      buyer: `Buyer ${index + 1}`,
      buyerId: `GB-BUYER-${index + 1}`,
      suppliers: [`Supplier ${index + 1}`],
      supplierIds: [`GB-SUPPLIER-${index + 1}`],
      supplierNations: ["Other/Unknown"],
      awardDate: "2026-09-30T15:00:00.000Z",
      publishedAt: "2026-09-30T15:58:23.000Z",
      amount: 500_000_000 - index * 1_000_000,
      currency: "GBP" as const,
      valueBasis: "award-value" as const,
      procurementMethod: "open",
      procurementMethodDetails: "Open procedure",
      mainProcurementCategory: "services",
      framework: false,
      noticeUrl: `https://www.find-tender.service.gov.uk/Notice/${releaseId}`,
      procurementUrl: `https://www.find-tender.service.gov.uk/procurement/${ocid}`,
    };
  });

  return buildGovernmentContractsPayload(
    {
      available: true,
      generatedAt: OBSERVATION_TIME.toISOString(),
      window: {
        updatedFrom: "2026-09-27T00:00:00.000Z",
        updatedTo: "2026-10-03T23:59:59.999Z",
        label: WINDOW_LABEL,
        basis: "Find a Tender award-stage releases from seven complete UTC day shards collected by public-data.org",
      },
      source: {},
      summary: buildSummary(awards),
      awards,
      dataQuality: {
        pagesFetched: 28,
        requestsMade: 28,
        releasesSeen: 269,
        awardsSeen: 915,
        validComparableAwards: 881,
        excludedMissingValue: 34,
        excludedAmbiguousContractValue: 0,
        excludedNonGbp: 0,
        excludedMissingBuyer: 0,
        excludedMissingSupplier: 0,
        excludedMalformed: 0,
        duplicatesRemoved: 0,
      },
      caveats: [...CAVEATS],
      evidencePolicy: { ...EVIDENCE_POLICY },
    },
    OBSERVATION_TIME,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00.000Z"));
  snapshotState.value = { governmentContracts: currentContractsPayload() };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("verified public-money publication", () => {
  it("serves the complete current seven-day edition through the dossier route", async () => {
    render(await PublicMoneyPage());

    expect(screen.getByRole("heading", { name: "Public money dossiers" })).toBeInTheDocument();
    expect(screen.getByText("Current complete window: 2026-09-27 to 2026-10-03. Find a Tender award-stage releases from seven complete UTC day shards collected by public-data.org"))
      .toBeInTheDocument();
    expect(screen.getByText("100 records from 2026-09-27 to 2026-10-03; 881 comparable awards; first notice 092585-2026"))
      .toBeInTheDocument();
    expect(readServerMetricsSnapshot).toHaveBeenCalledOnce();
  });

  it("keeps missing source evidence unavailable rather than presenting empty totals", async () => {
    snapshotState.value = null;

    render(await PublicMoneyPage());

    expect(screen.getByRole("heading", { name: "No complete current award universe is available" }))
      .toBeInTheDocument();
    expect(screen.queryByText(/\d+ records from/)).not.toBeInTheDocument();
  });

  it("restores the dedicated government-contracts route and search metadata", async () => {
    render(await SectionPage({ params: Promise.resolve({ id: "government-contracts" }) }));

    expect(screen.getByRole("heading", { name: "Government contracts" })).toBeInTheDocument();
    expect(screen.getByText("Government-contracts source reader")).toBeInTheDocument();
    expect(SECTION_DISCOVERY["government-contracts"].kind).toBe("dataset");
    expect((await generateMetadata({ params: Promise.resolve({ id: "government-contracts" }) })).robots?.index)
      .not.toBe(false);
    expect(metadata.robots?.index).not.toBe(false);
  });

  it("restores public-money entry points in navigation, the front page, footer, and sitemap", () => {
    expect(SECTIONS.flatMap((group) => group.sections).map((section) => section.id))
      .toContain("government-contracts");
    expect(DIRECT_EVIDENCE_LINKS.some((link) => link.href === "/section/government-contracts"))
      .toBe(true);
    expect(sitemap().some((entry) => entry.url.endsWith("/money/"))).toBe(true);
    expect(sitemap().some((entry) => entry.url.endsWith("/section/government-contracts/")))
      .toBe(true);

    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Public-money dossiers" })).toHaveAttribute("href", "/money");
    cleanup();

    render(<NationalEvidenceEdition initialEdition={{ generatedAt: null, lead: null, signals: [], counts: { current: 0, "update-due": 0, unavailable: 0 } }} />);
    expect(screen.getByRole("link", { name: /Explore public-money records/ })).toHaveAttribute("href", "/money");
  });
});
