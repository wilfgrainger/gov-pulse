# Cloudflare data Worker (runtime data plane)

> Corrected 2026-09-29 to match shipped code. Prior revisions described this
> Worker as an internal, route-less, four-hour-cron component deployed manually.
> That is no longer true: the data Worker owns five exact public `/data/*` routes,
> runs a daily plus three-hourly cron, and deploys automatically from `main`.
> Ground truth lives in `worker/wrangler.toml`, `worker/public-data-entry.js`
> and `.github/workflows/deploy.yml`; this document only describes them.

## Role in the delivery plane

The data Worker (`worker/public-data-entry.js`) owns the runtime data plane. It
sits alongside the request-time `public-data-web` Worker (built from the Next.js
application with the pinned OpenNext adapter) and the bounded Cloudflare Pages
seed/fallback. It is a public component: the application and browser consume its
routes as same-origin public contracts.

## Public HTTP boundary

The Worker exposes exactly five public routes, attached in `worker/wrangler.toml` and enumerated in `contracts/public-surfaces.json`:

- `/data/metrics-snapshot.json`
- `/data/health.json`
- `/data/international-comparison.json`
- `/data/editions.json`
- `/data/edition.json?edition=<validated-edition-id>`

Every other path returns 404. `workers_dev = false` and `preview_urls = false`
still prevent `workers.dev` and preview hostnames, so the only public ingress is
the five zoned routes above. The edition routes are read-only, bounded, and
serve only retained historical evidence. No collector, refresh or diagnostic
route is public. Do not add a wildcard `/data/*`, a browser-to-collector call,
or an exposed cache key or secret without an explicit recorded architecture
decision and manifest/test updates.

## Scheduled responsibilities

The Worker runs the Cloudflare Free plan schedule in `worker/wrangler.toml`
(`crons = ["17 3 * * *", "47 */3 * * *"]`):

- The daily cron (`17 3 * * *`) refreshes generic, external and procurement
  evidence.
- The three-hour cron (`47 */3 * * *`) refreshes betting markets.

A single `public-data-jobs` Queue runs one bounded job at a time with retry
limits. Accepted records are stored in the `METRICS_CACHE` KV namespace as
section fragments, run state and terminals, the current national publication,
bounded history, the prepared public artifact and the isolated international
comparison publication. Each source contract validates observation period,
provenance and acceptable age; a successful retrieval of unchanged data never
creates a newer observation or edition date.

## Local development

```bash
npm run worker:dev
```

Local Wrangler development exposes health, registry, metrics and refresh
handlers for diagnostics. They must not be promoted to public routes without an
explicit security review and a recorded architecture decision.

## Deployment

Deployment is automatic, not manual. `.github/workflows/deploy.yml`
(`Deploy public-data.org`) runs on push to `main` for changes under `worker/**`
and the workflow itself. In one environment-gated job it installs the locked
toolchain, compiles the Next.js application with OpenNext once, deploys the
request-time `public-data-web` Worker and the data Worker, and performs bounded
revision, route and health checks. Manual dispatch can additionally bootstrap
publication recovery or rebuild the secondary Pages fallback. A green build or a
Worker deployment alone is not a live-data claim; production is confirmed only
after exact-head route/health checks and the affected public journey.

## Operational guardrails

- Cron runs in UTC and refreshes are idempotent.
- KV is eventually consistent; the browser consumes only the verified same-origin
  public routes, never Worker internals or cache keys.
- A successful retrieval does not prove a source published a new observation;
  each source contract still validates period, provenance and acceptable age.
- A degraded edition declares `meta.publicationState = "degraded"` and an exact
  `missingRequiredSections` manifest, and `/data/health.json` reports
  `ready: false`.
- Do not add a public Worker route, browser Worker URL, second data service,
  tracking, personal-data collection or a paid Cloudflare product without an
  explicit architecture decision.
