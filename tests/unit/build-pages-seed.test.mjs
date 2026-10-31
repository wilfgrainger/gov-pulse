// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildPagesSeed } from "../../scripts/build-pages-seed.mjs";

describe("Pages seed build", () => {
  it("builds only the offline notice when every publication is disabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "pages-seed-"));
    const fetchSnapshot = vi.fn();
    const buildStaticSite = vi.fn();
    try {
      await mkdirFixture(root);
      const result = await buildPagesSeed({
        enabled: false,
        root,
        offlineEntry: "worker/offline-pages-entry.js",
        commitSha: "a".repeat(40),
        branch: "main",
        fetchSnapshot,
        buildStaticSite,
      });

      expect(result.mode).toBe("offline");
      expect(await readFile(join(root, "out", "_worker.js"), "utf8")).toBe("export default {};\n");
      expect(await readFile(join(root, "out", "index.html"), "utf8")).toBe(
        "Data publications are temporarily offline.\n",
      );
      expect(JSON.parse(await readFile(join(root, "out", "release.json"), "utf8"))).toEqual({
        commitSha: "a".repeat(40),
        branch: "main",
      });
      expect(fetchSnapshot).not.toHaveBeenCalled();
      expect(buildStaticSite).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fetches the public snapshot before building the enabled seed", async () => {
    const root = await mkdtemp(join(tmpdir(), "pages-seed-"));
    const events = [];
    try {
      await mkdirFixture(root);
      const result = await buildPagesSeed({
        enabled: true,
        root,
        commitSha: "b".repeat(40),
        branch: "main",
        fetchSnapshot: async ({ output }) => {
          events.push("fetch");
          expect(output).toBe(join(root, "public", "data", "metrics-snapshot.json"));
          await writeFile(output, "{}\n", "utf8");
        },
        buildStaticSite: () => events.push("build"),
      });

      expect(result.mode).toBe("seed");
      expect(events).toEqual(["fetch", "build"]);
      expect(JSON.parse(await readFile(join(root, "out", "release.json"), "utf8"))).toEqual({
        commitSha: "b".repeat(40),
        branch: "main",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not build stale Pages output when the public snapshot is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "pages-seed-"));
    const buildStaticSite = vi.fn();
    try {
      await mkdirFixture(root);
      await mkdir(join(root, "out"), { recursive: true });
      await writeFile(join(root, "out", "stale.html"), "stale\n", "utf8");
      await expect(buildPagesSeed({
        enabled: true,
        root,
        fetchSnapshot: async () => { throw new Error("publication unavailable"); },
        buildStaticSite,
      })).rejects.toThrow("publication unavailable");
      expect(buildStaticSite).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function mkdirFixture(root) {
  await Promise.all([
    mkdir(join(root, "worker"), { recursive: true }),
    mkdir(join(root, "public", "data"), { recursive: true }),
  ]);
  await writeFile(join(root, "worker", "offline-pages-entry.js"), "export default {};\n", "utf8");
}
