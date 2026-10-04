import { expect, test } from "@playwright/test";

const publicBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

type ArchivedMeasure = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  sourceId: string;
  sourceUrl: string;
  sourceEditionId: string;
  publishedAt: string;
  observationPeriod: { label: string };
};

type ArchiveDetail = {
  edition: string;
  summary: {
    id: string;
    asOf: string;
    previousEditionId: string | null;
    changes: Array<{
      measureId: string;
      kind: string;
      period: string | null;
      next: number | null;
      nextUnit: string | null;
      nextSourceEditionId: string;
      nextSourcePublishedAt: string | null;
      nextSourceUrl: string | null;
      previous: number | null;
    }>;
  };
  measureCatalog: { measures: Record<string, ArchivedMeasure> };
};

test("deployed source history opens its immutable edition and primary publication", async ({ page }) => {
  test.setTimeout(30_000);
  test.skip(!publicBaseUrl, "Set PLAYWRIGHT_BASE_URL to a deployed publication");
  const baseUrl = publicBaseUrl!.endsWith("/") ? publicBaseUrl! : `${publicBaseUrl!}/`;
  const base = new URL(baseUrl);

  const indexResponse = await page.request.get(new URL("data/editions.json", base).toString());
  expect(indexResponse.status()).toBe(200);
  const index = await indexResponse.json() as { editions: Array<{ id: string }> };
  expect(index.editions.length).toBeGreaterThan(0);

  let selected: { id: string; archive: ArchiveDetail; measure: ArchivedMeasure; change: ArchiveDetail["summary"]["changes"][number] } | null = null;
  for (const listed of index.editions) {
    const detailResponse = await page.request.get(
      new URL(`data/edition.json?edition=${encodeURIComponent(listed.id)}`, base).toString(),
    );
    if (!detailResponse.ok()) continue;
    const archive = await detailResponse.json() as ArchiveDetail;
    const change = archive.summary.changes.find((item) =>
      item.measureId === "housePriceAverage" && item.kind === "new-observation" && item.nextSourceUrl,
    );
    const measure = archive.measureCatalog.measures.housePriceAverage;
    if (change && measure?.value !== null && measure?.value !== undefined) {
      selected = { id: listed.id, archive, measure, change };
      break;
    }
  }
  expect(selected, "a retained house-price observation with a primary source").not.toBeNull();

  const { id, archive, measure, change } = selected!;
  expect(archive.edition).toBe(id);
  expect(change.next).toBe(measure.value);
  expect(change.nextUnit).toBe(measure.unit);
  expect(change.nextSourceEditionId).toBe(measure.sourceEditionId);
  expect(change.nextSourceUrl).toBe(measure.sourceUrl);
  expect(change.previous).toBeNull();

  await page.goto(new URL(`sources/${encodeURIComponent(measure.sourceId)}/`, base).toString(), {
    waitUntil: "networkidle",
  });
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revision ledger" })).toBeVisible();
  await expect(page.locator(`a[href="${measure.sourceUrl}"]`).first()).toBeVisible();

  const archiveLink = page.getByRole("link", { name: "Open historical edition →" }).first();
  await expect(archiveLink).toHaveAttribute("href", new RegExp(`/editions/${id}/?$`));
  await archiveLink.click();
  await expect(page).toHaveURL(new RegExp(`/editions/${id}/?$`));
  await expect(page.getByRole("heading", { level: 1, name: `Edition ${id}` })).toBeVisible();
  await expect(page.getByText(new RegExp(`${measure.id} · New observation · ${measure.observationPeriod.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeVisible();
  await expect(page.locator(`a[href="${measure.sourceUrl}"]`).first()).toBeVisible();
  await expect(page.getByText(`Archived value: ${measure.value} ${measure.unit} · current at capture · source edition ${measure.sourceEditionId}`)).toBeVisible();

  await page.goto(new URL("editions/", base).toString(), { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Editions and revisions" })).toBeVisible();
  await expect(page.locator(`a[href^="/editions/${id}"]`)).toBeVisible();

  const previousEditionId = archive.summary.previousEditionId;
  expect(previousEditionId).toBeTruthy();
  const previousResponse = await page.request.get(
    new URL(`data/edition.json?edition=${encodeURIComponent(previousEditionId!)}`, base).toString(),
  );
  expect(previousResponse.status()).toBe(200);
  const previousArchive = await previousResponse.json() as ArchiveDetail;
  expect(previousArchive.edition).toBe(previousEditionId);
  expect(previousArchive.measureCatalog.measures.housePriceAverage).toBeUndefined();

  const baselineLink = page.locator(`a[href^="/editions/${previousEditionId}"]`);
  await expect(baselineLink).toBeVisible();
  await baselineLink.click();
  await expect(page.getByRole("heading", { level: 1, name: `Edition ${previousEditionId}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${measure.label}: archived observations` })).toHaveCount(0);
});
