// Disposable live-production verification. This file must not be merged.
// PR metadata deliberately keeps validation pending until this assertion runs.
import { expect, it } from "vitest";

const EXPECTED_REVISION = "1c8431331df8895cbf96a5cd47d67454a8ed84d4";
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
    headers: { "user-agent": "public-data-live-recovery-check/1.0" },
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
  const payload = comparison.status === 200 ? JSON.parse(comparison.text) : null;
  const diagnostics = {
    expectedRevision: EXPECTED_REVISION,
    actualRevision: revisionFrom(home.text),
    homeStatus: home.status,
    contextStatus: context.status,
    comparisonStatus: comparison.status,
    measures: payload?.measures ? Object.keys(payload.measures) : [],
  };
  console.log("LIVE_RECOVERY_DIAGNOSTICS", JSON.stringify(diagnostics));

  expect(home.status).toBe(200);
  expect(diagnostics.actualRevision).toBe(EXPECTED_REVISION);
  expect(context.status).toBe(200);
  expect(context.text.replace(/<!--[\s\S]*?-->/g, "")).toMatch(/UK in context/i);
  expect(comparison.status).toBe(200);
  expect(payload?.meta?.schemaVersion).toBe(1);
  expect(payload?.meta?.comparisonSetId).toBe("uk-context-13-v1");
  for (const id of MEASURES) {
    expect(payload?.measures?.[id], `missing comparison measure ${id}`).toBeTruthy();
    expect(payload.measures[id].countries?.some((row) => row.country === "GBR")).toBe(true);
  }
}

it("serves the recovered production release and comparison page", async () => {
  let lastError;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    try {
      await assertLive();
      return;
    } catch (error) {
      lastError = error;
      console.warn(`live recovery attempt ${attempt}/24 failed: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < 24) await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  throw lastError;
}, 260_000);
