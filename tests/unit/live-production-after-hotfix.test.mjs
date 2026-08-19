// Disposable live-production verification. This file must not be merged.
import { expect, it } from "vitest";

const EXPECTED_REVISION = "7430dc9fad5fd3a6491f32efc0340f1aaff86b73";
const BASE = "https://public-data.org/";
const MEASURES = [
  "governmentDebt",
  "officialDevelopmentAssistance",
  "defenceSpending",
  "publicSocialExpenditure",
  "healthcareSpending",
  "taxRevenue",
  "debtInterest",
];

async function fetchResult(path) {
  const response = await fetch(new URL(path, BASE), {
    redirect: "follow",
    headers: { "user-agent": "public-data-live-hotfix-check/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, text: await response.text() };
}

function revisionFrom(html) {
  return html.match(/name=["']public-data-revision["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? html.match(/content=["']([^"']+)["'][^>]+name=["']public-data-revision["']/i)?.[1]
    ?? null;
}

async function assertLive() {
  const [home, context, comparison] = await Promise.all([
    fetchResult(""),
    fetchResult("section/uk-in-context/"),
    fetchResult("data/international-comparison.json"),
  ]);
  const comparisonPayload = comparison.status === 200 ? JSON.parse(comparison.text) : null;
  const diagnostics = {
    expectedRevision: EXPECTED_REVISION,
    actualRevision: revisionFrom(home.text),
    homeStatus: home.status,
    contextStatus: context.status,
    comparisonStatus: comparison.status,
    comparisonSetId: comparisonPayload?.meta?.comparisonSetId ?? null,
    comparisonMeasures: comparisonPayload?.measures ? Object.keys(comparisonPayload.measures) : [],
  };
  console.log("LIVE_PRODUCTION_DIAGNOSTICS", JSON.stringify(diagnostics));

  expect(home.status).toBe(200);
  expect(diagnostics.actualRevision).toBe(EXPECTED_REVISION);
  expect(context.status).toBe(200);
  const normalizedContext = context.text.replace(/<!--[\s\S]*?-->/g, "");
  expect(normalizedContext).toMatch(/<h1[^>]*>[^<]*UK in context/i);
  expect(comparison.status).toBe(200);
  expect(comparisonPayload?.meta?.schemaVersion).toBe(1);
  expect(comparisonPayload?.meta?.comparisonSetId).toBe("uk-context-13-v1");
  for (const id of MEASURES) {
    expect(comparisonPayload?.measures?.[id], `missing comparison measure ${id}`).toBeTruthy();
    expect(comparisonPayload.measures[id].countries?.some((row) => row.country === "GBR")).toBe(true);
  }
}

it("serves the newest reviewed production revision and UK in context", async () => {
  let lastError;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    try {
      await assertLive();
      return;
    } catch (error) {
      lastError = error;
      console.warn(`live production attempt ${attempt}/24 failed: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < 24) await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  throw lastError;
}, 260_000);
