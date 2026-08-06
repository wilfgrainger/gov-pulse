import { expect, test } from "@playwright/test";

const publicBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

function liveUrl(path = "") {
  if (!publicBaseUrl) throw new Error("PLAYWRIGHT_BASE_URL is required for the live mobile audit");
  const base = publicBaseUrl.endsWith("/") ? publicBaseUrl : `${publicBaseUrl}/`;
  return new URL(path.replace(/^\//, ""), base).toString();
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

async function assertVisibleChartsFitViewport(page: Parameters<typeof test>[0]["page"]) {
  const chartWidths = await page.locator("svg.recharts-surface:visible").evaluateAll((charts) =>
    charts.map((chart) => chart.getBoundingClientRect().right - document.documentElement.clientWidth)
  );

  for (const overflow of chartWidths) {
    expect(overflow).toBeLessThanOrEqual(1);
  }
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Production audit runs only with the Pixel 7 project");
  test.skip(!publicBaseUrl, "Production URL is supplied only after deployment");
});

test("deployed Pixel 7 journey passes evidence, search, touch and overflow checks", async ({ page }) => {
  await page.goto(liveUrl(), { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Britain, in evidence." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The latest evidence, first." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Britain at a glance" })).toBeVisible();
  await expect(page.getByTestId("signal-card")).toHaveCount(8);
  await expect(page.locator("details[id^='category-']")).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  for (const name of ["Search evidence", "Topics"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }

  for (const card of await page.getByTestId("signal-card").all()) {
    const box = await card.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
  }

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
  await assertNoHorizontalOverflow(page);

  for (const path of ["section/economy/", "section/nhs/", "section/migration/", "sources/"]) {
    await page.goto(liveUrl(path), { waitUntil: "networkidle" });
    await expect(page.locator("main")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertVisibleChartsFitViewport(page);
  }
});
