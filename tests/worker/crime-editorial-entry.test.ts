// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SECTION_BUILDERS,
  validDebtPayload,
} from "@/worker/section-builders";
import { ONS_PUBLICATION_LANDING_URL } from "@/contracts/crime-statistics";
import {
  CRIME_BULLETIN_HTML,
  CRIME_EDITION_URL,
  CRIME_LATEST_HTML,
} from "@/tests/fixtures/crime-publication";

const now = new Date("2026-08-02T04:30:00.000Z");

function fixtureFetch() {
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("crime statistics section builder", () => {
  it("builds current modular crime evidence with provenance", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal("fetch", fixtureFetch());

    const record = await SECTION_BUILDERS.crimeStatistics(now);

    expect(record).toMatchObject({
      section: "crimeStatistics",
      backend: "cloudflare-official-publication",
      data: {
        available: true,
        headline: { period: "Year ending March 2026", releaseDate: "2026-07-23" },
        crimeSurvey: { status: "available" },
        policeRecorded: { status: "available" },
        justice: { status: "available" },
        regional: { status: "unavailable" },
      },
    });
    expect(record.data).not.toHaveProperty("regionalRecordedCrime");
    expect(record.data).not.toHaveProperty("focusRates");
    expect(record.data.__provenance.section).toBe("crimeStatistics");
  });

  it("retains the national-debt validator alongside the crime builder", () => {
    expect(typeof validDebtPayload).toBe("function");
  });
});
