// Disposable live-production verification. This file must not be merged.
import { expect, it } from "vitest";

const EXPECTED_REVISION = "2db650c5dbf6a1d45eca66e1f80d76e7a74efdcc";
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

it("diagnoses the live atomic hotfix deployment", async () => {
  const [home, context, comparison, health] = await Promise.all([
    fetchResult(""),
    fetchResult("section/uk-in-context/"),
    fetchResult("data/international-comparison.json"),
    fetchResult("data/health.json"),
  ]);

  let comparisonPayload = null;
  let healthPayload = null;
  try { comparisonPayload = JSON.parse(comparison.text); } catch {}
  try { healthPayload = JSON.parse(health.text); } catch {}

  const diagnostics = {
    expectedRevision: EXPECTED_REVISION,
    actualRevision: revisionFrom(home.text),
    homeStatus: home.status,
    contextStatus: context.status,
    comparisonStatus: comparison.status,
    comparisonSetId: comparisonPayload?.meta?.comparisonSetId ?? null,
    comparisonGeneratedAt: comparisonPayload?.meta?.generatedAt ?? null,
    comparisonMeasures: comparisonPayload?.measures ? Object.keys(comparisonPayload.measures) : [],
    healthStatus: health.status,
    health: healthPayload,
  };
  console.log("LIVE_PRODUCTION_DIAGNOSTICS", JSON.stringify(diagnostics));

  expect(home.status).toBe(200);
  expect(diagnostics.actualRevision).toBe(EXPECTED_REVISION);
  expect(context.status).toBe(200);
  const normalizedContext = context.text.replace(/<!--[\s\S]*?-->/g, "");
  expect(normalizedContext).toMatch(/<h1[^>]*>[^<]*UK in context/i);
  expect(normalizedContext).toContain("https://public-data.org/section/uk-in-context/");

  expect(comparison.status).toBe(200);
  expect(comparisonPayload?.meta?.schemaVersion).toBe(1);
  expect(comparisonPayload?.meta?.comparisonSetId).toBe("uk-context-13-v1");
  for (const id of MEASURES) {
    expect(comparisonPayload?.measures?.[id], `missing comparison measure ${id}`).toBeTruthy();
    expect(
      comparisonPayload.measures[id].countries?.some((row) => row.country === "GBR"),
      `missing UK observation for ${id}`,
    ).toBe(true);
  }
}, 30_000);
