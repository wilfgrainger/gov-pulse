# public-data.org

An independent UK public-evidence service built with Next.js, TypeScript and verified primary-source data.

## Architecture

public-data.org uses a Cloudflare-first data plane with the repository as the source of truth:

- **Cloudflare web Worker** serves the request-time Next.js application through the pinned OpenNext adapter. **Cloudflare Pages** retains a bounded seed/fallback export.
- **Cloudflare Cron Triggers** start bounded evidence refreshes.
- **Cloudflare Queues** serialise source work, retries and run finalisation.
- **Cloudflare Workers** collect, validate and publish evidence.
- **Workers KV** stores source records, run state, the canonical private publication and a pre-sanitised public snapshot.
- The data Worker serves three exact same-origin routes: `/data/metrics-snapshot.json`, `/data/health.json` and `/data/international-comparison.json`.
- **GitHub Actions** tests, builds and deploys repository code. It does not collect recurring data or manually promote daily editions.

A merge to `main` validates source, builds the application once, deploys both Workers and runs bounded revision/route/health checks. Source collection runs independently in Cloudflare. Manual dispatch can bootstrap evidence or refresh the secondary Pages seed. See [deployment and recovery](./docs/operations/deployment-ci-frugality.md).

The [data explorer](https://public-data.org/explore/) presents 27 separately sourced measures with search, topic filters, published history, endpoint comparisons and CSV export. It shows only evidence that remains within its source-owned validity window.

The repository-level GitHub Pages setting must remain disabled. A `public/CNAME` file and GitHub Pages deployment actions are prohibited because they can compete with the Cloudflare Pages production route. `npm run hosting:check` enforces this boundary in every test pass.

See [the control-plane architecture](./docs/architecture/free-tier-feed-control-plane.md) and [ADR-0001](./docs/architecture/decisions/0001-cloudflare-first-data-plane.md).

## Code and licensing

The repository is public so readers and contributors can inspect the site, evidence contracts, source-specific validation, tests and deployment configuration, raise traceable issues and follow material decisions. A public repository is an inspection and accountability route; it is not, by itself, a blanket permission to reuse the software.

This repository does not currently declare a project-wide open-source licence. The named publishers, government data, fonts and other third-party materials retain their own licence terms. Add an explicit project licence before describing the software as open source or granting broad reuse rights.

## Public evidence contract

Each supported section has a source-owned observation period, publication or release date, retrieval time, revision state and evidence class. A later technical check does not renew the age of unchanged evidence.

Public delivery is split deliberately:

- `/data/metrics-snapshot.json` is the current Cloudflare-published aggregate used by the application;
- `/data/health.json` reports whether the prepared runtime publication is ready or still bootstrapping;
- `/data/sections/<section>.json` and `.csv` are deterministic static distributions generated with the Pages build.

Evidence fails closed when currentness, completeness, provenance or the intended comparison cannot be proved. The public Worker does not expose collectors, editorial operations, Queue state or private KV records.

## Local development

Use the exact Node version in `.nvmrc` and npm version in `package.json`:

```bash
nvm use
npm run toolchain:check
npm ci
npm run dev
```

Open `http://localhost:3000`.

The project intentionally retains Node 20 type definitions while running on Node 24. This limits application code to the older, widely supported Node API surface while CI verifies the exact runtime and package-manager versions.

## Quality gates

```bash
npm run toolchain:check
npm run hosting:check
npm run lint
npm run test
npm run build:check
npm run test:e2e
```

Pull requests run governance, architecture, source-ownership, hosting-boundary, lint, unit/Worker and application-build checks. Browser and exhaustive production diagnostics are explicit checks. The named aggregate `quality` job is the branch-protection gate.

## Deployment

The repository contains two active workflows:

- **Pull Request Validation** — assurance only; never mutates Cloudflare.
- **Deploy public-data.org** — runs automatically after relevant changes reach `main` and deploys Worker then Pages in that order.

The production workflow creates or reconciles the `public-data-jobs` Queue before deploying the Worker, so a fresh Cloudflare account does not depend on an undocumented manual Queue step.

Required GitHub environment configuration:

- `cloudflare-internal-worker` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`;
- `cloudflare-pages` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The token must be restricted to the intended Cloudflare account and `public-data.org` zone while permitting Worker deployment, Worker routes, Queues, KV bindings and Pages deployment. Secret values must never be committed.

Operational checks and recovery are documented in [docs/manual-rollout-checklist.md](./docs/manual-rollout-checklist.md). Issue #257 remains the operational evidence record for consecutive scheduled runs and an exercised rollback; merge status alone is not treated as production proof.
