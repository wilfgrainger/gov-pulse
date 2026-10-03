import { describe, expect, it } from "vitest";
import { filterPollingPublications, HISTORICAL_POLL_CORRECTIONS, pollingLabOptions, serializePollingCorrectionCsv, serializePollingCorrectionJson } from "@/app/lib/pollingLab";

const publications = [
  { id: "yougov-a", pollster: "YouGov", fieldworkStart: "2026-09-01", fieldworkEnd: "2026-09-03" },
  { id: "yougov-b", pollster: "YouGov", fieldworkStart: "2026-09-08", fieldworkEnd: "2026-09-10" },
  { id: "ipsos-a", pollster: "Ipsos", fieldworkStart: "2026-09-09", fieldworkEnd: "2026-09-11" },
];

describe("polling lab publication filters", () => {
  it("keeps publisher publications separate and filters on overlapping fieldwork dates", () => {
    const selected = filterPollingPublications(publications, { pollster: "all", from: "2026-09-10", to: "2026-09-10" });
    expect(selected.map(({ id }) => id)).toEqual(["yougov-b", "ipsos-a"]);
  });

  it("filters by the publisher identity without deriving an average", () => {
    const selected = filterPollingPublications(publications, { pollster: "YouGov", from: "", to: "" });
    expect(selected.map(({ id }) => id)).toEqual(["yougov-a", "yougov-b"]);
    expect(pollingLabOptions(publications)).toEqual(["Ipsos", "YouGov"]);
  });

  it("does not broaden an inverted date window into results", () => {
    expect(filterPollingPublications(publications, { pollster: "all", from: "2026-09-20", to: "2026-09-01" })).toEqual([]);
  });

  it("filters on disclosed publication dates without treating an unknown date as a match", () => {
    const dated = [
      { ...publications[0], publicationDate: "2026-09-03" },
      { ...publications[1], publicationDate: null },
      { ...publications[2], publicationDate: "2026-09-11" },
    ];
    const selected = filterPollingPublications(dated, {
      pollster: "all", from: "", to: "", publicationFrom: "2026-09-10", publicationTo: "2026-09-12",
    });
    expect(selected.map(({ id }) => id)).toEqual(["ipsos-a"]);
  });
});

describe("poll correction history exports", () => {
  it("exports the source-backed old and corrected values as JSON and CSV", () => {
    const json = JSON.parse(serializePollingCorrectionJson(HISTORICAL_POLL_CORRECTIONS));
    const csv = serializePollingCorrectionCsv(HISTORICAL_POLL_CORRECTIONS);

    expect(json.correctionHistory[0]).toMatchObject({
      pollster: "Ipsos",
      observationPeriod: "September 2013",
      correctedAt: "2013-10-03",
      sourceUrl: HISTORICAL_POLL_CORRECTIONS[0].sourceUrl,
      results: [
        { partyId: "snp", label: "Scottish National Party (SNP)", original: 41, corrected: 39 },
        { partyId: "labour", label: "Scottish Labour", original: 37, corrected: 35 },
        { partyId: "conservative", label: "Scottish Conservative and Unionist", original: 13, corrected: 12 },
        { partyId: "liberalDemocrats", label: "Scottish Liberal Democrat", original: 7, corrected: 7 },
      ],
    });
    expect(csv).toContain('"snp","Scottish National Party (SNP)","41","39","%"');
    expect(csv).toContain('"labour","Scottish Labour","37","35","%"');
    expect(csv).toContain(HISTORICAL_POLL_CORRECTIONS[0].sourceUrl);
  });

  it("neutralizes formula-leading text in correction CSVs", () => {
    const csv = serializePollingCorrectionCsv([{
      ...HISTORICAL_POLL_CORRECTIONS[0],
      results: [{ partyId: "other", label: "=HYPERLINK(\"https://example.test\")", original: 1, corrected: 2 }],
    }]);

    expect(csv).toContain("'=HYPERLINK(");
  });
});
