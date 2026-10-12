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

async function assertNoGlobalFeedTelemetry(page: Parameters<typeof test>[0]["page"]) {
  await expect(page.getByTestId("publication-status-bar")).toHaveCount(0);
  await expect(page.getByText(/^Live$/)).toHaveCount(0);
}

async function assertNoHorizontalOverflow(page: Parameters<typeof test>[0]["page"]) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    path: location.pathname,
    overflowing: Array.from(document.body.querySelectorAll("*"))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: typeof element.className === "string" ? element.className : "",
        right: Math.round(element.getBoundingClientRect().right),
        text: (element.textContent ?? "").trim().slice(0, 50),
      }))
      .filter((element) => element.right > document.documentElement.clientWidth + 1)
      .slice(0, 8),
  }));

  expect(dimensions.documentWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function assertPulseApp(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Britain, in evidence." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore the data/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the latest briefing" })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "Sources and dates" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest figures" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The country at a glance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Go deeper by topic/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Number, period, source." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Inspect the claim, not our confidence/i })).toHaveCount(0);
  await expect(page.getByTestId("signal-card")).toHaveCount(7);
  await expect(page.locator("details[id^='category-']")).toHaveCount(0);
  await expect(page.locator("#more-evidence").getByRole("link", { name: /Crime statistics/i })).toBeVisible();
  await expect(page.locator("#more-evidence").getByRole("link", { name: /Government contracts/i })).toBeVisible();
  await expect(page.getByText("PM approval data unavailable")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Political compass" })).toHaveCount(0);
  await assertNoGlobalFeedTelemetry(page);
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

  const result = page.locator("#global-evidence-search-results").getByRole("link", { name: /NHS waiting list/i });
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
  await expect(panel.getByRole("link", { name: "UK in context" })).toBeVisible();
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
  await expect(page.getByRole("heading", { level: 1, name: "Sources and dates" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publisher directory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What we are not showing" })).toBeVisible();
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

test("all new publication routes render their honest server state without overflow", async ({ page }) => {
  const routes = [
    ["/explore", "Explore the numbers"],
    ["/measure", "Measure library"],
    ["/compare", "Comparison studio"],
    ["/briefing", "The briefing"],
    ["/calendar", "Release calendar"],
    ["/cost-of-living", "Cost of living"],
    ["/money", "Public money dossiers"],
    ["/editions", "Editions and revisions"],
    ["/stories/household-budgets", "How to read the household pressure signals"],
    ["/stories/public-finances", "Debt, receipts and economic output"],
  ] as const;

  for (const [path, heading] of routes) {
    await page.goto(`.${path}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator('a[href^="#"]').first()).toBeAttached();
    await assertNoHorizontalOverflow(page);
  }
});

test("home, comparison and release tools fit 320px and 360px layouts", async ({ page }) => {
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/", "/compare", "/calendar", "/cost-of-living", "/money"]) {
      await page.goto(`.${path}`);
      await expect(page.locator("main")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  }
});

test("mobile masthead fits a 412px phone while keeping its tools reachable", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 800 });
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Search evidence" })).toBeVisible();
  const topics = page.getByRole("button", { name: "Topics" });
  await expect(topics).toBeVisible();
  await topics.click();
  await expect(page.locator("#all-topic-navigation").getByRole("link", { name: "Explore data" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("measure-library route keeps its truthful HTML available without JavaScript", async ({ browser }) => {
  const page = await browser.newPage({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173", javaScriptEnabled: false });
  await page.goto("./measure");
  await expect(page.getByRole("heading", { level: 1, name: "Measure library" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("No validated measure catalog is available");
  await page.close();
});

test("section pages explain absent downloads in an unseeded local edition", async ({ page }) => {
  await page.goto("./section/gdp");
  const downloads = page.getByLabel("GDP data downloads");
  await expect(downloads).toContainText("A download will appear when this section has current verified evidence.");
  await expect(downloads.getByRole("link", { name: "Download JSON" })).toHaveCount(0);
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

  for (const path of ["/section/economy", "/section/nhs", "/section/migration", "/section/uk-in-context", "/sources", "/corrections"]) {
    await page.goto(`.${path}`);
    await expect(page.locator("main")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});

test("all section pages render cleanly without global feed telemetry", async ({ page }) => {
  const errors = trackConsole(page);
  await assertPulseApp(page);

  for (const path of [
    "/section/election-polls",
    "/section/betting-odds",
    "/section/national-debt",
    "/section/gdp",
    "/section/economy",
    "/section/tax",
    "/section/employment",
    "/section/uk-in-context",
    "/section/government-contracts",
    "/section/crime-stats",
    "/section/nhs",
    "/section/migration",
    "/section/early-years",
  ]) {
    await page.goto(`.${path}`);
    await expect(page.locator("main")).toBeVisible();
    await assertNoGlobalFeedTelemetry(page);
    if (path === "/section/uk-in-context") {
      await expect(page.getByRole("heading", { name: /What does Britain spend and owe per resident/i })).toBeVisible();
      await expect(page.getByRole("row", { name: /Government debt outstanding/i })).toBeVisible();
      await expect(page.getByRole("row", { name: /Debt interest/i })).toBeVisible();
    }

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

test("retired product routes are removed rather than kept alive as withdrawn pages", async ({ page }) => {
  // See docs/history/2026-10-07-retired-product-ledger.md.
  for (const path of [
    "/section/pm-approval/",
    "/section/govt-approval/",
    "/section/gov-trust-trend/",
    "/section/uk-regions/",
    "/section/policy-links/",
  ]) {
    const response = await page.goto(`.${path}`);
    expect(response?.status(), path).toBe(404);
  }
});

test("topic and feature routes stay usable at a 200% zoom-equivalent width with reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Route-wide zoom audit runs once in the desktop project");
  await page.setViewportSize({ width: 640, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  const routes = [
    "/section/election-polls", "/section/betting-odds", "/section/national-debt",
    "/section/gdp", "/section/economy", "/section/tax", "/section/employment",
    "/section/uk-in-context", "/section/government-contracts", "/section/crime-stats",
    "/section/nhs", "/section/migration", "/section/early-years", "/measure", "/compare", "/briefing", "/calendar",
    "/cost-of-living", "/money", "/editions", "/sources",
  ];

  for (const path of routes) {
    await page.goto(`.${path}`);
    await expect(page.locator("main")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});
