import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import {
  MARKET_DEFINITIONS,
  normalizeBettingMarketPayload,
} from "../worker/betting-markets.js";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

function safeParseFloat(value) {
  if (value == null) return null;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) =>
      String.fromCodePoint(Number.parseInt(value, 16))
    )
    .trim();
}

function parseHtmlAttributes(fragment) {
  return Object.fromEntries(
    [...fragment.matchAll(/([a-zA-Z0-9:-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      stripHtml(match[2]),
    ])
  );
}

function parseOddscheckerMarketRows(html) {
  const tableMatch = html.match(/<table[^>]*class="eventTable[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error("Oddschecker market table not found");
  }

  const rowMatches = [...tableMatch[1].matchAll(/<tr class="diff-row evTabRow bc"([^>]*)>/gi)];
  if (rowMatches.length === 0) {
    throw new Error("Oddschecker market rows not found");
  }

  const bestByName = new Map();
  for (const match of rowMatches) {
    const attributes = parseHtmlAttributes(match[1]);
    const name = attributes["data-bname"]?.trim() ?? "";
    const sportsbookBest = safeParseFloat(attributes["data-best-dig"]);
    const exchangeBest = safeParseFloat(attributes["data-best-dig-wo"]);
    const decimalOdds = Math.max(sportsbookBest ?? 0, exchangeBest ?? 0);
    if (!name || decimalOdds <= 1) continue;

    const existing = bestByName.get(name);
    if (!existing || decimalOdds > existing.decimalOdds) {
      bestByName.set(name, { name, decimalOdds });
    }
  }

  const rows = [...bestByName.values()];
  if (rows.length === 0) {
    throw new Error("Oddschecker market did not expose valid decimal odds");
  }
  return rows;
}

async function fetchMarketHtml(page, url) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  if (!response || !response.ok()) {
    throw new Error(`Oddschecker returned ${response ? response.status() : "no response"} for ${url}`);
  }

  try {
    await page.waitForFunction(
      () => document.documentElement.innerHTML.includes("data-bname="),
      { timeout: 20_000 }
    );
  } catch {
    await page.waitForTimeout(5_000);
  }

  return page.content();
}

function parseArgs(argv) {
  const outIndex = argv.indexOf("--out");
  return { outPath: outIndex >= 0 ? argv[outIndex + 1] : null };
}

async function main() {
  const { outPath } = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      userAgent: BROWSER_USER_AGENT,
      locale: "en-GB",
      timezoneId: "Europe/London",
      viewport: { width: 1440, height: 1200 },
      extraHTTPHeaders: { "accept-language": "en-GB,en;q=0.9" },
    });

    const definitions = Object.values(MARKET_DEFINITIONS);
    const pages = await Promise.all(definitions.map(() => context.newPage()));
    const htmlPages = await Promise.all(
      pages.map((page, index) => fetchMarketHtml(page, definitions[index].sourceUrl))
    );
    await Promise.all(pages.map((page) => page.close()));
    await context.close();

    const observedAt = new Date().toISOString();
    const data = normalizeBettingMarketPayload(
      {
        provider: "Oddschecker",
        observedAt,
        markets: definitions.map((definition, index) => ({
          id: definition.id,
          sourceUrl: definition.sourceUrl,
          runners: parseOddscheckerMarketRows(htmlPages[index]),
        })),
      },
      new Date(observedAt)
    );

    const payload = {
      section: "bettingOdds",
      fetchedAt: data.observedAt,
      backend: "scheduled-market-ingest",
      sourceLabel: "Oddschecker public politics markets",
      data,
    };

    const serialized = `${JSON.stringify(payload, null, 2)}\n`;
    if (outPath) {
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, serialized, "utf8");
    } else {
      process.stdout.write(serialized);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
