import { describe, expect, it } from "vitest";
import { normalizeContractReleaseHistory } from "../../contracts/government-contracts.js";

const ocid = "ocds-h6vhtk-047306";

function packageFor(releases = [
  { ocid, id: "019679-2024", date: "2024-06-27T10:00:00Z", tag: ["planning"], tender: { title: "eDiscovery Retender Project" } },
  { ocid, id: "003183-2025", date: "2025-01-30T10:00:00Z", tag: ["tender"], tender: { title: "Provision or eDiscovery Solution" } },
  { ocid, id: "003386-2025", date: "2025-01-31T10:00:00Z", tag: ["tenderUpdate"], tender: { title: "Provision of an eDiscovery Solution", description: "Updated <strong>scope</strong> &amp; dates" } },
  { ocid, id: "023160-2026", date: "2026-03-13T10:00:00Z", tag: ["award", "contract"], tender: { title: "Provision of an eDiscovery Solution" }, awards: [{ id: "award-1" }] },
  { ocid, id: "023161-2026", date: "2026-03-14T10:00:00Z", tag: ["contractAmendment"], tender: { title: "Provision of an eDiscovery Solution" }, contracts: [{ id: "contract-1" }] },
]) {
  return { records: [{ ocid, releases }] };
}

describe("Find a Tender OCID release history", () => {
  it("normalizes dated source releases without joining notices, awards, or amendments", () => {
    const result = normalizeContractReleaseHistory(packageFor(), ocid);

    expect(result.ocid).toBe(ocid);
    expect(result.releases).toHaveLength(5);
    expect(result.releases.map((release) => release.tags)).toEqual([
      ["planning"], ["tender"], ["tenderUpdate"], ["award", "contract"], ["contractAmendment"],
    ]);
    expect(result.releases[2]).toMatchObject({
      id: "003386-2025",
      date: "2025-01-31T10:00:00.000Z",
      title: "Provision of an eDiscovery Solution",
      description: "Updated scope & dates",
      noticeUrl: "https://www.find-tender.service.gov.uk/Notice/003386-2025",
    });
    expect(result.releases[4].tags).toContain("contractAmendment");
    expect(result.source.packageUrl).toBe(`https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/${ocid}`);
  });

  it("rejects a package for another OCID and duplicate release identifiers", () => {
    expect(() => normalizeContractReleaseHistory(packageFor([{ ...packageFor().records[0].releases[0], ocid: "ocds-h6vhtk-999999" }]), ocid)).toThrow(/OCID/i);
    const duplicate = packageFor([packageFor().records[0].releases[0], packageFor().records[0].releases[0]]);
    expect(() => normalizeContractReleaseHistory(duplicate, ocid)).toThrow(/duplicate/i);
  });

  it("rejects malformed releases and packages too large to present as a complete history", () => {
    expect(() => normalizeContractReleaseHistory(packageFor([{ ...packageFor().records[0].releases[0], date: "unknown" }]), ocid)).toThrow(/date/i);
    expect(() => normalizeContractReleaseHistory(packageFor(Array.from({ length: 201 }, (_, index) => ({
      ...packageFor().records[0].releases[0], id: `${String(index).padStart(6, "0")}-2026`,
    }))), ocid)).toThrow(/200/);
  });
});
