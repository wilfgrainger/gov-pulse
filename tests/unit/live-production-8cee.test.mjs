// Disposable live-production verification. This file must not be merged.
import { expect, it } from "vitest";

const EXPECTED_REVISION = "8ceebebde38f5e2f16295af9a797ee394c2bbe5b";
const BASE = "https://public-data.org/";
const DEPLOY_RUNS = "https://api.github.com/repos/wilfgrainger/gov-pulse/actions/workflows/deploy.yml/runs?per_page=10";
const EXPECTED_COUNTRIES = ["GBR","USA","CHN","RUS","UKR","DEU","FRA","ITA","ESP","IRL","NLD","CHE","POL"];
const EXPECTED_MEASURES = ["governmentDebt","officialDevelopmentAssistance","defenceSpending","publicSocialExpenditure","healthcareSpending","taxRevenue","debtInterest"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(path) {
  const response = await fetch(new URL(path, BASE), {
    redirect: "follow",
    headers: { "user-agent": "public-data-live-8cee-check/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, text: await response.text() };
}

async function recentDeployRuns() {
  const response = await fetch(DEPLOY_RUNS, {
    headers: { accept: "application/vnd.github+json", "user-agent": "public-data-live-8cee-check/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`GitHub deploy-runs API returned ${response.status}`);
  const payload = await response.json();
  return (payload.workflow_runs ?? []).map((run) => ({
    id: run.id,
    runNumber: run.run_number,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    htmlUrl: run.html_url,
  }));
}

async function waitForDeploy() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const runs = await recentDeployRuns();
    const run = runs.find((candidate) => candidate.headSha === EXPECTED_REVISION);
    console.log("DEPLOY_8CEE", JSON.stringify({ attempt, run: run ?? null, recent: runs.slice(0, 3) }));
    if (run?.status === "completed") {
      if (run.conclusion !== "success") {
        throw new Error(`production deploy ${run.id} concluded ${run.conclusion}`);
      }
      return run;
    }
    await sleep(10_000);
  }
  throw new Error(`production deploy for ${EXPECTED_REVISION} did not complete within verifier window`);
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
  return payload?.status === "degraded"
    && payload?.ready === false
    && payload?.degraded === true
    && Array.isArray(payload?.missingRequiredSections)
    && payload.missingRequiredSections.length > 0;
}

async function assertLive() {
  const [home, context, comparison, health] = await Promise.all([
    fetchText(""),
    fetchText("section/uk-in-context/"),
    fetchText("data/international-comparison.json"),
    fetchText("data/health.json"),
  ]);
  const homeHtml = visibleHtml(home.text);
  const contextHtml = visibleHtml(context.text);
  const comparisonPayload = comparison.status === 200 ? JSON.parse(comparison.text) : null;
  const healthPayload = health.status === 200 ? JSON.parse(health.text) : null;
  const diagnostics = {
    expectedRevision: EXPECTED_REVISION,
    actualRevision: revisionFrom(home.text),
    homeStatus: home.status,
    contextStatus: context.status,
    comparisonStatus: comparison.status,
    comparisonSetId: comparisonPayload?.meta?.comparisonSetId ?? null,
    countries: comparisonPayload?.meta?.countries ?? [],
    measures: comparisonPayload?.measures ? Object.keys(comparisonPayload.measures) : [],
    healthStatus: healthPayload?.status ?? null,
    healthReady: healthPayload?.ready ?? null,
    healthDegraded: healthPayload?.degraded ?? null,
    missingRequiredSections: healthPayload?.missingRequiredSections ?? [],
    oldHomepageInstructionPanel: /How to read a figure/i.test(homeHtml),
    oldHomepageTrustPanel: /Why trust the edition\?/i.test(homeHtml),
    residentHeading: /What does Britain spend and owe per resident/i.test(contextHtml),
    retiredCitizenWording: /per citizen/i.test(contextHtml),
  };
  console.log("LIVE_8CEE_DIAGNOSTICS", JSON.stringify(diagnostics));

  expect(home.status).toBe(200);
  expect(diagnostics.actualRevision).toBe(EXPECTED_REVISION);
  expect(diagnostics.oldHomepageInstructionPanel).toBe(false);
  expect(diagnostics.oldHomepageTrustPanel).toBe(false);
  expect(context.status).toBe(200);
  expect(diagnostics.residentHeading).toBe(true);
  expect(diagnostics.retiredCitizenWording).toBe(false);
  expect(comparison.status).toBe(200);
  expect(comparisonPayload?.meta?.comparisonSetId).toBe("uk-context-13-v2");
  expect(comparisonPayload?.meta?.countries).toEqual(EXPECTED_COUNTRIES);
  expect(comparisonPayload.meta.countries).toContain("IRL");
  expect(comparisonPayload.meta.countries).not.toContain("TUR");
  expect(Object.keys(comparisonPayload?.measures ?? {}).sort()).toEqual([...EXPECTED_MEASURES].sort());
  for (const id of EXPECTED_MEASURES) {
    const measure = comparisonPayload.measures[id];
    expect(measure).toBeTruthy();
    expect(measure.countries?.map((row) => row.country).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  }
  expect(health.status).toBe(200);
  expect(validHealth(healthPayload)).toBe(true);
}

it("serves release 8cee in production", async () => {
  await waitForDeploy();
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      await assertLive();
      return;
    } catch (error) {
      if (attempt === 12) throw error;
      await sleep(5_000);
    }
  }
}, 680_000);
