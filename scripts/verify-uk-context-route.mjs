// Focused production smoke test used during route-recovery incidents.
const url = process.argv[2] ?? "https://public-data.org/section/uk-in-context/";

const response = await fetch(url, {
  redirect: "follow",
  headers: { "user-agent": "public-data-uk-context-smoke/1.0" },
  signal: AbortSignal.timeout(10_000),
});

if (!response.ok) {
  throw new Error(`${url} returned HTTP ${response.status}`);
}

const html = await response.text();
if (!/<h1[^>]*>[^<]*UK in context[^<]*<\/h1>/i.test(html) && !/UK in context/i.test(html)) {
  throw new Error(`${url} did not contain the UK in context page identity`);
}

console.log(`Verified UK in context production page: ${url}`);
