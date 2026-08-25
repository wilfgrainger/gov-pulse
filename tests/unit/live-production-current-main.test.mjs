// Disposable live-production verification. This file must not be merged.
import { expect, it } from "vitest";

const EXPECTED_REVISION = "a24203e64292457149dca8f84f2b95a97c145268";
const BASE = "https://public-data.org/";
const EXPECTED_COUNTRIES = [
  "GBR", "USA", "CHN", "RUS", "UKR", "DEU", "FRA", "ITA", "ESP", "IRL", "NLD", "CHE", "POL",
];
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
    headers: { "user-agent": "public-data-live-current-main-check/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, text: await response.text() };
}

async function fetchDeployRuns() {
  const response = await fetch(
    "https://api.github.com/repos/wilfgrainger/gov-pulse/actions/workflows/deploy.yml/runs?per_page=5",
    {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "public-data-live-current-main-check/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return { status: response.status, runs: [] };
  const payload = await response.json();
  return {
    status: response.status,
    runs: (payload.workflow_runs ?? []).map((run) => ({
      id: run.id,
      runNumber: run.run_number,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      headSha: run.head_sha,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      htmlUrl: run.html_url,
    })),
  };
}

function revisionFrom(html) {
  return html.match(/name=["']public-data-revision["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? html.match(/content=["']([^"']+)["'][^>]+name=["']public-data-revision["']/i)?.[1]
    ?? null;
}

function visibleHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function validHealth(payload) {
  if (payload?.status === "ready" && payload?.ready === true) return true;
  return (
    payload?.status === "degraded" &&
    payload?.ready === false &&
    payload?.degraded === true &&
    Array.isArray(payload?.missingRequiredSections) &&
    payload.missingRequiredSections.length > 0
  );
}

async function assertLive() {
  const [home, context, comparison, health, deployRuns] = await Promise.all([
    fetchResult(""),
    fetchResult("section/uk-in-context/"),
    fetchResult("data/international-comparison.json"),
    fetchResult("data/health.json"),
    fetchDeployRuns(),
  ]);
  const homeHtml = visibleHtml(home.text);
  const contextHtml = visibleHtml(context.text);
  const payload = comparison.status === 200 ? JSON.parse(comparison.text) : null;
  const healthPayload = health.status === 200 ? JSON.parse(health.text) : null;
  const diagnostics = {
    expectedRevision: EXPECTED_REVISION,
    actualRevision: revisionFrom(home.text),
    homeStatus: home.status,
    contextStatus: context.status,
    comparisonStatus: comparison.status,
    comparisonSetId: payload?.meta?.comparisonSetId ?? null,
    countries: payload?.meta?.countries ?? [],
    measures: payload?.measures ? Object.keys(payload.measures) : [],
    healthStatus: healthPayload?.status ?? null,
    healthReady: healthPayload?.ready ?? null,
    healthDegraded: healthPayload?.degraded ?? null,
    missingRequiredSections: healthPayload?.missingRequiredSections ?? [],
    oldHomepageInstructionPanel: /How to read a figure/i.test(homeHtml),
    oldHomepageTrustPanel: /Why trust the edition\?/i.test(homeHtml),
    residentHeading: /What does Britain spend and owe per resident/i.test(contextHtml),
    retiredCitizenWording: /per citizen/i.test(contextHtml),
    deployRuns,
  };
  console.log("LIVE_CURRENT_MAIN_DIAGNOSTICS", JSON.stringify(diagnostics));

  expect(home.status).toBe(200);
  expect(diagnostics.actualRevision).toBe(EXPECTED_REVISION);
  expect(diagnostics.oldHomepageInstructionPanel).toBe(false);
  expect(diagnostics.oldHomepageTrustPanel).toBe(false);

  expect(context.status).toBe(200);
  expect(contextHtml).toMatch(/UK in context/i);
  expect(diagnostics.residentHeading).toBe(true);
  expect(diagnostics.retiredCitizenWording).toBe(false);

  expect(comparison.status).toBe(200);
  expect(payload?.meta?.schemaVersion).toBe(1);
  expect(payload?.meta?.comparisonSetId).toBe("uk-context-13-v2");
  expect(payload?.meta?.countries).toEqual(EXPECTED_COUNTRIES);
  expect(payload.meta.countries).toContain("IRL");
  expect(payload.meta.countries).not.toContain("TUR");

  expect(Object.keys(payload?.measures ?? {}).sort()).toEqual([...MEASURES].sort());
  for (const id of MEASURES) {
    const measure = payload.measures[id];
    expect(measure, `missing comparison measure ${id}`).toBeTruthy();
    expect(measure.countries?.map((row) => row.country).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
    expect(measure.countries.some((row) => row.country === "GBR")).toBe(true);
    expect(measure.countries.some((row) => row.country === "IRL")).toBe(true);
    expect(measure.countries.some((row) => row.country === "TUR")).toBe(false);
  }

  expect(health.status).toBe(200);
  expect(validHealth(healthPayload)).toBe(true);
}

it("serves the current Cave Pony and UK in context release in production", async () => {
  let lastError;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      await assertLive();
      return;
    } catch (error) {
      lastError = error;
      console.warn(`live current-main attempt ${attempt}/60 failed: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < 60) await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  throw lastError;
}, 620_000);
