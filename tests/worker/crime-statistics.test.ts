// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  CRIME_OBSERVATION_MAX_AGE_DAYS,
  ONS_PUBLICATION_LANDING_URL,
  buildCurrentCrimeStatisticsPayload,
  isCurrentCrimeStatisticsPayload,
  normalizeCrimeStatisticsPayload,
} from "@/contracts/crime-statistics";
import { buildCrimeStatistics } from "@/worker/crime-statistics";
import {
  collectCrimeStatistics,
  parseOnsCrimeBulletin,
} from "@/worker/live-crime-collector";
import { sectionCurrentness } from "@/worker/publication-currentness";
import {
  CRIME_BULLETIN_HTML,
  CRIME_EDITION_URL,
  CRIME_LATEST_HTML,
} from "@/tests/fixtures/crime-publication";

const now = new Date("2026-08-02T04:30:00.000Z");
const source = () => parseOnsCrimeBulletin(CRIME_BULLETIN_HTML, CRIME_EDITION_URL);

function fetcher() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === ONS_PUBLICATION_LANDING_URL) {
      return new Response(CRIME_LATEST_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }
    if (url === CRIME_EDITION_URL) {
      return new Response(CRIME_BULLETIN_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("modular crime evidence contract", () => {
  it("collects the current ONS, police-recorded and MoJ modules without a synthetic total", async () => {
    const fetchImpl = fetcher();
    const payload = await buildCrimeStatistics(now, fetchImpl);

    expect(payload).toMatchObject({
      available: true,
      expiresAt: "2026-10-22T00:00:00.000Z",
      headline: {
        publisher: "Office for National Statistics",
        period: "Year ending March 2026",
        observedAt: "2026-03-31",
        releaseDate: "2026-07-23",
        nextReleaseDate: "2026-10-22",
        geography: "England and Wales",
      },
      crimeSurvey: { status: "available" },
      policeRecorded: { status: "available" },
      justice: { status: "available", period: "January to March 2026" },
      regional: { status: "unavailable" },
      evidencePolicy: {
        combinedTotalAllowed: false,
        modulesValidatedIndependently: true,
        regionalRankingPublished: false,
      },
      __observation: {
        status: "current",
        period: "Year ending March 2026",
        observedAt: "2026-03-31T00:00:00.000Z",
        maxAgeDays: CRIME_OBSERVATION_MAX_AGE_DAYS,
      },
    });
    expect(
      payload.crimeSurvey.measures.find((item) => item.id === "headlineCrime")
    ).toMatchObject({ value: 9_600_000, displayValue: "9.6 million" });
    expect(
      payload.crimeSurvey.measures.find((item) => item.id === "otherHouseholdTheft")
    ).toMatchObject({
      value: 791_000,
      changeLabel: "21% higher than the previous survey",
    });
    expect(
      payload.policeRecorded.measures.find((item) => item.id === "homicide")
    ).toMatchObject({
      value: 499,
      changeLabel: "7% lower than the previous year · 8.1 per million people",
    });
    expect(
      payload.policeRecorded.measures.find((item) => item.id === "shoplifting")
    ).toMatchObject({
      value: 507_086,
      changeLabel: "4% lower than the previous year",
    });
    expect(payload.policeRecorded.caveat).toMatch(/Report Fraud/i);
    expect(isCurrentCrimeStatisticsPayload(payload, now)).toBe(true);
    expect(
      sectionCurrentness(
        "crimeStatistics",
        payload,
        {
          status: "ok",
          cacheState: "fresh",
          fetchedAt: now.toISOString(),
          provenance: { section: "crimeStatistics" },
        },
        now
      )
    ).toEqual({ current: true, reason: "current" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("exposes the parser as a deterministic primary-publication contract", () => {
    const payload = source();
    expect(payload.headline.publicationUrl).toBe(CRIME_EDITION_URL);
    expect(payload.crimeSurvey.measures.map((measure) => measure.id)).toEqual([
      "headlineCrime",
      "theft",
      "otherHouseholdTheft",
      "fraud",
      "computerMisuse",
      "violence",
      "criminalDamage",
    ]);
    expect(payload.policeRecorded.measures.map((measure) => measure.id)).toEqual([
      "recordedCrime",
      "homicide",
      "knife",
      "firearms",
      "personalRobbery",
      "shoplifting",
    ]);
  });

  it("rejects missing modules, malformed numbers and unapproved sources", () => {
    const missing = source();
    missing.crimeSurvey.measures = missing.crimeSurvey.measures.slice(1);
    expect(() => normalizeCrimeStatisticsPayload(missing, now)).toThrow(
      /exactly 7 measures/i
    );

    const malformed = source();
    malformed.policeRecorded.measures[0].value = "5200000" as unknown as number;
    expect(() => normalizeCrimeStatisticsPayload(malformed, now)).toThrow(
      /non-negative number/i
    );

    for (const publicationUrl of [
      "https://example.com/crime-release",
      "https://www.ons.gov.uk.example.com/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/yearendingmarch2026",
      "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/unrelated/yearendingmarch2026",
    ]) {
      const wrongSource = source();
      wrongSource.headline.publicationUrl = publicationUrl;
      expect(() => normalizeCrimeStatisticsPayload(wrongSource, now)).toThrow(
        /approved ONS edition/i
      );
    }
  });

  it("requires the final ONS edition URL to match the parsed period", () => {
    const mismatchedUrl = CRIME_EDITION_URL.replace(
      "yearendingmarch2026",
      "yearendingdecember2025"
    );
    expect(() =>
      parseOnsCrimeBulletin(CRIME_BULLETIN_HTML, mismatchedUrl)
    ).toThrow(/does not match period/i);
  });

  it("fails closed when a no-change claim is no longer present beside its measure", () => {
    const changedFraud = CRIME_BULLETIN_HTML.replace(
      "4.5 million fraud incidents, no statistically significant change compared with last year's survey",
      "4.5 million fraud incidents, a statistically significant increase compared with last year's survey"
    );
    expect(() => parseOnsCrimeBulletin(changedFraud, CRIME_EDITION_URL)).toThrow(
      /CSEW fraud and comparison/i
    );
  });

  it("anchors the firearms value to its named section", () => {
    const withEarlierGenericCount = CRIME_BULLETIN_HTML.replace(
      "<h2>Offences involving firearms</h2>",
      `<p>Police recorded 123 offences in year ending (YE) March 2026, an 2% decrease compared with YE March 2025.</p>
       <h2>Offences involving firearms</h2>`
    );
    const payload = parseOnsCrimeBulletin(
      withEarlierGenericCount,
      CRIME_EDITION_URL
    );
    expect(
      payload.policeRecorded.measures.find((item) => item.id === "firearms")
    ).toMatchObject({ value: 5_151 });
  });

  it("fails collection when a named primary figure disappears", async () => {
    const broken = CRIME_BULLETIN_HTML.replace(
      "Police recorded 5,151 offences",
      "Firearms information withheld"
    );
    expect(() => parseOnsCrimeBulletin(broken, CRIME_EDITION_URL)).toThrow(
      /firearms offences/i
    );

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      new Response(
        String(input) === ONS_PUBLICATION_LANDING_URL ? CRIME_LATEST_HTML : broken,
        { status: 200, headers: { "Content-Type": "text/html" } }
      )
    ) as unknown as typeof fetch;
    await expect(collectCrimeStatistics(fetchImpl, now)).rejects.toThrow(
      /firearms offences/i
    );
  });

  it("keeps regional rankings unavailable until their inputs are reproducible", () => {
    const regional = source();
    regional.regional.status = "available" as "unavailable";
    expect(() => normalizeCrimeStatisticsPayload(regional, now)).toThrow(
      /must remain unavailable/i
    );
  });

  it("rejects a policy that permits combined totals or unsupported rankings", () => {
    const combined = source();
    combined.evidencePolicy.combinedTotalAllowed = true;
    expect(() => normalizeCrimeStatisticsPayload(combined, now)).toThrow(
      /prohibit combined totals/i
    );

    const ranking = source();
    ranking.evidencePolicy.regionalRankingPublished = true;
    expect(() => normalizeCrimeStatisticsPayload(ranking, now)).toThrow(
      /regional rankings/i
    );
  });

  it("rejects replaced editions, impossible dates and inconsistent observation metadata", () => {
    expect(() =>
      buildCurrentCrimeStatisticsPayload(
        source(),
        new Date("2026-12-01T00:00:00.000Z")
      )
    ).toThrow(/scheduled replacement|currentness/i);

    const impossible = source();
    impossible.headline.releaseDate = "2026-02-30";
    expect(() => normalizeCrimeStatisticsPayload(impossible, now)).toThrow(
      /valid calendar date/i
    );

    const payload = buildCurrentCrimeStatisticsPayload(source(), now);
    payload.__observation.period = "Year ending March 2024";
    expect(isCurrentCrimeStatisticsPayload(payload, now)).toBe(false);
  });
});
