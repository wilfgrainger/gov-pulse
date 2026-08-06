// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  isCurrentPrimaryPollPayload,
  normalizePrimaryPollPayload,
} from "@/worker/election-polls";

function poll(overrides: Record<string, unknown> = {}) {
  return {
    id: "yougov-2026-07-26-27-mrp-headline",
    pollster: "YouGov",
    commissioner: "The Times and Sky News",
    title: "Voting intention, 26-27 July 2026: Ref 22%, Lab 22%, Con 21%, Grn 13%, LD 11%",
    questionText: "Now, thinking specifically about your own constituency, if there were a general election held tomorrow and these were the parties standing, which party would you vote for?",
    publicationDate: "2026-07-27",
    fieldworkStart: "2026-07-26",
    fieldworkEnd: "2026-07-27",
    sampleSize: 2328,
    geography: "Great Britain",
    population: "GB adults",
    mode: "Online panel",
    headlineMethod: "Headline voting intention from constituency vote projected by YouGov's MRP model",
    parties: {
      conservative: 21,
      labour: 22,
      liberalDemocrats: 11,
      reformUK: 22,
      green: 13,
      snp: 2,
      plaidCymru: 1,
      yourParty: 1,
      restoreBritain: 4,
      other: 2,
    },
    sourceUrl: "https://ygo-assets-websites-editorial-emea.yougov.net/documents/VotingIntention_MRP_Results_260727_w.pdf",
    methodologyUrl: "https://yougov.com/en-gb/articles/54278-how-yougov-conducts-voting-intention-polling",
    bpcMember: true,
    uncertainty: "Published estimates have an approximate 9-in-10 interval of plus or minus four points.",
    ...overrides,
  };
}

const validationTime = new Date("2026-08-02T04:30:00.000Z");

describe("primary election poll evidence contract", () => {
  it("normalizes one complete current primary publication without calculating an average", () => {
    const result = normalizePrimaryPollPayload({ polls: [poll()] }, validationTime);

    expect(result).toMatchObject({
      available: true,
      latestPublicationDate: "2026-07-27",
      aggregation: { method: "none" },
      evidencePolicy: {
        sourceClass: "primary-pollster-publication",
        bpcDisclosureRequired: true,
        secondaryAggregatorsUsedAsData: false,
      },
    });
    expect(result.polls[0]).toMatchObject({
      pollster: "YouGov",
      commissioner: "The Times and Sky News",
      sampleSize: 2328,
      methodologyUrl:
        "https://yougov.com/en-gb/articles/54278-how-yougov-conducts-voting-intention-polling",
      parties: { reformUK: 22, conservative: 21, labour: 22 },
    });
    expect(result).not.toHaveProperty("pollingData");
    expect(result).not.toHaveProperty("recentPolls");
  });

  it("preserves the source publication date as the observation clock", () => {
    const result = normalizePrimaryPollPayload({ polls: [poll()] }, validationTime);

    expect(result.expiresAt).toBe("2026-08-10T00:00:00.000Z");
    expect(result.__observation).toMatchObject({
      status: "current",
      period: "2026-07-26/2026-07-27",
      observedAt: "2026-07-27T00:00:00.000Z",
      maxAgeDays: 14,
    });
    expect(isCurrentPrimaryPollPayload(result, validationTime)).toBe(true);
    expect(isCurrentPrimaryPollPayload(result, new Date("2026-08-11T00:00:00Z"))).toBe(false);
  });

  it("rejects secondary or unapproved source hosts", () => {
    expect(() =>
      normalizePrimaryPollPayload(
        { polls: [poll({ sourceUrl: "https://en.wikipedia.org/wiki/Opinion_polling" })] },
        validationTime
      )
    ).toThrow(/not an approved primary publisher/i);
  });

  it.each([
    ["commissioner", { commissioner: "" }],
    ["question wording", { questionText: "" }],
    ["BPC membership", { bpcMember: false }],
    ["sample size", { sampleSize: 100 }],
  ])("rejects missing or invalid %s disclosure", (_label, overrides) => {
    expect(() =>
      normalizePrimaryPollPayload({ polls: [poll(overrides)] }, validationTime)
    ).toThrow();
  });

  it("rejects values that JavaScript would otherwise coerce into numbers", () => {
    expect(() =>
      normalizePrimaryPollPayload(
        { polls: [poll({ sampleSize: "2328" })] },
        validationTime
      )
    ).toThrow(/sample size must be an integer/i);

    expect(() =>
      normalizePrimaryPollPayload(
        {
          polls: [
            poll({
              parties: {
                conservative: 21,
                labour: 22,
                liberalDemocrats: 11,
                reformUK: "22",
                green: 13,
                snp: 2,
                plaidCymru: 1,
                yourParty: 1,
                restoreBritain: 4,
                other: 2,
              },
            }),
          ],
        },
        validationTime
      )
    ).toThrow(/Reform UK share must be a number/i);
  });

  it("rejects incomplete party coverage and implausible published totals", () => {
    expect(() =>
      normalizePrimaryPollPayload(
        {
          polls: [
            poll({
              parties: {
                conservative: 21,
                labour: 22,
                liberalDemocrats: 11,
                reformUK: 22,
              },
            }),
          ],
        },
        validationTime
      )
    ).toThrow(/missing Green/i);

    expect(() =>
      normalizePrimaryPollPayload(
        {
          polls: [
            poll({
              parties: {
                conservative: 10,
                labour: 10,
                liberalDemocrats: 10,
                reformUK: 10,
                green: 10,
              },
            }),
          ],
        },
        validationTime
      )
    ).toThrow(/total approximately 100/i);
  });

  it("rejects duplicate publications and stale evidence", () => {
    expect(() =>
      normalizePrimaryPollPayload({ polls: [poll(), poll()] }, validationTime)
    ).toThrow(/must be unique/i);

    expect(() =>
      normalizePrimaryPollPayload(
        { polls: [poll()] },
        new Date("2026-08-11T00:00:00.000Z")
      )
    ).toThrow(/older than 14 days/i);
  });

  it("rejects impossible dates and publication before fieldwork completion", () => {
    expect(() =>
      normalizePrimaryPollPayload(
        { polls: [poll({ publicationDate: "2026-02-30" })] },
        validationTime
      )
    ).toThrow(/valid calendar date/i);

    expect(() =>
      normalizePrimaryPollPayload(
        { polls: [poll({ publicationDate: "2026-07-26" })] },
        validationTime
      )
    ).toThrow(/must not precede fieldwork end/i);
  });
});
