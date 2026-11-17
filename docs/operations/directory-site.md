# public-data.org directory site

Since November 2026 public-data.org serves a static directory of where to find
UK government data. The evidence application (Next.js, Workers, KV, Queues)
remains in this repository but is not deployed; its Cloudflare resources were
removed.

- Data: `app/lib/govDataDirectory.ts` (shared with the app's `/find-data/` page).
- Renderer: `directory/render.mjs`, CLI `directory/build.mjs` (Node 24+).
- Output: `directory/dist/` — `index.html`, `404.html`, `robots.txt`,
  `sitemap.xml`, `_headers` (CSP, no third-party requests), `_redirects`.
- Tests: `tests/unit/directorySite.test.ts`.

## Deploy

Cloudflare Pages project `public-data-org` (production branch `main`, direct
upload; custom domains `public-data.org`, `www.public-data.org`).

```bash
npm run directory:build
npx wrangler pages deploy directory/dist --project-name public-data-org --branch main --commit-hash "$(git rev-parse HEAD)"
```

Needs `CLOUDFLARE_API_TOKEN` (Pages edit) and `CLOUDFLARE_ACCOUNT_ID`.

Where static asset upload is unavailable (it needs a short-lived upload JWT in
the `Authorization` header, which a credential-injecting proxy overwrites),
deploy `directory/dist-worker/_worker.js` instead. The build writes it
alongside `dist/`; it embeds every page and applies the same `_headers` and
`_redirects` (tested in `tests/unit/directoryWorker.test.ts`). Send it as the
`_worker.js` part of a `POST /accounts/:id/pages/projects/public-data-org/deployments`
multipart request with `manifest` `{}` and `branch` `main`. Deploy to a
preview branch first and check `https://<branch>.public-data-org.pages.dev`.

A manifest that lists file hashes without uploading them deploys
"successfully" but serves HTTP 500 for every path. Never do that to `main`.
Roll back by promoting an earlier deployment in the Pages dashboard.

## Adding a source

Add an entry to the right category in `app/lib/govDataDirectory.ts` with the
publisher's own HTTPS URL, conservative coverage, access modes and
`owner: "independent"` for anything not run by a public body. Run
`npm run test` and check the link resolves.
