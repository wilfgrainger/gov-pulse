// Task 13 of the static-first plan: evidence pages must be static-export compatible
// and the browser must not poll for evidence. No production behaviour changes here.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { securityHeaders as contractHeaders } from "../../contracts/security-headers.js";
import { securityHeaders as nextHeaders } from "../../next.config";
import { dossierHref } from "@/app/lib/publicMoney";
import { healthReportFromSnapshot } from "@/app/lib/usePublicationHealth";

const read = (file: string) => fs.readFileSync(file, "utf8");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe.skipIf(process.env.STATIC_EXPORT_CHECK !== "1")("static export", () => {
  it("next build with output export succeeds for all routes", () => {
    const result = spawnSync("npx", ["next", "build", "--webpack"], {
      env: { ...process.env, STATIC_EXPORT: "true" },
      encoding: "utf8",
    });
    expect(result.stdout + result.stderr).not.toMatch(/Build error occurred/);
    expect(result.status).toBe(0);
    expect(fs.existsSync("out/index.html")).toBe(true);
  }, 600_000);
});

describe("static export compatibility", () => {
  it("compare and measure restore state from URL on the client", () => {
    // Under export the pages skip searchParams; the client components read the URL.
    for (const page of ["app/compare/page.tsx", "app/measure/page.tsx", "app/sources/[id]/page.tsx"]) {
      expect(read(page), page).toMatch(/STATIC_EXPORT === "true"/);
    }
    expect(read("app/components/ComparisonStudio.tsx")).toContain("parseWorkspace(globalThis.window.location.search");
    expect(read("app/components/MeasureLibrary.tsx")).toContain("useSyncExternalStore");
    expect(read("app/sources/[id]/page.tsx")).toContain("SourceMeasureList");
    expect(read("app/components/SourceMeasureList.tsx")).toMatch(/useSearchParams/);
  });

  it("no reader component fetches /data/health.json or /data/metrics-snapshot.json", () => {
    const readers = [...sourceFiles("app/components"), "app/lib/useMetrics.ts", "app/lib/usePublicationHealth.ts"];
    for (const file of readers) {
      expect(read(file), file).not.toMatch(/fetchMetricsSnapshot|\/data\/health\.json|fetch\(\s*METRICS_SNAPSHOT_PATH/);
    }
    expect(read("app/lib/metricsSnapshot.ts")).not.toMatch(/export (async )?function fetchMetricsSnapshot/);
  });

  it("derives the freshness report from the build's snapshot and stays honest when degraded", () => {
    const base = { registryVersion: "x", generatedAt: "2026-11-05T12:00:00.000Z" };
    const ok = healthReportFromSnapshot({ meta: { ...base, sources: {
      a: { status: "ok", fetchedAt: "2026-11-05T03:00:00.000Z" },
      b: { status: "ok", fetchedAt: "2026-11-04T03:00:00.000Z" },
    } } } as never);
    expect(ok).toMatchObject({ healthy: true, lastRefresh: "2026-11-05T03:00:00.000Z" });
    const degraded = healthReportFromSnapshot({ meta: { ...base, sources: {
      a: { status: "ok", fetchedAt: "2026-11-05T03:00:00.000Z" }, b: { status: "error" },
    } } } as never);
    expect(degraded?.healthy).toBe(false);
    expect(healthReportFromSnapshot(null)).toBeNull();
  });

  it("security headers > next config, public/_headers and contracts module export the same set including CORP", () => {
    expect(nextHeaders).toBe(contractHeaders);
    const block = read("public/_headers").split("\n\n")[0].split("\n").slice(1);
    const fromFile = Object.fromEntries(block.map((line) => {
      const [key, ...value] = line.trim().split(": ");
      return [key, value.join(": ")];
    }));
    const fromModule = Object.fromEntries(contractHeaders.map(({ key, value }: { key: string; value: string }) => [key, value]));
    expect(fromModule).toEqual(fromFile);
    expect(fromModule["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });

  it("edition redirects send money buyer/supplier ids to the same dossier URL as the SSR redirect", () => {
    const rules = read("contracts/edition-redirects.txt").split("\n").filter((l) => l && !l.startsWith("#"));
    for (const kind of ["buyer", "supplier"] as const) {
      const rule = rules.find((r) => r.startsWith(`/money/${kind}/:id `));
      expect(rule, kind).toBeDefined();
      const target = rule!.split(/\s+/)[1].replace(":id", "ABC%2F1");
      expect(target).toBe(dossierHref({ kind, basis: "publisher-id", identity: "ABC/1" }));
    }
  });
});
