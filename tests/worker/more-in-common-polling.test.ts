import { describe, expect, it } from "vitest";
import {
  parseMoreInCommonArchiveLinks,
  parseMoreInCommonPoll,
} from "../../worker/more-in-common-polling.js";

describe("More in Common primary polling tables", () => {
  it("discovers only voting-intention workbooks hosted by the publisher", () => {
    const links = parseMoreInCommonArchiveLinks(`
      <a href="https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Voting-Intention-and-Trackers-25-29-Sept.xlsx">XLS</a>
      <a href="https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Voting-intention-and-trackers-18-21-September-2026.xlsx">XLS</a>
      <a href="https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Issues-25-29-Sept.xlsx">XLS</a>
      <a href="https://attacker.example/Voting-Intention-latest.xlsx">XLS</a>
    `);

    expect(links).toEqual([
      "https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Voting-Intention-and-Trackers-25-29-Sept.xlsx",
      "https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Voting-intention-and-trackers-18-21-September-2026.xlsx",
    ]);
  });

  it("uses source-disclosed fieldwork, headline base and weights without inventing a publication date", () => {
    const cover = new Map([
      ["C5", "25 - 29 September 2026"],
      ["C6", "2041"],
      ["C7", "GB adults (excludes Northern Ireland)"],
      ["C8", "Weighted by age/sex, region, 2024 General Election vote, ethnicity and education."],
      ["C9", "There is a 9 in 10 chance that the true value lies within 4 points; a 2 in 3 chance within 2 points."],
      ["C12", "More in Common is a member of the British Polling Council and abides by its rules"],
    ]);
    const headline = new Map([
      ["B5", "All"],
      ["A6", "Conservative"], ["B6", "0.22065684020654969"],
      ["A7", "Labour"], ["B7", "0.26892991045577291"],
      ["A8", "Liberal Democrat"], ["B8", "0.1106542872548356"],
      ["A9", "Reform UK"], ["B9", "0.20914587657259459"],
      ["A10", "Restore Britain"], ["B10", "5.8050049205183432E-2"],
      ["A11", "The Green Party"], ["B11", "8.513690959166742E-2"],
      ["A12", "Scottish National Party (SNP)"], ["B12", "2.8192170232397781E-2"],
      ["A13", "Plaid Cymru"], ["B13", "8.6147957330913669E-3"],
      ["A14", "Another party/Independent Candidate"], ["B14", "1.061916074790714E-2"],
      ["A15", "Unweighted N"], ["B15", "1514"],
      ["A17", "Weight"], ["B17", "GBNatRepWeight"],
    ]);

    const poll = parseMoreInCommonPoll(
      cover,
      headline,
      "https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Voting-Intention-and-Trackers-25-29-Sept.xlsx",
    );

    expect(poll).toMatchObject({
      id: "more-in-common-2026-09-29",
      pollster: "More in Common",
      publicationDate: null,
      publicationDateStatus: "not-disclosed",
      fieldworkStart: "2026-09-25",
      fieldworkEnd: "2026-09-29",
      sampleSize: 1514,
      sampleSizeNote: "Unweighted N on the headline table; workbook cover reports 2,041 total respondents.",
      geography: "Great Britain",
      population: "GB adults (excludes Northern Ireland)",
      questionText: null,
      mode: null,
      bpcMember: true,
    });
    expect(poll.parties).toMatchObject({
      conservative: 22.1,
      labour: 26.9,
      liberalDemocrats: 11.1,
      reformUK: 20.9,
      restoreBritain: 5.8,
      green: 8.5,
      snp: 2.8,
      plaidCymru: 0.9,
      other: 1.1,
    });
    expect(poll.headlineMethod).toContain("GBNatRepWeight");
    expect(poll.uncertainty).toContain("9 in 10 chance");
  });
});
