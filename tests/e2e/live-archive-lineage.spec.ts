import { expect, test } from "@playwright/test";

const publicBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

type ArchivedMeasure = {
  id: string;
  label: string;
  value: number | null;
  availability: string;
  unit: string;
  comparisonKey: string;
  basis: string;
  geography: { code: string; label: string };
  sourceId: string;
  sourceUrl: string;
  sourceEditionId: string;
  publishedAt: string;
  observationPeriod: { start: string; end: string; label: string };
  points: Array<{ period: string; observedAt: string; value: number | null }>;
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
      observedAt: string | null;
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

function hasSameObservationIdentity(
  previous: ArchivedMeasure | undefined,
  current: ArchivedMeasure,
  observation: { period: string; observedAt: string },
): boolean {
  return Boolean(
    previous &&
      previous.id === current.id &&
      previous.geography.code === current.geography.code &&
      previous.geography.label === current.geography.label &&
      previous.unit === current.unit &&
      previous.comparisonKey === current.comparisonKey &&
      previous.basis === current.basis &&
      previous.points.some((point) =>
        point.period === observation.period && point.observedAt === observation.observedAt,
      ),
  );
}

function findObservationPoint(
  measure: ArchivedMeasure,
  period: string,
  observedAt: string,
): ArchivedMeasure["points"][number] | undefined {
  return measure.points.find((point) => point.period === period && point.observedAt === observedAt);
}

test("archive lineage compares observation identity rather than measure presence", () => {
  const current: ArchivedMeasure = {
    id: "housePriceAverage",
    label: "UK house price average",
    value: 273000,
    availability: "current",
    unit: "GBP",
    comparisonKey: "average-house-price",
    basis: "nominal-price-level",
    geography: { code: "K02000001", label: "United Kingdom" },
    sourceId: "housePriceIndex",
    sourceUrl: "https://example.com/current",
    sourceEditionId: "current-edition",
    publishedAt: "2026-10-01T00:00:00.000Z",
    observationPeriod: { start: "2026-07-01", end: "2026-07-31", label: "July 2026" },
    points: [
      { period: "June 2026", observedAt: "2026-07-15", value: 270000 },
      { period: "July 2026", observedAt: "2026-08-14", value: 273000 },
    ],
  };
  const previousValue = { ...current, value: 270000 };
  const previousPeriod = {
    ...previousValue,
    points: [{ period: "June 2026", observedAt: "2026-07-15", value: 270000 }],
  };
  const observation = { period: "July 2026", observedAt: "2026-08-14" };

  expect(hasSameObservationIdentity(previousValue, current, observation)).toBe(true);
  expect(hasSameObservationIdentity(previousPeriod, current, observation)).toBe(false);
  expect(hasSameObservationIdentity(
    { ...previousValue, geography: { code: "GB", label: "United Kingdom" } },
    current,
    observation,
  )).toBe(false);
  expect(hasSameObservationIdentity(
    { ...previousValue, geography: { ...current.geography, label: "Great Britain" } },
    current,
    observation,
  )).toBe(false);
  expect(findObservationPoint(current, "June 2026", "2026-07-15")).toEqual(current.points[0]);
});

test("deployed source history opens its immutable edition and primary publication", async ({ page }) => {
  test.setTimeout(30_000);
  test.skip(!publicBaseUrl, "Set PLAYWRIGHT_BASE_URL to a deployed publication");
  const baseUrl = publicBaseUrl!.endsWith("/") ? publicBaseUrl! : `${publicBaseUrl!}/`;
  const base = new URL(baseUrl);

  const indexResponse = await page.request.get(new URL("data/editions.json", base).toString());
  expect(indexResponse.status()).toBe(200);
  const index = await indexResponse.json() as { editions: Array<{ id: string }> };
  expect(index.editions.length).toBeGreaterThan(0);

  let selected: {
    id: string;
    archive: ArchiveDetail;
    measure: ArchivedMeasure;
    change: ArchiveDetail["summary"]["changes"][number];
    observation: ArchivedMeasure["points"][number];
  } | null = null;
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
    const observation = change && measure && change.period && change.observedAt
      ? findObservationPoint(measure, change.period, change.observedAt)
      : undefined;
    if (change && measure && observation?.value !== null && observation?.value !== undefined) {
      selected = { id: listed.id, archive, measure, change, observation };
      break;
    }
  }
  expect(selected, "a retained house-price observation with a primary source").not.toBeNull();

  const { id, archive, measure, change, observation } = selected!;
  expect(archive.edition).toBe(id);
  expect(change.next).toBe(observation.value);
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

  const archiveLink = page.locator(`a[href="/editions/${encodeURIComponent(id)}/"]`);
  await expect(archiveLink).toHaveText("Open historical edition →");
  await expect(archiveLink).toHaveAttribute("href", new RegExp(`/editions/${id}/?$`));
  await archiveLink.click();
  await expect(page).toHaveURL(new RegExp(`/editions/${id}/?$`));
  await expect(page.getByRole("heading", { level: 1, name: `Edition ${id}` })).toBeVisible();
  const observationChange = page.locator("li").filter({
    hasText: `${measure.id} · New observation · ${change.period} (${change.observedAt})`,
  });
  await expect(observationChange).toContainText(`→ ${observation.value} ${measure.unit}`);
  await expect(observationChange.getByRole("link", { name: "Current primary publication" }))
    .toHaveAttribute("href", change.nextSourceUrl!);
  await expect(page.getByText(`As-of observation: ${measure.observationPeriod.label}`).first()).toBeVisible();
  await expect(page.locator(`a[href="${measure.sourceUrl}"]`).first()).toBeVisible();
  await expect(page.getByText(`Archived value: ${measure.value} ${measure.unit} · ${measure.availability} at capture · source edition ${measure.sourceEditionId}`)).toBeVisible();

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
  expect(hasSameObservationIdentity(
    previousArchive.measureCatalog.measures.housePriceAverage,
    measure,
    { period: change.period!, observedAt: change.observedAt! },
  )).toBe(false);

  const baselineLink = page.locator(`a[href^="/editions/${previousEditionId}"]`);
  await expect(baselineLink).toBeVisible();
  await baselineLink.click();
  await expect(page.getByRole("heading", { level: 1, name: `Edition ${previousEditionId}` })).toBeVisible();
});
