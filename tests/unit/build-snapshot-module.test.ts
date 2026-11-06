import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error The generator is a plain ESM script without type declarations.
import { ensure, generate } from "../../scripts/generate-build-snapshot-module.mjs";
import fixture from "../fixtures/publication/current-snapshot.json";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const directories: string[] = [];

async function workspace() {
  const directory = await mkdtemp(join(tmpdir(), "public-data-build-module-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("build snapshot module", () => {
  it("writes null export when input missing and fetch fails", async () => {
    const directory = await workspace();
    const output = join(directory, "metricsSnapshot.ts");
    // A previous artifact output must never be reused.
    await writeFile(output, 'export const BUILD_METRICS_SNAPSHOT: unknown = { "stale": true };\n', "utf8");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unavailable"));

    const result = await generate({ input: join(directory, "missing.json"), fetchImpl, now: NOW, output });

    expect(result).toEqual({ wrote: "null" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://public-data.org/data/metrics-snapshot.json");
    const source = await readFile(output, "utf8");
    expect(source).toContain("export const BUILD_METRICS_SNAPSHOT: unknown = null;");
    expect(source).not.toContain("stale");
  });

  it("is not tracked by git", () => {
    const tracked = execFileSync("git", ["ls-files", "app/generated"], { encoding: "utf8" }).trim();
    expect(tracked).toBe("");
    expect(execFileSync("git", ["check-ignore", "app/generated/metricsSnapshot.ts"], { encoding: "utf8" }).trim())
      .toBe("app/generated/metricsSnapshot.ts");
  });

  it("prefers the input file, then a fetched artifact, and never publishes expired evidence", async () => {
    const directory = await workspace();
    const output = join(directory, "metricsSnapshot.ts");
    const input = join(directory, "snapshot.json");
    await writeFile(input, JSON.stringify(fixture), "utf8");
    const fetchImpl = vi.fn();

    expect(await generate({ input, fetchImpl, now: NOW, output })).toEqual({ wrote: "artifact" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await readFile(output, "utf8")).toContain('"nationalDebt"');

    const fetched = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }));
    expect(await generate({ fetchImpl: fetched, now: NOW, output })).toEqual({ wrote: "artifact" });
    expect(fetched).toHaveBeenCalledTimes(1);

    const later = new Date("2027-06-01T00:00:00.000Z");
    expect(await generate({ input, fetchImpl: vi.fn().mockRejectedValue(new Error("offline")), now: later, output }))
      .toEqual({ wrote: "null" });
    expect(await readFile(output, "utf8")).toContain("BUILD_METRICS_SNAPSHOT: unknown = null;");
  });

  it("--ensure creates the null export only when missing and never overwrites", async () => {
    const directory = await workspace();
    const output = join(directory, "nested", "metricsSnapshot.ts");

    expect(await ensure({ output })).toEqual({ wrote: "null" });
    expect(await readFile(output, "utf8")).toContain("BUILD_METRICS_SNAPSHOT: unknown = null;");

    await writeFile(output, "export const BUILD_METRICS_SNAPSHOT: unknown = { kept: true };\n", "utf8");
    expect(await ensure({ output })).toEqual({ wrote: "existing" });
    expect(await readFile(output, "utf8")).toContain("kept: true");
  });

  it("oversize response writes the null export", async () => {
    const directory = await workspace();
    const output = join(directory, "metricsSnapshot.ts");
    const big = JSON.stringify({ pad: "x".repeat(3 * 1024 * 1024) });

    const streamed = vi.fn().mockResolvedValue(new Response(big, { status: 200 }));
    expect(await generate({ fetchImpl: streamed, now: NOW, output })).toEqual({ wrote: "null" });

    const declared = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200, headers: { "content-length": String(3 * 1024 * 1024) } })
    );
    expect(await generate({ fetchImpl: declared, now: NOW, output })).toEqual({ wrote: "null" });
    expect(await readFile(output, "utf8")).toContain("BUILD_METRICS_SNAPSHOT: unknown = null;");
  });

  it("emits a GitHub Actions warning only for a null export after failure", async () => {
    const directory = await workspace();
    const output = join(directory, "metricsSnapshot.ts");
    const failing = () => vi.fn().mockRejectedValue(new Error("offline"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const previous = process.env.GITHUB_ACTIONS;
    try {
      delete process.env.GITHUB_ACTIONS;
      await generate({ fetchImpl: failing(), now: NOW, output });
      expect(log).not.toHaveBeenCalled();

      process.env.GITHUB_ACTIONS = "true";
      await generate({ fetchImpl: failing(), now: NOW, output });
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0][0])).toMatch(/^::warning::[^\n]+$/);

      log.mockClear();
      await ensure({ output: join(directory, "other.ts") });
      await generate({ fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture))), now: NOW, output });
      expect(log).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.GITHUB_ACTIONS;
      else process.env.GITHUB_ACTIONS = previous;
      log.mockRestore();
      warn.mockRestore();
    }
  });
});
