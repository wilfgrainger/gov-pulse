# Cloudflare free-tier data control plane

public-data.org separates static presentation from live evidence publication while keeping both under repository control.

## System boundary

```text
Primary publishers
      │
      ▼
Cloudflare Cron
      │
      ▼
Cloudflare Queue ──► Worker collectors and validators
      │                         │
      │                         ▼
      └──────────────────► Workers KV
                                │
                                ▼
public-data.org/data/metrics-snapshot.json

GitHub main ──► validate/build ──► deploy Worker ──► deploy Cloudflare Pages
```

### Cloudflare owns runtime data work

The Worker configuration in `worker/wrangler.toml` declares:

- a daily complete refresh at `17 3 * * *` UTC;
- a betting-only refresh at `47 */3 * * *` UTC;
- the `public-data-jobs` Queue producer and serial consumer;
- the `METRICS_CACHE` KV binding;
- exact public routes for the aggregate snapshot and bootstrap health only.

Cron creates run-scoped Queue work. Queue consumers collect evidence, validate source contracts and write terminal records. The finaliser is delayed, deadline-aware and idempotent. It publishes only when all required sections remain complete and current.

Cloudflare stores two representations:

1. a private canonical publication containing operational metadata;
2. a pre-sanitised JSON body with a validity deadline for the public read path.

The public Worker checks KV metadata and returns the already-serialised body. It does not repeatedly parse and transform the full dataset on HTTP requests. This keeps the hot path small enough for the Workers Free CPU boundary.

### Cloudflare Pages owns presentation

Pages serves:

- the static Next.js export;
- HTML, JavaScript, CSS, sitemap, feed and social cards;
- deterministic `/data/sections/<section>.json` and `.csv` downloads;
- every route except the two exact Worker routes.

The browser requests `/data/metrics-snapshot.json` from the same origin, so it receives current Cloudflare-published evidence without a Pages rebuild. Static section downloads describe the last application build and are intentionally not presented as the continuously refreshed runtime snapshot.

## Publication invariants

A candidate may replace the current publication only when:

- every required section exists;
- each section belongs to its registered source owner;
- retrieval and observation clocks are valid UTC instants;
- evidence remains inside its source-specific currentness window;
- observation, retrieval and expiry chronology is coherent;
- the complete candidate passes its section contract.

An incomplete or malformed run records a failure state and leaves the previous publication untouched. A previous value is served only while its original evidence window remains valid. Successful checks of unchanged evidence may update retrieval metadata, but they do not invent a newer observation or edition date.

## Public boundary

The Worker may serve only:

- `/data/metrics-snapshot.json` — complete current aggregate evidence;
- `/data/health.json` — `ready`, `bootstrapping` or `unhealthy` without source data or infrastructure detail.

Collectors, Queue state, editorial operations, private metadata and arbitrary KV keys are not public routes. `workers.dev` and preview URLs remain disabled. `scripts/check-static-architecture.mjs` rejects broader ingress.

During initial migration or a bounded KV read failure, the Worker may use the existing canonical KV publication or a complete, current Pages seed. It never serves a partial candidate.

## Repository-managed deployment

There are two active workflows:

### Pull Request Validation

Runs policy and product assurance without Cloudflare credentials or mutations:

- text and lockfile policy;
- architecture and source ownership;
- change-complexity and PR-evidence policy;
- exact Node/npm toolchain;
- ESLint;
- unit and Worker tests;
- static production build;
- deterministic desktop and mobile browser journeys.

### Deploy public-data.org

Runs automatically for relevant pushes to `main`:

1. repeats the release-quality checks and builds one static export;
2. creates the `public-data-jobs` Queue when absent and reconciles its retention;
3. deploys and verifies the Worker and its KV-backed health route;
4. deploys the exact built artifact to Cloudflare Pages;
5. verifies the production revision and a representative Pages-owned evidence download.

`workflow_dispatch` is retained for recovery. Routine evidence publication does not require a person or a scheduled GitHub workflow.

## Free-tier budget

The control plane deliberately uses only Workers, Cron Triggers, Queues, KV and Pages. It does not require Browser Rendering, D1, R2, Durable Objects or Cloudflare Workflows.

The encoded daily operating target is:

- nine Cron invocations;
- no more than 28 Queue jobs and 84 Queue operations;
- one serial Queue consumer;
- no more than 36 bounded government-contract requests;
- fewer than 120 target KV writes and 300 target KV reads from scheduled work.

Public snapshot reads use Cloudflare edge caching plus one prepared KV value. Repository deployments occur only when relevant code reaches `main`, not for each data refresh.

Free-tier limits are external service constraints and can change. Maintainers must verify current Cloudflare plan limits before materially increasing cadence, source count, payload size or retention.

## Failure and rollback

- **Source failure:** preserve the last publication only while each source remains current; otherwise fail closed.
- **Queue failure:** retries and run terminal records converge; an incomplete run cannot replace the current publication.
- **Worker deployment failure:** Pages remains online and the previous Worker revision remains the recovery target.
- **Pages deployment failure:** the previous Pages release remains active; runtime data publication is independent.
- **Bad repository release:** revert the merge on `main`; the same workflow deploys the reverted Worker and Pages code.
- **Cloudflare resource drift:** the deployment reconciles the named Queue and Wrangler reconciles code, routes, triggers and bindings from repository configuration.

Issue #257 records seven consecutive scheduled runs and an exercised Worker/Pages rollback. Those operational observations are not inferred from a successful merge.

## Decision record

The detailed architectural decision and rejected alternatives are recorded in [ADR-0001](./decisions/0001-cloudflare-first-data-plane.md).
