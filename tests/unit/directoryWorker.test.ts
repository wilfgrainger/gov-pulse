// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { GOV_DATA_DIRECTORY } from "@/app/lib/govDataDirectory";
import { renderSite } from "@/directory/render.mjs";
import { parseHeaders, parseRedirects, renderWorker } from "@/directory/worker.mjs";

const files = renderSite(GOV_DATA_DIRECTORY);

async function loadWorker() {
  const dir = mkdtempSync(join(tmpdir(), "directory-worker-"));
  const file = join(dir, "_worker.js");
  writeFileSync(file, renderWorker(files));
  return (await import(pathToFileURL(file).href)).default as { fetch(request: Request): Promise<Response> };
}

describe("directory Pages worker", () => {
  it("serves the same home page bytes and security headers as the static build", async () => {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://public-data.org/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toBe(files["index.html"]);
    for (const [name, value] of Object.entries(parseHeaders(files._headers))) expect(res.headers.get(name), name).toBe(value);
  });

  it("applies the redirect rules, serves discovery files and returns a real 404", async () => {
    const worker = await loadWorker();
    for (const [from, [to, status]] of Object.entries(parseRedirects(files._redirects))) {
      const res = await worker.fetch(new Request(`https://public-data.org${from}`));
      expect(res.status, from).toBe(status);
      expect(res.headers.get("location"), from).toBe(to);
    }
    expect(await (await worker.fetch(new Request("https://public-data.org/robots.txt"))).text()).toBe(files["robots.txt"]);
    expect((await worker.fetch(new Request("https://public-data.org/sitemap.xml"))).headers.get("content-type")).toMatch(/xml/);
    const missing = await worker.fetch(new Request("https://public-data.org/section/gdp/"));
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe(files["404.html"]);
  });

  it("answers HEAD without a body and refuses mutations", async () => {
    const worker = await loadWorker();
    const head = await worker.fetch(new Request("https://public-data.org/", { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const post = await worker.fetch(new Request("https://public-data.org/", { method: "POST", body: "x" }));
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
  });
});
