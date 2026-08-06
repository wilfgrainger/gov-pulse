// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildCurrentCrimeStatisticsPayload,
  isCurrentCrimeStatisticsPayload,
} from "@/contracts/crime-statistics";
import { parseOnsCrimeBulletin } from "@/worker/live-crime-collector";
import {
  CRIME_BULLETIN_HTML,
  CRIME_EDITION_URL,
} from "@/tests/fixtures/crime-publication";

describe("crime publication replacement boundary", () => {
  it("remains current until, but not through, the publisher's scheduled next release", () => {
    const beforeReplacement = new Date("2026-10-21T23:59:59.000Z");
    const publication = buildCurrentCrimeStatisticsPayload(
      parseOnsCrimeBulletin(CRIME_BULLETIN_HTML, CRIME_EDITION_URL),
      beforeReplacement
    );

    expect(publication.expiresAt).toBe("2026-10-22T00:00:00.000Z");
    expect(isCurrentCrimeStatisticsPayload(publication, beforeReplacement)).toBe(true);
    expect(
      isCurrentCrimeStatisticsPayload(
        publication,
        new Date("2026-10-22T00:00:00.000Z")
      )
    ).toBe(false);
  });
});
