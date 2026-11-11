import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LeadNoticeCard, type LeadAward } from "@/app/components/ContractLeadNotice";

afterEach(cleanup);

const award: LeadAward = {
  rank: 1,
  key: "ocds-1",
  title: "Example award",
  buyer: "Example buyer",
  buyerId: "GB-FTS-1",
  suppliers: ["See Contracts Finder Notice for full supplier list", "Real Supplier Ltd"],
  supplierIds: ["GB-FTS-2", "GB-FTS-3"],
  awardDate: "2026-10-01T00:00:00Z",
  amount: 1000,
  valueBasis: "award-value",
  procurementMethod: null,
  procurementMethodDetails: null,
  framework: false,
  noticeUrl: "https://www.find-tender.service.gov.uk/Notice/1",
  procurementUrl: "https://www.find-tender.service.gov.uk/Notice/1",
};

it("does not link a placeholder supplier to a dossier that cannot exist", () => {
  render(<LeadNoticeCard award={award} />);
  expect(document.querySelector('a[href="/money/supplier/GB-FTS-2"]')).toBeNull();
  expect(screen.queryByText(/See Contracts Finder Notice/)).toBeNull();
  expect(document.querySelector('a[href="/money/supplier/GB-FTS-3"]')).not.toBeNull();
});
