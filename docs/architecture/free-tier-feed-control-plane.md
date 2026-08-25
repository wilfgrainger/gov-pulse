# Cloudflare free-tier data control plane

public-data.org keeps application delivery, national evidence publication and the bounded fallback separate so that a source failure cannot turn into a stale or misleading public claim.

## System boundary

```text
Primary publishers
      │
      ▼
Cloudflare Cron
      │
      ▼
public-data-jobs Queue ──► pulse-data-worker collectors and validators
      │                                  │
      │                                  ▼
      └──────────────────────────────► Workers KV
                                             │
                       prepared snapshot + isolated comparison
                                             │
                   public-data.org/data/*.json exact data routes

GitHub main ──► validate/build ──► data Worker + bootstrap ──► web Worker
                                                              │
                                                request-time public pages/assets

Cloudflare Pages ──► bounded static seed/fallback only
```

## Delivery planes

### Request-time web Worker

`worker/web-wrangler.toml` deploys `public-data-web` for `public-data.org/*`. OpenNext renders evidence-bearing pages from the incoming request and the same-origin server snapshot. This is the normal application plane for crawlers, link unfurlers, no-JavaScript clients and browsers. Static assets are served from the same Worker bundle.

### Data Worker

`worker/wrangler.toml` deploys `pulse-data-worker` with `workers_dev = false` and `preview_urls = false`. Its only public routes are:

- `/data/metrics-snapshot.json` — the prepared national publication;
- `/data/health.json` — ready, degraded, bootstrapping or unhealthy state;
- `/data/international-comparison.json` — the isolated comparison publication.

No wildcard data route, collector, Queue endpoint, operational status page or arbitrary KV read is public.

### Pages seed/fallback

Cloudflare Pages retains a deterministic export containing application assets and section downloads. It is not the normal custom-domain application plane. The data Worker accepts a seed only from the exact HTTPS object `https://public-data-org.pages.dev/data/metrics-snapshot.json`, only when its source evidence is complete and current, and only during the bounded bootstrap or outage fallback path.

## National publication invariants

The daily Cron (`17 3 * * *`) and three-hour betting Cron (`47 */3 * * *`) enqueue run-scoped jobs. Each section fragment is stored under `v13:publication:run:<runId>:section:<section>` with the run ID in the value and a bounded TTL. A finaliser reads only the selected run's fragments, validates source ownership and currentness, and writes the canonical publication and prepared public artifact together from the reader's perspective.

Before the retry deadline, an incomplete run remains pending. At the deadline, fresh successful source-owned fragments may be published as an explicitly degraded edition. A failed job never becomes successful merely because the deadline elapsed. The public edition carries `meta.publicationState` and an exact `missingRequiredSections` list; health reports `ready: false` for degraded editions. If no current evidence remains, the response is unavailable.

The prepared national artifact carries a `validUntil` deadline. HTTP cache headers are capped at the same evidence deadline and never use stale-while-revalidate beyond it.

## International comparison invariants

The comparison publication is written to `v1:international-comparison:current` and is refreshed independently of the national run. Each edition records measure-specific observation years, source provenance, country coverage, missingness and ranking denominators. Its seven-day due guard controls refresh work; its seven-day hard expiry controls public reads. The comparison can become unavailable without downgrading a current UK national publication.

## Repository-managed deployment

Pull Request Validation runs policy and product assurance without Cloudflare credentials: text and lockfile policy, architecture, source ownership, source-repair backlog, complexity, PR evidence, toolchain, audit, lint, tests, static build, OpenNext build and deterministic browser checks.

Deploy public-data.org is automatic only for relevant pushes to `main` and begins with an explicit release-ref guard. It validates and builds, reconciles `public-data-jobs`, deploys and verifies the data Worker, bootstraps national publication and independently queues comparison refresh, deploys the request-time web Worker, verifies live routes, and refreshes the Pages seed only after production verification. Manual dispatch is recovery-only.

## Free-tier budget

The control plane uses Workers, Cron Triggers, Queues, KV and Pages. It does not require R2, D1, Durable Objects, Browser Rendering, Workflows or a paid data service. The encoded target is nine Cron invocations, no more than 28 Queue jobs and 84 Queue operations per day, one serial consumer, bounded procurement requests and bounded KV retention. Cloudflare plan limits can change and must be rechecked before increasing cadence, source count, payload size or retention.

## Failure and rollback

- A source failure removes its expired evidence or produces an honest degraded manifest; it does not invent a value.
- Queue retries and terminal records remain run-scoped; a late retry cannot overwrite another run's fragment.
- Data Worker failure leaves the previous valid revision as the recovery target; web deployment is not presented as data readiness.
- Web Worker failure leaves the previous application revision active; data publication remains separately observable.
- Pages failure leaves the previous seed release active; Pages is not the normal data path.
- A repository release is reverted through a reviewed `main` change; no force-push or hidden manual promotion is part of the contract.

Build, deploy and DNS results are not live-data proof. The release ledger must record exact head, affected route observations, scheduled-run evidence and rollback evidence separately.
