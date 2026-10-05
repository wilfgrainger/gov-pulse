import { describe, expect, it } from "vitest";
import { HISTORICAL_POLL_CORRECTIONS } from "@/app/lib/pollingLab";
import {
  alignedPartyShares,
  buildPollingTable,
  distinctPollsters,
  POLLING_TABLE_PARTY_ORDER,
} from "@/app/lib/pollingTable";

const yougov = {
  id: "yougov-2026-09-01",
  pollster: "YouGov",
  fieldworkStart: "2026-09-01",
  fieldworkEnd: "2026-09-02",
  publicationDate: "2026-09-03",
  sampleSize: 2000,
  geography: "Great Britain",
  parties: {
    conservative: 18,
    labour: 22,
    liberalDemocrats: 12,
    reformUK: 28,
    green: 10,
    snp: 3,
    other: 7,
  },
  sourceUrl: "https://yougov.co.uk/example-tables",
};

const moreInCommon = {
  id: "mic-2026-09-05",
  pollster: "More in Common",
  fieldworkStart: "2026-09-04",
  fieldworkEnd: "2026-09-05",
  publicationDate: "2026-09-06",
  sampleSize: 1800,
  geography: "Great Britain",
  parties: {
    conservative: 17,
    labour: 23,
    liberalDemocrats: 11,
    reformUK: 27,
    green: 11,
    snp: 3,
    other: 8,
  },
  sourceUrl: "https://www.moreincommon.org.uk/example-workbook-note",
};

describe("pollingTable", () => {
  it("builds an aligned party-column table for two pollsters without an average", () => {
    const table = buildPollingTable([yougov, moreInCommon]);
    expect(table.includesAverage).toBe(false);
    expect(table.includesBettingMarkets).toBe(false);
    expect(distinctPollsters(table)).toEqual(["More in Common", "YouGov"]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows.every((row) => row.kind === "publication")).toBe(true);
    expect(table.partyColumns[0]).toBe("conservative");
    expect(table.partyColumns).toContain("labour");
    expect(table.partyColumns).toContain("reformUK");
    // No invented combined row
    expect(table.rows.map((row) => row.id)).toEqual([
      "yougov-2026-09-01",
      "mic-2026-09-05",
    ]);
  });

  it("omits any publication whose shares lack an https source URL", () => {
    const table = buildPollingTable([
      yougov,
      { ...moreInCommon, id: "no-source", sourceUrl: "" },
      { ...moreInCommon, id: "http-only", sourceUrl: "http://example.org/insecure" },
    ]);
    expect(table.rows.map((row) => row.id)).toEqual(["yougov-2026-09-01"]);
    expect(table.omittedWithoutSource).toBe(2);
  });

  it("keeps correction notices as their own rows with original and corrected shares", () => {
    const table = buildPollingTable([yougov], HISTORICAL_POLL_CORRECTIONS);
    const correction = table.rows.find((row) => row.kind === "correction");
    expect(correction).toMatchObject({
      kind: "correction",
      pollster: "Ipsos",
      sourceUrl: HISTORICAL_POLL_CORRECTIONS[0].sourceUrl,
    });
    if (!correction || correction.kind !== "correction") return;
    expect(correction.shares.snp).toBe(39);
    expect(correction.originalShares.snp).toBe(41);
    expect(correction.shares.labour).toBe(35);
    expect(correction.originalShares.labour).toBe(37);
  });

  it("aligns party shares to the fixed column order and drops non-finite values", () => {
    const shares = alignedPartyShares({
      labour: 20,
      conservative: 18,
      reformUK: Number.NaN,
      // @ts-expect-error deliberately invalid
      imaginary: 99,
    });
    expect(Object.keys(shares)).toEqual(
      POLLING_TABLE_PARTY_ORDER.filter((id) => id === "conservative" || id === "labour"),
    );
    expect(shares.reformUK).toBeUndefined();
  });
});
