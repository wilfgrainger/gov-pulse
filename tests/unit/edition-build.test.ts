// @vitest-environment node
// Task 14 of the static-first plan: per-edition static build with unavailable
// variants and a complete gating manifest. The fast lane drives the real
// pipeline with a stand-in for `next build`; the real export runs only under
// STATIC_EXPORT_CHECK=1 (same rule as tests/unit/static-export-compat.test.ts).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/publication/current-snapshot.json";
import { securityHeaders } from "../../contracts/security-headers.js";
import { classifyEmittedFiles, evidenceValues, type EditionManifest } from "@/app/lib/editionManifest";
import { buildEditionSite, MAX_ASSET_BYTES, MAX_ASSET_FILES } from "../../scripts/build-edition-site.mjs";

const FIXTURE_ID = fixture.meta.editionSummary.id;
const NOW = new Date("2026-11-05T12:00:00.000Z");
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edition-build-"));
  tmpDirs.push(dir);
  return dir;
}

function write(root: string, file: string, body: string) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), body);
}

function walk(root: string, dir = root): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(root, full) : [path.relative(root, full).split(path.sep).join("/")];
  });
}

type Snapshot = Record<string, unknown> & { meta: { sources: Record<string, unknown> } };

/** Stand-in for `next build`: serialises the build input the way pages and RSC payloads do. */
async function fakeNextBuild({ snapshot, outDir }: { snapshot: Snapshot | null; outDir: string }) {
  const feeds = snapshot ? Object.keys(snapshot.meta.sources) : [];
  write(outDir, "about/index.html", "<h1>About this publication</h1>");
  write(outDir, "_next/static/chunks/main.js", "console.log('hydrate')");
  write(outDir, "index.html", snapshot
    ? `<main>${feeds.map((id) => `<pre>${JSON.stringify(snapshot[id])}</pre>`).join("")}</main>`
    : "<main><p>Evidence unavailable</p></main>");
  write(outDir, "index.txt", `0:${JSON.stringify(snapshot ? feeds.map((id) => snapshot[id]) : null)}`);
  write(outDir, "section/gdp/index.html", snapshot?.gdpTracker
    ? `<pre>${JSON.stringify(snapshot.gdpTracker)}</pre>` : "<p>GDP evidence unavailable</p>");
  write(outDir, "section/gdp/__next.section.$d$id.__PAGE__.txt", `0:${JSON.stringify(snapshot?.gdpTracker ?? null)}`);
  write(outDir, "feed.xml", `<rss>${feeds.map((id) => `<item>${id}</item>`).join("")}</rss>`);
  write(outDir, "sitemap.xml", `<urlset>${feeds.map((id) => `<url>/x/${id}</url>`).join("")}</urlset>`);
  for (const id of feeds) write(outDir, `data/sections/${id}.json`, JSON.stringify(snapshot![id]));
}

function okFetch(body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
}

async function build(overrides: Record<string, unknown> = {}) {
  const outDir = path.join(tmp(), "out");
  const manifest: EditionManifest = await buildEditionSite({
    editionId: FIXTURE_ID, sha: "abc123", origin: "https://example.test", now: NOW, outDir,
    input: structuredClone(fixture), nextBuild: fakeNextBuild, ...overrides,
  });
  return { outDir, manifest };
}

describe("edition build", () => {
  it("refuses to emit when fetched editionId differs from requested", async () => {
    const outDir = path.join(tmp(), "out");
    await expect(buildEditionSite({
      editionId: "catalog-requested", sha: "abc123", origin: "https://example.test", now: NOW, outDir,
      fetchImpl: okFetch(fixture), retryMs: 0, nextBuild: fakeNextBuild,
    })).rejects.toThrow(/edition id/i);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it("route validUntil is the minimum of embedded feeds", async () => {
    const { manifest } = await build();
    // index.html embeds the published fixture feeds (electionPolling is held): nationalDebt expires first.
    expect(manifest.files["/index.html"]).toMatchObject({ validUntil: "2026-11-14T00:00:00.000Z" });
    expect(manifest.files["/index.html"].feeds.sort()).toEqual(["gdpTracker", "nationalDebt"]);
    // A section download embeds only its own feed.
    expect(manifest.files["/data/sections/gdpTracker.json"]).toEqual({
      validUntil: "2026-12-24T00:00:00.000Z", feeds: ["gdpTracker"], unavailable: { status: 503 },
    });
  });

  it("every emitted file containing fixture evidence values is served only through a gated pattern", async () => {
    const { outDir, manifest } = await build();
    const values = evidenceValues(fixture);
    expect(values.length).toBeGreaterThan(5);
    const embedding = Object.fromEntries(Object.entries(manifest.files).map(([file, entry]) => [file.slice(1), entry.feeds]));
    const result = classifyEmittedFiles(outDir, embedding, values);
    expect(result.unexplained).toEqual([]);
    expect(result.evidenceBearing.length).toBeGreaterThan(0);
    for (const file of result.evidenceBearing) {
      const entry = manifest.files[`/${file}`];
      expect(entry, file).toBeDefined();
      if (typeof entry.unavailable === "string") expect(fs.existsSync(path.join(outDir, entry.unavailable)), file).toBe(true);
      else expect(entry.unavailable).toEqual({ status: 503 });
    }
    // Every file in the output was classified, and nothing evidence-free is gated needlessly.
    expect([...result.evidenceBearing, ...result.clean].sort()).toEqual(walk(outDir).sort());
    expect(manifest.files["/about/index.html"]).toBeUndefined();
    expect(manifest.files["/_next/static/chunks/main.js"]).toBeUndefined();
    for (const file of ["/feed.xml", "/sitemap.xml", "/index.txt", "/section/gdp/__next.section.$d$id.__PAGE__.txt"]) {
      expect(manifest.files[file], file).toBeDefined();
    }
  });

  it("fails the build when a file carries evidence the embedding record does not list", async () => {
    const leaky = async (args: { snapshot: Snapshot | null; outDir: string }) => {
      await fakeNextBuild(args);
      // Same bytes in both variants, so the differential record cannot see it.
      write(args.outDir, "about/stale.html", `<p>Debt ${(fixture.nationalDebt.baseDebt / 1e9).toFixed(1)}bn</p>`);
    };
    await expect(build({ nextBuild: leaky })).rejects.toThrow(/unexplained.*about\/stale\.html/i);
  });

  it("reformatted values are caught by the normalised scan backstop", () => {
    const dir = tmp();
    write(dir, "a.html", "<td>1,234.5</td>");
    write(dir, "b.html", "<p>Spend £1.2bn</p>");
    write(dir, "c.txt", '0:["12.3%"]');
    write(dir, "d.html", "<p>Nothing here: 2026, 1.0, 12</p>");
    const result = classifyEmittedFiles(dir, { "c.txt": ["gdpTracker"] }, ["1234.5", "1234567890", "12.3"]);
    expect(result.unexplained.sort()).toEqual(["a.html", "b.html"]);
    expect(result.evidenceBearing.sort()).toEqual(["a.html", "b.html", "c.txt"]);
    expect(result.clean).toEqual(["d.html"]);
  });

  it("unavailable variants contain no evidence values", async () => {
    const { outDir, manifest } = await build();
    const variants = Object.values(manifest.files).flatMap((entry) => typeof entry.unavailable === "string" ? [entry.unavailable] : []);
    expect(variants).toContain("/_unavailable/index.html");
    expect(variants).toContain("/_unavailable/index.txt");
    const variantDir = path.join(outDir, "_unavailable");
    expect(classifyEmittedFiles(variantDir, {}, evidenceValues(fixture)).evidenceBearing).toEqual([]);
    // Only variants the manifest points to are kept.
    expect(walk(variantDir).map((file) => `/_unavailable/${file}`).sort()).toEqual([...new Set(variants)].sort());
  });

  it("held feeds are absent from every emitted file", async () => {
    const config = { publications: {
      electionPolling: { state: "published" }, gdpTracker: { state: "published" }, nationalDebt: { state: "held" },
    } };
    const { outDir, manifest } = await build({ config });
    // Values only nationalDebt carries (shared observation timestamps excluded).
    const others = new Set(evidenceValues({ ...fixture, meta: { sources: { electionPolling: {}, gdpTracker: {} } } }));
    const debtValues = evidenceValues({ meta: { sources: { nationalDebt: {} } }, nationalDebt: fixture.nationalDebt })
      .filter((value) => !others.has(value));
    expect(debtValues.length).toBeGreaterThan(5);
    expect(classifyEmittedFiles(outDir, {}, debtValues).evidenceBearing).toEqual([]);
    expect(Object.values(manifest.files).some((entry) => entry.feeds.includes("nationalDebt"))).toBe(false);
    expect(manifest.held).toContain("nationalDebt");
  });

  it("total files under 20000 and each under 25 MiB", async () => {
    expect(MAX_ASSET_FILES).toBe(20_000);
    expect(MAX_ASSET_BYTES).toBe(25 * 1024 * 1024);
    const { outDir } = await build();
    const files = walk(outDir);
    expect(files.length).toBeLessThan(MAX_ASSET_FILES);
    for (const file of files) expect(fs.statSync(path.join(outDir, file)).size).toBeLessThan(MAX_ASSET_BYTES);
    const oversized = async (args: { snapshot: Snapshot | null; outDir: string }) => {
      await fakeNextBuild(args);
      write(args.outDir, "big.bin", "");
      fs.truncateSync(path.join(args.outDir, "big.bin"), MAX_ASSET_BYTES + 1);
    };
    await expect(build({ nextBuild: oversized })).rejects.toThrow(/25 MiB/);
  });

  it("_headers carries the security header set and no s-maxage on HTML", async () => {
    const { outDir } = await build();
    const headers = fs.readFileSync(path.join(outDir, "_headers"), "utf8");
    for (const { key, value } of securityHeaders) expect(headers).toContain(`  ${key}: ${value}`);
    expect(headers).not.toMatch(/s-maxage/i);
    expect(headers).toMatch(/\/_next\/static\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
    expect(fs.readFileSync(path.join(outDir, "_redirects"), "utf8")).toContain("/money/buyer/:id ");
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "edition-manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ editionId: FIXTURE_ID, sha: "abc123" });
  });
});

describe("feed sprawl", () => {
  it("probe feed emits no evidence in the edition build", async () => {
    // An unknown feed id is held by decisionFor, as a new feeds/__probe/ folder would be.
    const input = structuredClone(fixture) as Snapshot;
    input.meta.sources.__probe = { ...fixture.meta.sources.gdpTracker };
    input.__probe = { ...fixture.gdpTracker, probeValue: 987654.321 };
    const { outDir, manifest } = await build({ input });
    expect(classifyEmittedFiles(outDir, {}, ["987654.321"]).evidenceBearing).toEqual([]);
    expect(Object.keys(manifest.files).some((file) => file.includes("__probe"))).toBe(false);
    expect(Object.values(manifest.files).some((entry) => entry.feeds.includes("__probe"))).toBe(false);
  });
});

describe.skipIf(process.env.STATIC_EXPORT_CHECK !== "1")("edition build (real next export)", () => {
  it("emits the manifest and unavailable section variant from the fixture", () => {
    const outDir = path.join(tmp(), "out");
    const result = spawnSync("node", [
      "scripts/build-edition-site.mjs", "--input", "tests/fixtures/publication/current-snapshot.json",
      "--edition", FIXTURE_ID, "--sha", "test", "--out", outDir,
    ], { encoding: "utf8" });
    expect(result.stdout + result.stderr).not.toMatch(/Build error occurred|unexplained/i);
    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(outDir, "edition-manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "_unavailable/section/gdp/index.html"))).toBe(true);
  }, 900_000);
});
