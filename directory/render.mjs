/**
 * Renders the public-data.org directory site: a static, dependency-free set of
 * files generated from app/lib/govDataDirectory.ts. Pure functions only; the
 * CLI in build.mjs writes the result to disk.
 *
 * The page works fully without JavaScript. The inline script only narrows the
 * visible list (search and nation filter). No third-party requests, fonts,
 * analytics or cookies.
 */

export const SITE_ORIGIN = "https://public-data.org";

const NATIONS = ["England", "Scotland", "Wales", "Northern Ireland"];

// A UK-wide service also serves each nation; GB excludes Northern Ireland.
export const COVERS = {
  UK: NATIONS,
  GB: ["England", "Scotland", "Wales"],
  England: ["England"],
  "England and Wales": ["England", "Wales"],
  Scotland: ["Scotland"],
  Wales: ["Wales"],
  "Northern Ireland": ["Northern Ireland"],
};

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const nationSlug = (nation) => nation.toLowerCase().replaceAll(" ", "-");

function renderEntry(entry) {
  const nations = COVERS[entry.coverage];
  if (!nations) throw new Error(`Unknown coverage for ${entry.id}: ${entry.coverage}`);
  const host = new URL(entry.url).hostname.replace(/^www\./, "");
  const search = [entry.name, entry.publisher, entry.description, entry.access.join(" "), entry.coverage].join(" ").toLowerCase();
  return `
          <li class="entry" data-entry="${escapeHtml(entry.id)}" data-nations="${escapeHtml(nations.map(nationSlug).join(" "))}" data-search="${escapeHtml(search)}">
            <div class="entry__head">
              <h3 class="entry__name"><a href="${escapeHtml(entry.url)}" rel="noopener" target="_blank">${escapeHtml(entry.name)}<span class="sr-only"> (opens ${escapeHtml(host)} in a new tab)</span><span class="entry__arrow" aria-hidden="true">↗</span></a></h3>
              ${entry.owner === "independent" ? '<span class="tag tag--independent">Independent tool</span>' : ""}
            </div>
            <p class="entry__publisher">${escapeHtml(entry.publisher)} <span class="entry__host">· ${escapeHtml(host)}</span></p>
            <p class="entry__desc">${escapeHtml(entry.description)}</p>
            <dl class="entry__meta">
              <div><dt>Covers</dt><dd>${escapeHtml(entry.coverage)}</dd></div>
              <div><dt>Access</dt><dd>${entry.access.map((a) => `<span class="chip">${escapeHtml(a)}</span>`).join("")}</dd></div>
            </dl>
          </li>`;
}

function renderCategory(category, index) {
  const number = String(index + 1).padStart(2, "0");
  return `
      <section class="category" id="${escapeHtml(category.id)}" data-category aria-labelledby="h-${escapeHtml(category.id)}">
        <header class="category__head">
          <p class="category__num" aria-hidden="true">${number}</p>
          <div>
            <h2 id="h-${escapeHtml(category.id)}">${escapeHtml(category.title)}</h2>
            <p class="category__summary">${escapeHtml(category.summary)}</p>
          </div>
          <p class="category__count"><span data-category-count>${category.entries.length}</span> <span class="sr-only">sources</span></p>
        </header>
        <ul class="entries">${category.entries.map(renderEntry).join("")}
        </ul>
      </section>`;
}

const STYLES = `
:root{--bg:#f6f4ee;--surface:#fffdf8;--ink:#15171c;--muted:#5d5f66;--line:#d9d5ca;--line-strong:#15171c;--accent:#0f5d4c;--accent-ink:#ffffff;--tag:#f3e3b5;--tag-ink:#4a3a06;--focus:#c2410c;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif;--sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#101215;--surface:#171a1f;--ink:#ecebe6;--muted:#a3a39d;--line:#2b2f36;--line-strong:#ecebe6;--accent:#5cc2a6;--accent-ink:#0b1210;--tag:#3b3216;--tag-ink:#f3e3b5;--focus:#fb923c}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
body{margin:0;background:var(--bg);color:var(--ink);font:400 1rem/1.6 var(--sans)}
a{color:inherit}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.skip{position:absolute;left:16px;top:-48px;background:var(--ink);color:var(--bg);padding:8px 12px;z-index:10}.skip:focus{top:12px}
.wrap{max-width:76rem;margin:0 auto;padding:0 16px}@media(min-width:48rem){.wrap{padding:0 32px}}
.masthead{border-bottom:1px solid var(--line)}.masthead .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px}
.brand{font:600 1.05rem/1 var(--serif);letter-spacing:-.01em;text-decoration:none}.brand b{color:var(--accent);font-weight:600}
.masthead nav a{font-size:.9rem;color:var(--muted);text-decoration:none;margin-left:20px}.masthead nav a:hover{color:var(--ink);text-decoration:underline}
.hero{padding:56px 0 40px}@media(min-width:48rem){.hero{padding:88px 0 56px}}
.eyebrow{font:600 .75rem/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 0 20px}
.hero h1{font:400 clamp(2.4rem,7vw,5.2rem)/1.02 var(--serif);letter-spacing:-.025em;margin:0;max-width:16ch;text-wrap:balance}
.hero h1 em{font-style:italic;color:var(--accent)}
.lede{font-size:clamp(1.05rem,1.6vw,1.25rem);line-height:1.6;color:var(--muted);max-width:44rem;margin:24px 0 0}
.stats{display:flex;flex-wrap:wrap;gap:12px 40px;margin:36px 0 0;padding:0;list-style:none}
.stats li{border-top:1px solid var(--line-strong);padding-top:10px;min-width:8rem}.stats b{display:block;font:400 2rem/1.1 var(--serif)}.stats span{font-size:.85rem;color:var(--muted)}
.finder{z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-block:1px solid var(--line)}
.finder .wrap{display:grid;gap:12px;padding-block:14px}@media(min-width:56rem){.finder{position:sticky;top:0}.finder .wrap{grid-template-columns:minmax(0,1fr) auto;align-items:center}}
.search{position:relative}.search input{width:100%;min-height:48px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);font:inherit;font-size:1.05rem;padding:0 14px 0 44px;border-radius:0;-webkit-appearance:none}
.search svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--muted)}
.nations{display:flex;flex-wrap:wrap;gap:6px;border:0;margin:0;padding:0}.nations legend{float:left;font-size:.8rem;color:var(--muted);margin:0 8px 0 0;line-height:40px}
.nations button{min-height:40px;padding:0 14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:500 .9rem var(--sans);cursor:pointer}
.nations button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.status{grid-column:1/-1;margin:0;font-size:.85rem;color:var(--muted)}
.toc{padding:28px 0 8px}.toc ol{list-style:none;margin:0;padding:0;display:grid;gap:2px 24px;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));counter-reset:toc}
.toc li{counter-increment:toc}.toc a{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);text-decoration:none;font-size:.95rem}
.toc a::before{content:counter(toc,decimal-leading-zero);font:500 .75rem/1.9 var(--mono);color:var(--muted)}.toc a:hover{color:var(--accent)}
.category{padding:48px 0 8px;scroll-margin-top:120px}
.category__head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 20px;align-items:start;border-top:2px solid var(--line-strong);padding-top:16px;margin-bottom:20px}
.category__num{font:500 .8rem/2.4 var(--mono);color:var(--muted);margin:0}.category h2{font:400 clamp(1.6rem,3vw,2.3rem)/1.15 var(--serif);letter-spacing:-.015em;margin:0}
.category__summary{margin:6px 0 0;color:var(--muted);max-width:42rem}.category__count{font:400 1.6rem/1.3 var(--serif);color:var(--muted);margin:0}
.entries{list-style:none;margin:0;padding:0;display:grid;gap:1px;border-top:1px solid var(--line);border-left:1px solid var(--line)}
@media(min-width:44rem){.entries{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:68rem){.entries{grid-template-columns:repeat(3,minmax(0,1fr))}}
.entry{background:var(--surface);padding:22px 22px 18px;display:flex;flex-direction:column;box-shadow:1px 0 0 var(--line),0 1px 0 var(--line),1px 1px 0 var(--line)}
.entry__head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.entry__name{font:600 1.12rem/1.3 var(--sans);letter-spacing:-.01em;margin:0}
.entry__name a{text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:4px;text-decoration-thickness:1px}
.entry__name a:hover{color:var(--accent);text-decoration-color:currentColor}.entry__arrow{display:inline-block;margin-left:4px;font-weight:400;color:var(--muted)}
.entry__publisher{margin:6px 0 0;font:600 .72rem/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.entry__host{text-transform:none;letter-spacing:0;font-weight:400}
.entry__desc{margin:12px 0 0;flex:1;color:var(--ink);font-size:.95rem}
.entry__meta{margin:16px 0 0;padding-top:12px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:6px 18px;font-size:.8rem;color:var(--muted)}
.entry__meta div{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.entry__meta dt{font-weight:600}.entry__meta dd{margin:0;display:flex;flex-wrap:wrap;gap:4px}
.chip{border:1px solid var(--line);padding:1px 7px;font-size:.75rem;color:var(--ink)}
.tag{flex:none;font:600 .7rem/1 var(--sans);padding:5px 7px;letter-spacing:.02em}.tag--independent{background:var(--tag);color:var(--tag-ink)}
.empty{margin:40px 0;padding:28px;border:1px solid var(--line);background:var(--surface)}
.guide{margin:72px 0 0;padding:40px 0;border-top:2px solid var(--line-strong);display:grid;gap:24px}@media(min-width:56rem){.guide{grid-template-columns:1fr 2fr}}
.guide h2{font:400 2rem/1.15 var(--serif);margin:0}.guide ol{margin:0;padding-left:1.2rem;display:grid;gap:12px;color:var(--muted)}.guide strong{color:var(--ink)}
.footer{border-top:1px solid var(--line);margin-top:48px;padding:32px 0 48px;font-size:.85rem;color:var(--muted)}.footer .wrap{display:grid;gap:12px}@media(min-width:56rem){.footer .wrap{grid-template-columns:2fr 1fr}}
.footer p{margin:0;max-width:40rem}[hidden]{display:none!important}
`;

const SCRIPT = `
(function(){var q=document.getElementById("q"),buttons=[].slice.call(document.querySelectorAll("[data-nation]")),entries=[].slice.call(document.querySelectorAll("[data-entry]")),cats=[].slice.call(document.querySelectorAll("[data-category]")),status=document.getElementById("status"),empty=document.getElementById("empty"),nation="all";
function apply(){var terms=q.value.toLowerCase().split(/\\s+/).filter(Boolean),shown=0;
entries.forEach(function(el){var ok=(nation==="all"||(" "+el.dataset.nations+" ").indexOf(" "+nation+" ")>-1)&&terms.every(function(t){return el.dataset.search.indexOf(t)>-1});el.hidden=!ok;if(ok)shown++});
cats.forEach(function(c){var n=c.querySelectorAll("[data-entry]:not([hidden])").length;c.hidden=n===0;c.querySelector("[data-category-count]").textContent=n});
empty.hidden=shown>0;var label=nation==="all"?"":" covering "+buttons.filter(function(b){return b.dataset.nation===nation})[0].textContent;
status.textContent=shown+(shown===1?" source":" sources")+label+(q.value.trim()?" matching \\u2018"+q.value.trim()+"\\u2019":"")+".";
var u=new URL(location.href);q.value.trim()?u.searchParams.set("q",q.value.trim()):u.searchParams.delete("q");nation!=="all"?u.searchParams.set("nation",nation):u.searchParams.delete("nation");history.replaceState(null,"",u)}
buttons.forEach(function(b){b.addEventListener("click",function(){nation=b.dataset.nation;buttons.forEach(function(x){x.setAttribute("aria-pressed",String(x===b))});apply()})});
q.addEventListener("input",apply);document.addEventListener("keydown",function(e){if(e.key==="/"&&document.activeElement!==q&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();q.focus()}});
var p=new URLSearchParams(location.search);if(p.get("q"))q.value=p.get("q");var pn=p.get("nation");if(pn&&buttons.some(function(b){return b.dataset.nation===pn})){nation=pn;buttons.forEach(function(x){x.setAttribute("aria-pressed",String(x.dataset.nation===pn))})}
document.getElementById("finder").hidden=false;if(p.get("q")||pn)apply()})();
`;

function page({ title, description, path, body, script = "" }) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${SITE_ORIGIN}${path}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${SITE_ORIGIN}${path}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#f6f4ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101215" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230f5d4c'/%3E%3Ctext x='16' y='23' font-family='Georgia,serif' font-size='20' fill='white' text-anchor='middle'%3Ep%3C/text%3E%3C/svg%3E">
<style>${STYLES}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the directory</a>
<header class="masthead"><div class="wrap">
  <a class="brand" href="/">public-data<b>.org</b></a>
  <nav aria-label="Site"><a href="/#directory">Directory</a><a href="/#how-to-use">How to use it</a></nav>
</div></header>
${body}
<footer class="footer"><div class="wrap">
  <p>public-data.org is an independent directory. It is not a government website and is not affiliated with any publisher listed. Every link goes to the publisher's own service; we do not copy, host or alter their data.</p>
  <p>Spotted a broken link or a missing source? <a href="https://github.com/wilfgrainger/gov-pulse/issues/new?title=Directory%3A%20" rel="noopener">Tell us on GitHub</a>.</p>
</div></footer>
${script ? `<script>${script}</script>` : ""}
</body>
</html>
`;
}

export function renderHome(categories) {
  const entries = categories.flatMap((c) => c.entries);
  const official = entries.filter((e) => e.owner === "official").length;
  const publishers = new Set(entries.map((e) => e.publisher)).size;
  const apis = entries.filter((e) => e.access.includes("API")).length;
  const title = "public-data.org — The directory of UK government data";
  const description = `Where to find UK government data: ${official} official sources from ${publishers} publishers, covering national statistics, your local area, health, schools, crime, money, Parliament and your right to ask for more.`;

  const body = `
<main id="main">
  <section class="hero"><div class="wrap">
    <p class="eyebrow">The UK public data directory</p>
    <h1>Every official route to <em>UK public data</em>, in one place.</h1>
    <p class="lede">A curated, plain-English index of where government data actually lives — national statistics, devolved governments, your local area, public services, Parliament and the law — and how to ask for what isn't published.</p>
    <ul class="stats" aria-label="Directory at a glance">
      <li><b>${official}</b><span>official sources</span></li>
      <li><b>${publishers}</b><span>publishers</span></li>
      <li><b>${apis}</b><span>with an API</span></li>
      <li><b>4</b><span>nations covered</span></li>
    </ul>
  </div></section>

  <div class="finder" id="finder" hidden><div class="wrap">
    <div class="search">
      <label class="sr-only" for="q">Search the directory</label>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" autocomplete="off" spellcheck="false" placeholder="Search — try house prices, schools, crime, API">
    </div>
    <fieldset class="nations">
      <legend>Where</legend>
      <button type="button" data-nation="all" aria-pressed="true">All</button>
      ${NATIONS.map((n) => `<button type="button" data-nation="${nationSlug(n)}" aria-pressed="false">${n}</button>`).join("")}
    </fieldset>
    <p class="status" id="status" role="status" aria-live="polite">${entries.length} sources.</p>
  </div></div>

  <div class="wrap" id="directory">
    <nav class="toc" aria-label="Directory sections"><ol>
      ${categories.map((c) => `<li><a href="#${escapeHtml(c.id)}">${escapeHtml(c.title)}</a></li>`).join("")}
    </ol></nav>
    ${categories.map(renderCategory).join("")}
    <p class="empty" id="empty" hidden>Nothing matches that search. Try a broader word, start with <a href="https://www.data.gov.uk/" rel="noopener">data.gov.uk</a>, or <a href="https://www.gov.uk/make-a-freedom-of-information-request" rel="noopener">make a freedom of information request</a>.</p>

    <section class="guide" id="how-to-use" aria-labelledby="h-guide">
      <h2 id="h-guide">Before you reuse a figure</h2>
      <ol>
        <li><strong>Check the licence.</strong> Most government data is under the Open Government Licence, but not all of it — the publisher's page says which.</li>
        <li><strong>Check the geography.</strong> England-only, England and Wales, Great Britain and UK figures are not interchangeable.</li>
        <li><strong>Check the period and the version.</strong> Statistics are revised; note the publication date of the release you use.</li>
        <li><strong>Prefer the producer.</strong> Cite the organisation that collected the data, not a site that republished it — including this one.</li>
        <li><strong>Can't find it?</strong> Public authorities must answer freedom of information requests for recorded information; Scotland has its own law and commissioner.</li>
      </ol>
    </section>
  </div>
</main>`;

  return page({ title, description, path: "/", body, script: SCRIPT });
}

export function renderNotFound() {
  const body = `
<main id="main"><section class="hero"><div class="wrap">
  <p class="eyebrow">Not found</p>
  <h1>That page isn't here.</h1>
  <p class="lede">public-data.org is now a directory of UK government data. <a href="/">Browse the directory</a>.</p>
</div></section></main>`;
  return page({ title: "Page not found — public-data.org", description: "Page not found.", path: "/404", body });
}

export function renderSite(categories) {
  return {
    "index.html": renderHome(categories),
    "404.html": renderNotFound(),
    "robots.txt": `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
    "sitemap.xml": `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_ORIGIN}/</loc><changefreq>monthly</changefreq></url></urlset>\n`,
    // Old evidence-site paths and the directory alias land on the directory.
    _redirects: "/find-data / 301\n/find-data/ / 301\n/sources / 302\n/sources/ / 302\n",
    _headers: [
      "/*",
      "  X-Content-Type-Options: nosniff",
      "  Referrer-Policy: strict-origin-when-cross-origin",
      "  X-Frame-Options: DENY",
      "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
      "  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "",
    ].join("\n"),
  };
}
