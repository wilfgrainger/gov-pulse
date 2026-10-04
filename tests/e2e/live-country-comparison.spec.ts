import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const publicBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

function csvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" && content[index + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (row.length || field.length) rows.push([...row, field]);
  return rows;
}

test("deployed country comparison preserves selected state and exports", async ({ page }) => {
  test.skip(!publicBaseUrl, "Set PLAYWRIGHT_BASE_URL to a deployed publication");
  await page.setViewportSize({ width: 1440, height: 1100 });

  const baseUrl = publicBaseUrl!.endsWith("/") ? publicBaseUrl! : `${publicBaseUrl!}/`;
  const response = await page.goto(new URL("section/uk-in-context/", baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  expect(response?.status()).toBe(200);

  const comparison = page.locator("section[aria-labelledby='country-figures-heading']");
  await expect(comparison.getByRole("heading", { name: "Compare one definition at a time" })).toBeVisible();
  const measure = comparison.getByLabel("Measure");
  const year = comparison.getByLabel("Comparison year");
  await measure.selectOption("defenceSpending");

  const historicalYear = await year.locator("option").evaluateAll((options) =>
    options.find((option) => /· historical observation$/i.test(option.textContent ?? ""))?.getAttribute("value") ?? null,
  );
  expect(historicalYear).toBeTruthy();
  await year.selectOption(historicalYear!);
  await comparison.getByRole("button", { name: "UK + Europe" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("year")).toBe(historicalYear);
  const europeanUrl = new URL(page.url());
  const europeanCountries = europeanUrl.searchParams.get("countries")?.split(",") ?? [];
  expect(await measure.inputValue()).toBe("defenceSpending");
  expect(europeanCountries).toContain("GBR");
  expect(europeanCountries).not.toContain("USA");

  const selectedTable = comparison.locator("table").last();
  const visibleRows = await selectedTable.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) => Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent?.trim() ?? "")),
  );
  const denominatorText = await comparison.getByRole("status").textContent();
  const denominator = Number(denominatorText?.match(/Visible denominator:\s*(\d+)/i)?.[1]);
  expect(denominator).toBeGreaterThan(0);
  expect(visibleRows).toHaveLength(denominator);
  expect(visibleRows.every((row) => row[2] === historicalYear)).toBe(true);
  expect(visibleRows.every((row) => /historical observation/i.test(row[3]))).toBe(true);
  const sourceLinks = await selectedTable.locator("tbody tr td:last-child a").evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).href),
  );
  expect(sourceLinks.length).toBeGreaterThan(0);
  expect(sourceLinks.every((href) => href.startsWith("https://"))).toBe(true);

  await comparison.getByRole("button", { name: "UK + major powers" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("countries")).toContain("USA");
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("countries")).not.toContain("USA");
  await expect(year).toHaveValue(historicalYear!);
  await page.reload({ waitUntil: "networkidle" });
  await expect(measure).toHaveValue("defenceSpending");
  await expect(year).toHaveValue(historicalYear!);

  const csvDownload = page.waitForEvent("download");
  await comparison.getByRole("button", { name: "CSV", exact: true }).click();
  const csvFile = await csvDownload;
  const csvContent = await readFile((await csvFile.path())!, "utf8");

  const jsonDownload = page.waitForEvent("download");
  await comparison.getByRole("button", { name: "JSON", exact: true }).click();
  const jsonFile = await jsonDownload;
  const exported = JSON.parse(await readFile((await jsonFile.path())!, "utf8")) as {
    title: string;
    sourceCitation: string;
    observationWindow: { start: { period: string } | null; end: { period: string } | null };
    series: Array<{ key: string; label: string }>;
    observations: Array<{ period: string; values: Record<string, number | null>; details: Record<string, string | number | null> }>;
    caveats: string[];
  };

  const parsedCsv = csvRows(csvContent);
  expect(parsedCsv[0]).toEqual([
    "chart_title", "period", "observed_at", "series_key", "series_label", "value",
    "value_status", "source_citation", "caveats", "details",
  ]);
  expect(exported.title).toContain("Defence spending");
  expect(exported.sourceCitation).toContain("https://");
  expect(exported.observationWindow.start?.period).toBe(historicalYear);
  expect(exported.observationWindow.end?.period).toBe(historicalYear);
  expect(exported.observations).toHaveLength(visibleRows.length);
  expect(parsedCsv).toHaveLength(exported.observations.length + 1);

  const csvByCountry = new Map(parsedCsv.slice(1).map((row) => [row[3], row]));
  for (const visibleRow of visibleRows) {
    const matchingSeries = exported.series.find((series) => visibleRow[0].startsWith(series.label.split(" · ")[0]));
    expect(matchingSeries).toBeDefined();
    const observation = exported.observations.find((item) => item.details.country === matchingSeries!.key);
    expect(observation).toBeDefined();
    const value = observation!.values[matchingSeries!.key];
    expect(value).not.toBeNull();

    const expectedCurrency = await page.evaluate((amount) =>
      new Intl.NumberFormat("en-GB", { style: "currency", currency: "USD", maximumSignificantDigits: 17 }).format(amount!),
    value);
    expect(visibleRow[1]).toBe(expectedCurrency);
    expect(visibleRow[2]).toBe(observation!.period);

    const csvRow = csvByCountry.get(matchingSeries!.key);
    expect(csvRow).toBeDefined();
    expect(csvRow![1]).toBe(observation!.period);
    expect(csvRow![4]).toBe(matchingSeries!.label);
    expect(csvRow![5]).toBe(String(value));
    expect(csvRow![6]).toBe("published");
    expect(csvRow![7]).toBe(exported.sourceCitation);
    expect(csvRow![8]).toBe(exported.caveats.join(" "));
    expect(JSON.parse(csvRow![9])).toEqual(observation!.details);
  }

  await measure.selectOption("officialDevelopmentAssistance");
  await expect(year.locator("option")).toHaveCount(1);
  await expect(year).toHaveValue("latest");
  const latestOnlyRows = await selectedTable.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) => Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent?.trim() ?? "")),
  );
  expect(latestOnlyRows.length).toBeGreaterThan(0);
  expect(new Set(latestOnlyRows.map((row) => row[2])).size).toBe(1);
});

test("deployed unavailable country sources remain null rather than zero", async ({ page }) => {
  test.skip(!publicBaseUrl, "Set PLAYWRIGHT_BASE_URL to a deployed publication");
  const baseUrl = publicBaseUrl!.endsWith("/") ? publicBaseUrl! : `${publicBaseUrl!}/`;
  await page.goto(new URL("section/uk-in-context/", baseUrl).toString(), { waitUntil: "networkidle" });

  const comparison = page.locator("section[aria-labelledby='country-figures-heading']");
  const measure = comparison.getByLabel("Measure");
  await measure.selectOption("governmentDebt");
  const lifecycle = page.getByTestId("comparison-lifecycle-governmentDebt");
  const lifecycleText = await lifecycle.textContent();

  if (/No valid source edition is available/i.test(lifecycleText ?? "")) {
    await expect(comparison.getByText("No numeric country values match these filters.")).toBeVisible();
    await expect(comparison.getByRole("status").first()).toContainText(/Visible denominator:\s*0 of 13/);
    await expect(comparison.locator("table").last().locator("tbody tr")).toHaveCount(0);

    const download = page.waitForEvent("download");
    await comparison.getByRole("button", { name: "JSON", exact: true }).click();
    const file = await download;
    const exported = JSON.parse(await readFile((await file.path())!, "utf8")) as {
      sourceCitation: string;
      observations: Array<{ values: Record<string, number | null> }>;
    };
    expect(exported.sourceCitation).toContain("values unavailable in this edition");
    expect(exported.observations.length).toBeGreaterThan(0);
    expect(exported.observations.every((observation) =>
      Object.values(observation.values).every((value) => value === null),
    )).toBe(true);
  } else {
    const rows = comparison.locator("table").last().locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  }
});
