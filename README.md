# public-data.org

An independent UK public-evidence service built with Next.js, TypeScript and verified primary-source data. Version 1.0.0 keeps the public product deliberately small: request-time evidence pages, an isolated data publication Worker, and a bounded static seed for recovery.

## Runtime architecture

public-data.org has three delivery planes:

1. **`public-data-web`** is the normal application Worker. It renders evidence-bearing pages at request time, serves the application assets, and gives browsers, crawlers, link unfurlers and no-JavaScript clients the same currentness decision.
2. **`pulse-data-worker`** is the data plane. Its only public HTTP routes are `/data/metrics-snapshot.json`, `/data/health.json` and `/data/international-comparison.json`. Collectors, Queue state, editorial operations and KV keys are not public routes.
3. **Cloudflare Pages** retains a bounded static export. It is a seed/fallback distribution, not the normal `public-data.org` application plane. The data Worker may use its validated snapshot only inside the documented bootstrap and outage boundary.

The national publication path is `Cron → Queue → source collectors → validation and normalisation → run-scoped KV fragments → run terminal records → deadline-aware finaliser → atomic prepared public artifact → request-time delivery`. International comparison publication is isolated from national readiness and expires after seven days when it is not refreshed.

The source-of-truth registry is [worker/feed-registry.js](./worker/feed-registry.js). The browser consumes the public contracts through [app/lib/useMetrics.ts](./app/lib/useMetrics.ts) and the request-time server snapshot. No browser code calls a collector or exposes a cache key, account identifier, secret or deployment route.

## Public evidence contract

Every public claim identifies what changed, why it matters, what was measured, the observation period and geography, the unit, the publication date, the direct primary source, and the material revision or uncertainty caveat. Official statistics, administrative data, polling, market signals and crime source classes remain separate. Missing, stale, incomplete or incomparable evidence is unavailable or `null`, never zero, a forecast, an interpolation or a synthetic replacement.

The national public snapshot is current only when each included section passes its source-specific currentness policy. A partial edition is explicitly marked `meta.publicationState = "degraded"` with an exact `missingRequiredSections` manifest; `/data/health.json` then reports `ready: false`. Expired values are removed rather than silently carried forward. The international comparison keeps measure-specific years, country coverage, missingness and ranking denominators and never calculates an overall country score.

## Local development

Use the exact Node version in `.nvmrc` and npm version in `package.json`:

```bash
nvm use
npm run toolchain:check
npm ci
npm run dev
```

Open `http://localhost:3000`. Local development intentionally does not pretend to have a live Cloudflare publication; the production request-time bundle is validated separately through the OpenNext Worker build.

## Quality gates

```bash
npm run toolchain:check
npm run hosting:check
npm run lint
npm run test
npm run build:check
npm run test:e2e
```

Pull requests additionally run architecture, source ownership, text, lockfile, change-complexity and PR-evidence guards, the production dependency audit, the static seed build, the pinned OpenNext build and deterministic desktop/mobile browser journeys. The `quality` job is the branch-protection aggregate.

## Deployment

The two active workflows are:

- **Pull Request Validation** — assurance only; it has no Cloudflare credentials and does not mutate infrastructure.
- **Deploy public-data.org** — automatic for relevant changes on `main`; it enforces the release ref, validates/builds once, reconciles the `public-data-jobs` Queue, deploys and verifies the data Worker, bootstraps national and comparison publication independently, deploys the request-time web Worker, verifies live evidence routes, and refreshes the Pages seed only after production verification.

Manual dispatch is recovery-only and is refused unless the selected ref is `main`. The workflow never uses a GitHub scheduled job for recurring evidence collection.

Required GitHub environment configuration:

- The `cloudflare-internal-worker` environment with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The current deployment job uses this protected environment for both Worker deployments and the verified Pages seed refresh.

Keep tokens restricted to the intended Cloudflare account and `public-data.org` resources. Secret values must never be committed, printed or copied into issues, prompts or evidence records. `workers_dev = false`, `preview_urls = false`, exact route declarations and [scripts/check-hosting-boundary.mjs](./scripts/check-hosting-boundary.mjs) enforce the public boundary.

Operational release, incident and rollback guidance is in [docs/manual-rollout-checklist.md](./docs/manual-rollout-checklist.md). A green build, deployment response or DNS answer is not by itself live-data proof; production claims require exact-head checks and observation of the affected public journey.

## Code and data licensing

The application source is licensed under [Apache License 2.0](./LICENSE). Public-source datasets, publisher documents, government data, fonts and other third-party materials retain their own terms; see [DATA-LICENSING.md](./DATA-LICENSING.md). The application licence does not grant rights to republish a named publisher's material.
