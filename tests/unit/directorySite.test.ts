// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { GOV_DATA_DIRECTORY } from "@/app/lib/govDataDirectory";
import { COVERS, escapeHtml, renderSite } from "@/directory/render.mjs";

const entries = GOV_DATA_DIRECTORY.flatMap((c) => c.entries);
const site = renderSite(GOV_DATA_DIRECTORY);

function load(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("directory site", () => {
  it("renders every entry as a link to its publisher, without JavaScript", () => {
    const doc = load(site["index.html"]);
    const rendered = [...doc.querySelectorAll<HTMLElement>("[data-entry]")];
    expect(rendered.map((el) => el.dataset.entry)).toEqual(entries.map((e) => e.id));
    for (const entry of entries) {
      const link = doc.querySelector(`[data-entry="${entry.id}"] h3 a`);
      expect(link?.getAttribute("href"), entry.id).toBe(entry.url);
    }
    expect(doc.querySelectorAll("[data-category]").length).toBe(GOV_DATA_DIRECTORY.length);
  });

  it("labels independent tools and keeps them out of the official count", () => {
    const doc = load(site["index.html"]);
    const independent = entries.filter((e) => e.owner === "independent");
    for (const entry of independent) expect(doc.querySelector(`[data-entry="${entry.id}"] .tag--independent`), entry.id).not.toBeNull();
    expect(doc.querySelectorAll(".tag--independent").length).toBe(independent.length);
    expect(doc.querySelector(".stats li b")?.textContent).toBe(String(entries.length - independent.length));
  });

  it("tags each entry with every nation its coverage serves", () => {
    const doc = load(site["index.html"]);
    for (const entry of entries) {
      const nations = doc.querySelector<HTMLElement>(`[data-entry="${entry.id}"]`)?.dataset.nations?.split(" ");
      expect(nations, entry.id).toEqual(COVERS[entry.coverage].map((n: string) => n.toLowerCase().replaceAll(" ", "-")));
    }
  });

  it("makes no third-party requests and sends a restrictive CSP", () => {
    const html = site["index.html"];
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/i);
    expect(html).not.toMatch(/googleapis|gtag|analytics|cookie/i);
    expect(site._headers).toContain("default-src 'none'");
    expect(site._headers).toContain("frame-ancestors 'none'");
  });

  it("escapes text so directory content cannot inject markup", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    const hostile = [{ id: "c", title: "<b>t</b>", summary: "s", entries: [{ ...entries[0], id: "x", name: '<img src=x onerror="alert(1)">' }] }];
    const doc = load(renderSite(hostile)["index.html"]);
    expect(doc.querySelector("img")).toBeNull();
    expect(doc.querySelector("h2 b")).toBeNull();
  });

  it("ships discovery files and redirects the old directory path home", () => {
    expect(site["robots.txt"]).toContain("Sitemap: https://public-data.org/sitemap.xml");
    expect(site["sitemap.xml"]).toContain("<loc>https://public-data.org/</loc>");
    expect(site._redirects).toContain("/find-data/ / 301");
    expect(load(site["404.html"]).querySelector("h1")?.textContent).toMatch(/isn't here/);
  });

  it("filters by search and nation in the browser", () => {
    document.documentElement.innerHTML = site["index.html"].replace(/^<!doctype html>\s*<html[^>]*>/i, "").replace(/<\/html>\s*$/, "");
    const script = document.querySelector("script")?.textContent ?? "";
    new Function(script)();
    const visible = () => [...document.querySelectorAll<HTMLElement>("[data-entry]")].filter((el) => !el.hidden).map((el) => el.dataset.entry);
    expect(document.getElementById("finder")?.hidden).toBe(false);
    expect(visible().length).toBe(entries.length);

    const q = document.getElementById("q") as HTMLInputElement;
    q.value = "house prices";
    q.dispatchEvent(new Event("input"));
    expect(visible()).toContain("ukhpi");
    expect(visible()).not.toContain("hansard");

    q.value = "";
    q.dispatchEvent(new Event("input"));
    (document.querySelector('[data-nation="northern-ireland"]') as HTMLButtonElement).click();
    expect(visible()).toContain("nisra");
    expect(visible()).not.toContain("stat-xplore");
    expect(document.getElementById("status")?.textContent).toMatch(/covering Northern Ireland/);

    q.value = "zzzz-nothing";
    q.dispatchEvent(new Event("input"));
    expect(document.getElementById("empty")?.hidden).toBe(false);
  });
});
