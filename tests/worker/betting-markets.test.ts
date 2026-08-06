// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  EVIDENCE_POLICY,
  MARKET_DEFINITIONS,
  isCurrentBettingMarketPayload,
  normalizeBettingMarketPayload,
} from "@/contracts/betting-markets";
import * as workerContract from "@/worker/betting-markets";

const now = new Date("2026-07-14T12:00:00.000Z");

function runners(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix} ${index + 1}`,
    decimalOdds: 2 + index,
  }));
}

function rawSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    provider: "Oddschecker",
    observedAt: "2026-07-14T10:00:00.000Z",
    markets: [
      {
        id: "nextPrimeMinister",
        sourceUrl: MARKET_DEFINITIONS.nextPrimeMinister.sourceUrl,
        runners: runners(5, "Candidate"),
      },
      {
        id: "mostSeats",
        sourceUrl: MARKET_DEFINITIONS.mostSeats.sourceUrl,
        runners: runners(3, "Party"),
      },
      {
        id: "electionYear",
        sourceUrl: MARKET_DEFINITIONS.electionYear.sourceUrl,
        runners: runners(2, "Year"),
      },
    ],
    ...overrides,
  };
}

function canonicalSnapshot() {
  return normalizeBettingMarketPayload(rawSnapshot(), now);
}

describe("shared betting market evidence contract", () => {
  it("keeps existing Worker imports as a thin compatibility boundary", () => {
    expect(workerContract.normalizeBettingMarketPayload).toBe(normalizeBettingMarketPayload);
    expect(workerContract.isCurrentBettingMarketPayload).toBe(isCurrentBettingMarketPayload);
    expect(workerContract.MARKET_DEFINITIONS).toBe(MARKET_DEFINITIONS);
  });

  it("preserves raw decimal odds and calculates reciprocal percentages without normalization", () => {
    const result = canonicalSnapshot();

    expect(result).toMatchObject({
      available: true,
      provider: "Oddschecker",
      observedAt: "2026-07-14T10:00:00.000Z",
      expiresAt: "2026-07-14T14:00:00.000Z",
      evidencePolicy: EVIDENCE_POLICY,
      __observation: {
        status: "current",
        period: "2026-07-14T10:00:00.000Z",
        observedAt: "2026-07-14T10:00:00.000Z",
        checkedAt: now.toISOString(),
        maxAgeDays: 1,
      },
    });
    expect(result.markets.map((market) => market.id)).toEqual([
      "nextPrimeMinister",
      "mostSeats",
      "electionYear",
    ]);
    expect(result.markets[0].runners[0]).toEqual({
      name: "Candidate 1",
      decimalOdds: 2,
      impliedProbability: 50,
    });
    expect(result.markets[0].marketBookPercent).not.toBe(100);
    expect(result).not.toHaveProperty("nextPmOdds");
    expect(isCurrentBettingMarketPayload(result, now)).toBe(true);
  });

  it("rejects stale and future snapshots", () => {
    expect(() =>
      normalizeBettingMarketPayload(
        rawSnapshot({ observedAt: "2026-07-14T07:59:59.000Z" }),
        now
      )
    ).toThrow(/older than four hours/i);

    expect(() =>
      normalizeBettingMarketPayload(
        rawSnapshot({ observedAt: "2026-07-14T12:06:00.000Z" }),
        now
      )
    ).toThrow(/cannot be in the future/i);

    expect(
      isCurrentBettingMarketPayload(
        canonicalSnapshot(),
        new Date("2026-07-14T14:00:01.000Z")
      )
    ).toBe(false);
  });

  it("rejects wrong provenance, incomplete sets and duplicate markets", () => {
    const wrongUrl = rawSnapshot();
    wrongUrl.markets[0].sourceUrl = "https://www.oddschecker.com/politics";
    expect(() => normalizeBettingMarketPayload(wrongUrl, now)).toThrow(
      /source URL does not match/i
    );

    const incomplete = rawSnapshot();
    incomplete.markets = incomplete.markets.slice(0, 2);
    expect(() => normalizeBettingMarketPayload(incomplete, now)).toThrow(
      /exactly three approved markets/i
    );

    const duplicateMarket = rawSnapshot();
    duplicateMarket.markets[2] = structuredClone(duplicateMarket.markets[1]);
    expect(() => normalizeBettingMarketPayload(duplicateMarket, now)).toThrow(
      /each approved market exactly once/i
    );

    expect(() =>
      normalizeBettingMarketPayload(rawSnapshot({ provider: "Unknown" }), now)
    ).toThrow(/Only Oddschecker/i);
  });

  it("rejects coerced odds, duplicate runners and missing fields", () => {
    const coerced = rawSnapshot();
    coerced.markets[0].runners[0].decimalOdds = "2" as unknown as number;
    expect(() => normalizeBettingMarketPayload(coerced, now)).toThrow(
      /invalid decimal odds/i
    );

    const duplicate = rawSnapshot();
    duplicate.markets[0].runners[1].name = duplicate.markets[0].runners[0].name;
    expect(() => normalizeBettingMarketPayload(duplicate, now)).toThrow(
      /duplicate runner/i
    );

    const missingName = rawSnapshot();
    delete (missingName.markets[0].runners[0] as { name?: string }).name;
    expect(() => normalizeBettingMarketPayload(missingName, now)).toThrow(
      /runner name is required/i
    );
  });

  it("rejects tampering with canonical derived fields and evidence policy", () => {
    for (const mutate of [
      (value: ReturnType<typeof canonicalSnapshot>) => {
        value.markets[0].title = "Altered market title";
      },
      (value: ReturnType<typeof canonicalSnapshot>) => {
        value.markets[0].runnerCount += 1;
      },
      (value: ReturnType<typeof canonicalSnapshot>) => {
        value.markets[0].marketBookPercent += 0.01;
      },
      (value: ReturnType<typeof canonicalSnapshot>) => {
        value.markets[0].runners[0].impliedProbability += 0.01;
      },
      (value: ReturnType<typeof canonicalSnapshot>) => {
        value.evidencePolicy.predictiveClaim = true;
      },
    ]) {
      const value = canonicalSnapshot();
      mutate(value);
      expect(isCurrentBettingMarketPayload(value, now)).toBe(false);
    }
  });

  it("requires internally consistent observation metadata", () => {
    const missing = canonicalSnapshot();
    delete (missing as { __observation?: unknown }).__observation;
    expect(isCurrentBettingMarketPayload(missing, now)).toBe(false);

    const wrongPeriod = canonicalSnapshot();
    wrongPeriod.__observation.period = "2026-07-13T10:00:00.000Z";
    expect(isCurrentBettingMarketPayload(wrongPeriod, now)).toBe(false);

    const futureCheck = canonicalSnapshot();
    futureCheck.__observation.checkedAt = "2026-07-14T12:06:00.000Z";
    expect(isCurrentBettingMarketPayload(futureCheck, now)).toBe(false);

    expect(
      isCurrentBettingMarketPayload(
        { nextPmOdds: [{ name: "Legacy", probability: 50 }] },
        now
      )
    ).toBe(false);
  });
});
