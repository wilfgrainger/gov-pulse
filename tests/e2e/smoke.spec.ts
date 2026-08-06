import { expect, test } from "@playwright/test";

function trackConsole(page: Parameters<typeof test>[0]["page"]) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function trackChartWarnings(page: Parameters<typeof test>[0]["page"]) {
  const warnings: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "warning" && /width\(0\).*height\(0\)/i.test(message.text())) {
      warnings.push(message.text());
    }
  });

  return warnings;
}

async function assertTruthfulStatusBar(page: Parameters<typeof test>[0]["page"]) {
  await expect(page.getByTestId("publication-status-bar")).toHaveCount(1);
  await expect(page.getByTestId("publication-status-bar")).toBeVisible();
  await expect(page.getByText(/^Live$/)).toHaveCount(0);
}

async function assertNoHorizontalOverflow(page: Parameters<typeof test>[0]["page"]) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function assertPulseApp(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Britain, in evidence." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Read today's edition/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Check sources and dates" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Number, period, source." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The latest evidence, first." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Britain at a glance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Go deeper by topic/i })).toBeVisible();
  await expect(page.getByText(/No combined national score/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Inspect the claim, not our confidence/i })).toBeVisible();
  await expect(page.getByTestId("signal-card")).toHaveCount(8);
  await expect(page.locator("details[id^='category-']")).toHaveCount(0);
  await expect(page.locator("#more-evidence").getByRole("link", { name: /Crime statistics/i })).toBeVisible();
  await expect(page.locator("#more-evidence").getByRole("link", { name: /Government contracts/i })).toBeVisible();
  await expect(page.getByText("PM approval data unavailable")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Political compass" })).toHaveCount(0);
  await assertTruthfulStatusBar(page);
}

test("home page loads cleanly as an evidence edition", async ({ page }) => {
  const errors = trackConsole(page);
  const chartWarnings = trackChartWarnings(page);
  await assertPulseApp(page);
  expect(errors).toEqual([]);
  expect(chartWarnings).toEqual([]);
});

test("global evidence search routes keyboard users to supported evidence", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Search evidence" }).click();

  const input = page.getByRole("searchbox", { name: "Search UK public evidence" });
  await expect(input).toBeFocused();
  await input.fill("NHS waiting list");

  const result = page.locator("#global-evidence-search-results").getByRole("link", { name: /NHS waiting times/i });
  await expect(result).toBeVisible();
  await input.press("ArrowDown");
  await expect(result).toBeFocused();
  await result.press("Enter");

  await expect(page).toHaveURL(/\/section\/nhs\/?$/);
  await expect(page.getByRole("heading", { level: 1, name: "NHS waiting times" })).toBeVisible();
  await expect(page.getByText(/navigate between sections/i)).toHaveCount(0);
});

test("topics panel exposes the complete evidence library and closes with Escape", async ({ page }) => {
  await page.goto("./");
  const topics = page.getByRole("button", { name: "Topics" });
  await topics.click();
  const panel = page.locator("#all-topic-navigation");
  await expect(panel.getByRole("heading", { name: "Choose a public question." })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Government receipts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(topics).toBeFocused();
});

test("legacy evidence hashes land on the matching signal", async ({ page }) => {
  await page.goto("./#gdp");
  await expect(page.locator("#gdp").getByRole("heading", { name: "GDP" })).toBeVisible();
  await expect(page.locator("details#category-economy")).toHaveCount(0);
});

test("sources page and public trust record load cleanly", async ({ page }) => {
  const errors = trackConsole(page);
  await page.goto("./sources");
  await expect(page.getByRole("heading", { level: 1, name: "Sources, dates and methods" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence must pass all three checks." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is current now" })).toBeVisible();
  await expect(page.locator('[data-production-marker="current-publications"]')).toHaveCount(1);
  await expect(page.locator('[data-production-marker="current-publications"]')).toBeVisible();
  await expect(page.locator('[data-production-marker="evidence-gaps"]')).toHaveCount(1);
  await expect(page.locator('[data-production-marker="evidence-gaps"]')).toBeVisible();

  for (const [path, heading] of [
    ["/about", "About public-data.org"],
    ["/editorial-policy", "Editorial and evidence policy"],
    ["/independence", "Independence and funding disclosure"],
    ["/contact", "Contact public-data.org"],
    ["/corrections", "Corrections policy"],
  ] as const) {
    await page.goto(`.${path}`);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("section pages expose deterministic edition downloads", async ({ page }) => {
  await page.goto("./section/gdp");
  const downloads = page.getByLabel("GDP data downloads");
  await expect(downloads.getByRole("link", { name: "Download JSON" })).toHaveAttribute(
    "href",
    "/data/sections/gdpTracker.json"
  );
  await expect(downloads.getByRole("link", { name: "Download CSV" })).toHaveAttribute(
    "href",
    "/data/sections/gdpTracker.csv"
  );
});

test("mobile journeys preserve touch targets and avoid horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Pixel 7 audit runs only in the mobile project");

  await page.goto("./");
  await assertNoHorizontalOverflow(page);

  for (const name of ["Search evidence", "Topics"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: "Search evidence" }).click();
  await page.getByRole("searchbox", { name: "Search UK public evidence" }).fill("migration");
  await expect(
    page.locator("#global-evidence-search-results").getByRole("link", { name: /Migration/i })
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);

  for (const path of ["/section/economy", "/section/nhs", "/section/migration", "/sources", "/corrections"]) {
    await page.goto(`.${path}`);
    await expect(page.locator("main")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});

test("all section pages render cleanly with truthful publication status", async ({ page }) => {
  const errors = trackConsole(page);
  await assertPulseApp(page);

  for (const path of [
    "/section/pm-approval",
    "/section/election-polls",
    "/section/betting-odds",
    "/section/govt-approval",
    "/section/gov-trust-trend",
    "/section/national-debt",
    "/section/gdp",
    "/section/economy",
    "/section/tax",
    "/section/employment",
    "/section/government-contracts",
    "/section/crime-stats",
    "/section/nhs",
    "/section/migration",
    "/section/early-years",
    "/section/uk-regions",
    "/section/policy-links",
  ]) {
    await page.goto(`.${path}`);
    await expect(page.locator("main")).toBeVisible();
    await assertTruthfulStatusBar(page);

    if (path === "/section/betting-odds") {
      const unavailable = page.getByRole("heading", {
        name: "Current betting market snapshot unavailable",
      });
      const current = page.getByText("Fresh commercial market snapshot");
      await expect(unavailable.or(current)).toBeVisible();
      if (await unavailable.isVisible()) {
        await expect(
          page.getByText(
            /will not display stale, partial, redirected or embedded political betting prices/i
          )
        ).toBeVisible();
      }
    }
  }

  expect(errors).toEqual([]);
});
