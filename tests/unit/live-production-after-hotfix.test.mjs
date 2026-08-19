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

async function fetchText(path) {
  const response = await fetch(new URL(path, BASE), {
    redirect: "follow",
    headers: { "user-agent": "public-data-live-hotfix-check/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${path || "/"} returned HTTP ${response.status}`);
  return response.text();
}

async function assertLive() {
  const [home, context, comparisonText] = await Promise.all([
    fetchText(""),
    fetchText("section/uk-in-context/"),
    fetchText("data/international-comparison.json"),
  ]);

  expect(home).toMatch(
    new RegExp(`name=["']public-data-revision["'][^>]+content=["']${EXPECTED_REVISION}["']|content=["']${EXPECTED_REVISION}["'][^>]+name=["']public-data-revision["']`, "i"),
  );
  const normalizedContext = context.replace(/<!--[\s\S]*?-->/g, "");
  expect(normalizedContext).toMatch(/<h1[^>]*>[^<]*UK in context/i);
  expect(normalizedContext).toContain("https://public-data.org/section/uk-in-context/");

  const comparison = JSON.parse(comparisonText);
  expect(comparison.meta?.schemaVersion).toBe(1);
  expect(comparison.meta?.comparisonSetId).toBe("uk-context-13-v1");
  for (const id of MEASURES) {
    expect(comparison.measures?.[id], `missing comparison measure ${id}`).toBeTruthy();
    expect(
      comparison.measures[id].countries?.some((row) => row.country === "GBR"),
      `missing UK observation for ${id}`,
    ).toBe(true);
  }

  return comparison;
}

it(
  "serves the atomic hotfix revision, UK in context and all comparison measures",
  async () => {
    let lastError;
    for (let attempt = 1; attempt <= 18; attempt += 1) {
      try {
        const comparison = await assertLive();
        console.log(
          "live production verified",
          JSON.stringify({
            revision: EXPECTED_REVISION,
            generatedAt: comparison.meta?.generatedAt,
            checkedAt: comparison.meta?.checkedAt,
            measures: MEASURES.length,
          }),
        );
        return;
      } catch (error) {
        lastError = error;
        console.warn(
          `live production attempt ${attempt}/18 failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (attempt < 18) await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
    }
    throw lastError;
  },
  200_000,
);
