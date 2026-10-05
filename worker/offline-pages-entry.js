// Replaces the public static seed during a full publication pause. Never serves
// assets from the former seed: old JSON, CSV, HTML and RSC paths are all closed.
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, follow"><title>Data publications temporarily offline | public-data.org</title><style>body{margin:0;background:#f5f4ef;color:#14243b;font:18px/1.7 system-ui,sans-serif}main{max-width:800px;margin:12vh auto;padding:28px}h1{font-size:clamp(32px,6vw,56px);line-height:1.1}a{color:inherit}</style></head><body><main><p>public-data.org · Publication review</p><h1>Data publications are temporarily offline</h1><p>Our data publications are offline while we reverify the evidence. Publications will return individually after verification.</p><p><a href="https://public-data.org/">Visit public-data.org</a></p></main></body></html>`;

export default {
  fetch(request) {
    const data = new URL(request.url).pathname.startsWith("/data/");
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Type": data ? "application/json; charset=utf-8" : "text/html; charset=utf-8" };
    return new Response(request.method === "HEAD" ? null : data ? JSON.stringify({ code: "publication_disabled", error: "Data publication is offline for verification" }) : html, { status: data ? 503 : 200, headers });
  },
};
