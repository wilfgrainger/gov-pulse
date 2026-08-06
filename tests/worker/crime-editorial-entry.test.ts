// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import worker, {
  currentCrimeRecord,
  validDebtPayload,
} from "@/worker/editorial-entry";
import { ONS_PUBLICATION_LANDING_URL } from "@/contracts/crime-statistics";
import {
  CRIME_BULLETIN_HTML,
  CRIME_EDITION_URL,
  CRIME_LATEST_HTML,
} from "@/tests/fixtures/crime-publication";

const env = {
  METRICS_CACHE: {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
  },
};
const ctx = { waitUntil: vi.fn() };
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

describe("crime editorial boundary", () => {
  it("serves current modular crime evidence before the legacy combined validator", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubGlobal("fetch", fixtureFetch());

    const response = await worker.fetch(
      new Request("https://worker.example/metrics?section=crimeStatistics"),
      env,
      ctx
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      section: "crimeStatistics",
      source: "worker",
      cacheState: "fresh",
      backend: "cloudflare-official-publication",
      data: {
        available: true,
        headline: { period: "Year ending March 2026" },
        crimeSurvey: { status: "available" },
        policeRecorded: { status: "available" },
        justice: { status: "available" },
        regional: { status: "unavailable" },
      },
    });
    expect(body.data).not.toHaveProperty("regionalRecordedCrime");
    expect(body.data).not.toHaveProperty("focusRates");
  });

  it("retains the national-debt exports while adding the live crime boundary", async () => {
    expect(typeof validDebtPayload).toBe("function");
    const record = await currentCrimeRecord(now, fixtureFetch());
    expect(record).toMatchObject({
      section: "crimeStatistics",
      backend: "cloudflare-official-publication",
      data: { headline: { releaseDate: "2026-07-23" } },
    });
  });
});
