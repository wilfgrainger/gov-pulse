import { chromium } from '@playwright/test';
import { buildMigrationStats } from '../worker/migration.js';
import {
  SOURCE_QUERIES,
  fetchImfSeries,
  fetchOecdSeries,
  fetchSipri2025Series,
  fetchWorldBankSeries,
} from '../worker/international-comparison-sources.js';

const diagnostics = [
  ['migration', () => buildMigrationStats(fetch)],
  ['imf-gdp-2023', () => fetchImfSeries('NGDPDPC', 2023, fetch)],
  ['imf-gdp-2024', () => fetchImfSeries('NGDPDPC', 2024, fetch)],
  ['imf-gdp-2026', () => fetchImfSeries('NGDPDPC', 2026, fetch)],
  ['imf-debt-2026', () => fetchImfSeries('GGXWDG_NGDP', 2026, fetch)],
  ['imf-interest-2024', () => fetchImfSeries('ie@FPP', 2024, fetch)],
  ['world-bank-population-2025', () => fetchWorldBankSeries('SP.POP.TOTL', 2025, fetch)],
  ['world-bank-health-2024', () => fetchWorldBankSeries('SH.XPD.CHEX.PC.CD', 2024, fetch)],
  ['oecd-oda-2025', () => fetchOecdSeries(SOURCE_QUERIES.oecdOda2025, 2025, fetch)],
  ['oecd-socx-2023', () => fetchOecdSeries(SOURCE_QUERIES.oecdSocx2023, 2023, fetch)],
  ['oecd-tax-2024', () => fetchOecdSeries(SOURCE_QUERIES.oecdTax2024, 2024, fetch)],
  ['sipri-2025', () => fetchSipri2025Series(fetch)],
];

for (const [name, factory] of diagnostics) {
  try {
    const result = await factory();
    if (result instanceof Map) {
      console.log(`SOURCE_OK ${name} size=${result.size} GBR=${JSON.stringify(result.get('GBR') ?? null)}`);
    } else {
      console.log(`SOURCE_OK ${name} headline=${JSON.stringify(result?.headline ?? null)}`);
    }
  } catch (error) {
    console.log(`SOURCE_ERROR ${name} ${error instanceof Error ? error.message : String(error)}`);
  }
}

const base = 'https://public-data.org';
for (const path of ['/', '/section/uk-in-context', '/sources', '/data/health.json', '/data/metrics-snapshot.json', '/data/international-comparison.json']) {
  const response = await fetch(`${base}${path}`, { headers: { accept: path.startsWith('/data/') ? 'application/json' : 'text/html' } });
  const text = await response.text();
  console.log(`LIVE_ROUTE ${path} status=${response.status} type=${response.headers.get('content-type') ?? ''} delivery=${response.headers.get('x-publication-delivery') ?? ''}`);
  if (path === '/') {
    const revision = text.match(/(?:app(?:lication)?\s+revision|revision)[^0-9a-f]{0,40}([0-9a-f]{7,40})/i)?.[1] ?? null;
    console.log(`LIVE_HOME_REVISION ${revision}`);
  }
  if (path === '/section/uk-in-context') {
    console.log(`LIVE_CONTEXT_PREFIX ${text.replace(/\s+/g, ' ').slice(0, 1200)}`);
  }
  if (path.endsWith('health.json')) console.log(`LIVE_HEALTH ${text.slice(0, 2000)}`);
  if (path.endsWith('international-comparison.json')) console.log(`LIVE_COMPARISON ${text.slice(0, 4000)}`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const path of ['/', '/section/uk-in-context']) {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(JSON.stringify({
      path,
      status: response?.status() ?? null,
      title: await page.title(),
      h1: await page.locator('h1').allTextContents(),
      mainCount: await page.locator('main').count(),
      bodyPrefix: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 2200),
    }));
  }
} finally {
  await browser.close();
}
