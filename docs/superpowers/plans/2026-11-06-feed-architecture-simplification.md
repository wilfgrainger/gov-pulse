# Feed Architecture Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision:** 6 Nov 2026, r4. r2 resolved Chief of Staff conditions M1–M12, r3 resolved the Round 2 conditions N1–N5 and the tracking items T-R2.1–T-R2.5, and r4 applies proportion ruling B (static-first moved to a follow-up plan) plus T-R3.1–T-R3.5, all in [`docs/architecture/feed-architecture-signoff-2026-11-06.md`](../../architecture/feed-architecture-signoff-2026-11-06.md). No task starts before owner gate **G0**.

## Summary for the owner

1. **Workstream 0** (Tasks 0.1–0.4) trims GitHub Actions without production effect. It keeps one `quality` job and full tests in every code lane. A build runs only when app-reachable code changes. There is one lockfile, Dependabot updates are grouped, and nothing is added to `main` deploys. You record baseline Actions minutes first (G-MIN).
2. Tasks 1–2 remove dead code and fix stale RSS/sitemap evidence, the one integrity defect that is live today.
3. Tasks 3–5 consolidate policy into one module and one derived route manifest. Characterization tests prove behaviour is unchanged.
4. Tasks 6–7 introduce `feeds/<id>/feed.js` and `parse.js` and derive every registry and route from them. After that, a new feed means 3 hand-edited files plus regenerated projections.
5. Task 8 measures collector CPU on the **existing** pipeline before any pipeline rewrite. Your hold or cost decision follows (G-CPU).
6. Tasks 9–12 shrink the data pipeline:
   - KV writes go from 39 to ≤16 per day, with dual-write and dual-read, and idempotency markers kept;
   - Queue message types go from 7 to 3;
   - the archive list costs 1 KV read;
   - health semantics change behind gate G5.
7. Task 17a retires the legacy KV keys and shims and records the move of source-membership ownership to `feeds/` (G4, G-AGENTS). Static-first delivery is **not in this plan**. It is in the follow-up plan [`2026-11-06-static-first-delivery.md`](2026-11-06-static-first-delivery.md), which is not executable until your G9 go/no-go. This plan stands on its own without it.
8. No task changes `config/publications.json`. Your gates in this plan: G0, G-MIN, G1 (never exercised), G-225, G-CPU, G4, G5, G6 (only if required checks change), G7, G-AGENTS.
9. The delegation column marks mechanical work for Haiku. Every Haiku task has a named Sonnet reviewer. Policy, pipeline and gate work is Opus.
10. "Ready to scale" (end of plan) is proven by a probe-feed test covering projections, routes, sitemap and downloads.

**Goal:** Reduce the feed and publication architecture to one feed definition per source, one policy module, one pipeline and minimal KV state, within the Cloudflare free tier and a small GitHub Actions footprint, with no weakening of evidence integrity.

**Architecture:** Strangler migration of the existing Workers/KV/Queue system:

- Declarative feed definitions project today's registries, parity-tested and then substituted.
- The data Worker collapses its state to per-feed records plus a single public artifact.
- Reader delivery is unchanged (OpenNext). Optional static-first delivery is the separate follow-up plan [`2026-11-06-static-first-delivery.md`](2026-11-06-static-first-delivery.md), designed in target §6 (conditional on G9).

**Tech Stack:** Node 24.17.0, npm 11.13.0, Next 16 / OpenNext, React 19, Vitest 4, Wrangler 4, Cloudflare Workers / KV / Queues (free tier).

**Spec:** [`docs/architecture/feed-architecture-target-2026-11-06.md`](../../architecture/feed-architecture-target-2026-11-06.md) and [`docs/architecture/feed-architecture-review-2026-11-06.md`](../../architecture/feed-architecture-review-2026-11-06.md), under [`docs/v1/MASTER-DELIVERY-PLAN.md`](../../v1/MASTER-DELIVERY-PLAN.md) (Wave 1 foundations; Wave 3 owns any activation).

## Global Constraints

- **Cloudflare free tier only:**
  - Workers: 100,000 requests/day and 10 ms CPU per HTTP/cron invocation;
  - KV: 1,000 writes and 100,000 reads per day account-wide, 1,024 B metadata;
  - Queues: 10,000 operations/day, 24 h retention;
  - Static-asset and Workers Builds limits apply only to the follow-up plan.

  No paid plan, D1, R2 or Durable Objects.
- **KV write budget.** Healthy daily run with the current 11 published families: **≤ 16 KV writes**. At 50 feeds: **≤ 60**. During the 7-day dual-write window: ≤ 50.
- **Evidence rules from `AGENTS.md` are unchanged:**
  - missing, stale, incomplete or unreconciled evidence is unavailable, never zero or interpolated;
  - held evidence is never served;
  - no synthetic totals;
  - observation, retrieval, publication and validity clocks stay separate;
  - older evidence is reused only within its original validity window.
- **Validity boundary:** `now >= validUntil` ⇒ unavailable. Unknown publication id ⇒ held.
- **Cache lifetime cap.** No config-filtered or evidence-bearing public response (HTML, `/data/*`, `/feed.xml`, `/sitemap.xml`) may have a total cacheable lifetime above 300 s.
  - Lifetime is `max(max-age, s-maxage)` + `stale-while-revalidate` + `stale-if-error`.
  - Hashed `/_next/static/*` assets carry no evidence and are exempt.
  - Today's violations are fixed by Task 2b, independent of G9: `/data/metrics-snapshot.json` stale-while-revalidate (live about 50,188 s), held-notice HTML `s-maxage=31536000`, and `/feed.xml` `max-age=3600`.
  - `cross_version_cache = false` isolates only the Workers cache, not browser or shared caches.
- **Publication states are never changed by any task.** `config/publications.json` states change only under the master plan's rule: "No publication switch changes without explicit user authorization after source-specific review".
- **PR #213 and #214:** do not merge #213, and do not merge #214 wholesale. Port ideas only through these tasks.
- **Required check and allow-list.** The required status check name stays exactly `quality`. Allowed actions stay `actions/checkout@*, actions/setup-node@*, actions/upload-artifact@*`.
- **No internals in public responses.** Never expose KV keys, Queue state, run ids or private diagnostics.
- **Per-task verification.** Every task passes `npm run lint && npx vitest run` on the exact head before push. Worker tasks also run `npx wrangler deploy --dry-run --outdir /tmp/wb --config worker/wrangler.toml`.

## Review Focus

Review Focus items 1–3 of r3, which covered static file gating, a hold during a failed rebuild and a stale build input, moved to the follow-up plan with their tasks.

1. **Collector fails on every retry after a verified record exists.** Expect: the prior record is served only until its own validity ends, and the run is marked `incomplete`, never `published`. Test: `feed records > failed attempt keeps prior evidence only within validity` (Task 9).
2. **Worker-only PR that changes a module imported by `app/`.** Expect: the Next build runs. Test: `pr lane > worker file imported by app selects app lane` (Task 0.1).
3. **A held-notice page or snapshot response stays in a browser or shared cache long after a hold or expiry.** Today `s-maxage=31536000` and `stale-while-revalidate` of about 48,000 s apply. Expect: total cache lifetime ≤ 300 s for every evidence-bearing or config-filtered response. Tests: `cache lifetime > snapshot total lifetime never exceeds 300 s` and `release smoke > fails when any evidence or held HTML response lifetime exceeds 300 s` (Task 2b).

---

## Ordering, dependencies and delegation

| Task | Title | Depends on | Ships to prod? | Delegate (reviewer) | Gate |
|---|---|---|---|---|---|
| — | Approve this package | — | — | owner | **G0** |
| — | Baseline Actions minutes | G0 | — | owner | **G-MIN** |
| 0.1 | Single `quality` job; safe lanes | G-MIN | CI only | Sonnet (Opus review) | G6 only if ruleset must change |
| 0.2 | One lockfile / one OpenNext version | — | build only | Haiku (Sonnet review) | — |
| 0.3 | Deploy: single install, no added suites | 0.2 | deploy pipeline | Haiku (Sonnet review) | — |
| 0.4 | Dependabot, retention, stale workflows | — | CI only | Haiku (Sonnet review) | G7 |
| 1 | Delete verified dead code and vars | — | no-op | Haiku (Sonnet review) | — |
| 2 | Untrack generated snapshot; current-only RSS/sitemap | — | RSS/sitemap content | Sonnet | — |
| 2b | Cap public cache lifetimes at 300 s (snapshot SWR, held HTML, feed) | — | response headers | Sonnet | — |
| 3 | `contracts/evidence-policy.js` + characterization | — | no-op | **Opus** | — |
| 4 | Rewire policy call sites | 3 | no-op | Sonnet; mechanical edits Haiku (Sonnet review) | — |
| 5 | Derived route manifest + `gateRoute` | 3, 6 | no-op | Sonnet | — |
| 6 | Feed schema, projections, `realWages` | 3 | no-op | **Opus** | — |
| 7 | Move remaining 16 feeds; `_kit` dedupe | 6 | no-op | Haiku moves/fixtures; **Sonnet** decides any merge of helpers with differing bodies | — |
| 8 | Measure collector and finaliser CPU on existing pipeline | — (can start after G0) | none (ops) | Haiku capture (Opus judgement) | **G-CPU** |
| 9 | Per-feed KV records, dual-write and dual-read | 6, 8, G-225, G-CPU | KV writes | **Opus** | **G-225** |
| 10 | Pipeline: 3 message types, shards, DLQ, minimal writes | 9 | pipeline | **Opus** | **G4** (stop legacy writes) |
| 11 | Archive: index-only list, short-TTL ETag detail, paginated `/editions/` | 9 | API/UI | Sonnet | — |
| 12 | Health contract: required ∩ published, `held[]` | 10 | public contract | Sonnet | **G5** |
| → | Static-first delivery (Tasks 13–16, 17b) | — | — | — | **follow-up plan** [`2026-11-06-static-first-delivery.md`](2026-11-06-static-first-delivery.md); not executable until **G9** |
| 17a | Retire legacy KV keys and shims; AGENTS.md ownership update | 10 + 14 days, 4 | cleanup | Haiku deletes/docs (Opus review) | **G4**, **G-AGENTS** |
| 18 | Ready-to-scale probe feed across every layer | 5, 7, 10 | no-op (test) | Sonnet | — |

Task 10 is the largest. If its diff exceeds one reviewable PR (about 800 changed lines), split it at its natural seams: pipeline and message types, then health metadata, then the legacy-write stop (G4). Each split keeps its own tests. The follow-up plan has the same note for its Task 16.

Parallelism:

- Workstream 0 tasks, Tasks 1, 2, 2b and Task 8 are mutually independent.
- Task 18 is last: it depends on Tasks 5, 7 and 10.
- After Task 3, Tasks 4 and 6 run in parallel. Task 5 follows Task 6.
- Task 7 runs in parallel per feed batch, one worktree per batch.

### Owner decision gates

- **G0** — Approve this package after the Chief of Staff re-check.
- **G-MIN** — Before Task 0.1:
  - record Actions minutes and job counts for the last 30 days from Settings → Billing → Usage (or the repository Actions usage page) in `docs/operations/deployment-ci-frugality.md`;
  - repeat 14 days after Task 0.4.

  The session API could not read them.
- **G1** — Any change to `config/publications.json`. Never part of this plan.
- G2, G3, G8, G9 and G-DNS belong to the follow-up plan [`2026-11-06-static-first-delivery.md`](2026-11-06-static-first-delivery.md).
- **G4** — Stop writing `v12/v13/v14` keys (Task 10) and later delete them (Task 17a).
- **G5** — Public health contract change (Task 12).
- **G6** — Branch ruleset, only if the required check list must change. The plan keeps `quality`.
- **G7** — Repository settings:
  - Dependabot;
  - disable the stale "Evidence Source Probe" and "NHS Source Probe" workflows.
- **G-225** — Decide PR #225, the current run/commit protocol, before Task 9.
- **G-CPU** — Hold or cost decision for any feed over the Free consumer CPU limit (Task 8). No paid executor without approval of its cost.
- **G-AGENTS** — Approve the text of any `AGENTS.md` change (Task 17a).

---

## Workstream 0 — low-risk wins (GitHub Actions footprint)

One job named `quality` classifies and runs its lane in one runner.

| Lane | Selected when | Runs |
|---|---|---|
| `docs` | every changed file is `*.md`/`*.markdown`, README/LICENSE/SECURITY/CONTRIBUTING or the PR template | checkout + classify only |
| `worker` | every changed file is in `worker/**/*.js` (not `*.toml`), `feeds/**` or `tests/worker/**`, **and** no changed `worker/`/`feeds/` file is in `appImportClosure()` | 1 `npm ci`, guards, lint, **full** `vitest run`; no Next build |
| `app` | changes are within `app/**`, `tests/unit/**`, `public/**`, or worker/feeds files that *are* in `appImportClosure()` | 1 `npm ci`, guards, lint, full `vitest run`, OpenNext build |
| `full` | anything else; **always** for `package*.json`, `config/**`, `contracts/**`, `.github/**`, `scripts/**`, `next.config.*`, `vitest.config.ts`, `tests/fixtures/**`, `worker/*.toml`, `worker/open-next.config.template` | same as `app` |

- **Why no `vitest --changed`:** 27 test files read the source tree with `node:fs`, e.g. `source-ownership`, `workflow-actions-allow-list`, `legacy-ingestion-retirement`, `cloudflare-edge-cache-config`, `feed-registry`. The import graph cannot see their dependencies, so affected-only selection is unsafe. The savings come from a single job, a single install, no build in the worker lane, no install for docs, and deferred drafts.
- **App imports of `worker/`** today: `@/worker/publication-currentness` (5 imports), `@/worker/public-snapshot` (3) and `@/worker/feed-registry` (3). Their transitive closure decides the lane.
- **Draft PRs** run only the classification and report success. `ready_for_review` re-runs the real lane before merge.
- **`deploy.yml` keeps its documented behaviour** (`docs/operations/deployment-ci-frugality.md`): lint and tests run only on `workflow_dispatch`. No suite is added to `main` pushes; the PR `quality` gate is the merge guard.

### Task 0.1: Single `quality` job with safe lanes

**Files:**
- Modify: `.github/workflows/pr-validation.yml`, `scripts/lib/pr-validation-lane.mjs`, `scripts/classify-pr-validation.mjs`
- Create: `scripts/lib/app-import-closure.mjs`
- Test: `tests/unit/prValidationLane.test.ts`, `tests/unit/workflow-actions-allow-list.test.ts`

**Interfaces (Produces):**
- `appImportClosure(root?: string): Set<string>`. Repo-relative paths of every `worker/`, `feeds/` and `contracts/` file reachable from `app/**/*.{ts,tsx}` via `@/` or relative import specifiers, found by regex scan and followed transitively.
- `validationLane(files: string[], closure?: Set<string>): "docs" | "worker" | "app" | "full"`.

- [ ] **Step 1: Write failing tests:**
  - `pr lane > markdown only selects docs`.
  - `pr lane > worker js not imported by app selects worker`: `["worker/live-betting-collector.js"]` with the real closure → `"worker"`.
  - `pr lane > worker file imported by app selects app lane`: `["worker/publication-currentness.js"]` → `"app"`.
  - `app import closure > includes publication-currentness, public-snapshot and feed-registry`.
  - `pr lane > lockfile and contracts select full lane`: each of `package-lock.json`, `contracts/measure-definitions.json`, `config/publications.json`, `worker/wrangler.toml` → `"full"`.
  - `pr lane > mixed docs and code never selects docs`.
  - `pr lane > empty list selects full`.
  - `workflow > pr-validation defines exactly one job named quality`: `jobs` keys equal `["quality"]`; `pull_request.types` ⊇ `["opened","synchronize","reopened","ready_for_review"]`; `branches == ["main"]`; `concurrency.cancel-in-progress: true`; the workflow text contains no `--changed`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/prValidationLane.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the lane table as ordered rules, where a full-lane match wins. Rewrite the workflow as one job (`timeout-minutes: 15`):
  - docs lane and draft PRs stop after classification;
  - one `npm ci`;
  - full `npx vitest run` for code lanes;
  - the build only for `app`/`full`.

  Remove `codex/hermes-v1`.
- [ ] **Step 4: Run** `npx vitest run tests/unit/prValidationLane.test.ts tests/unit/workflow-actions-allow-list.test.ts`. Expected: PASS.
- [ ] **Step 5: Verify on the PR** that exactly one check run named `quality` appears and that its job count is 1. Record runner seconds in the PR body.
- [ ] **Step 6: Commit** `ci: run PR quality in one lane-aware job`.

### Task 0.2: One lockfile and one OpenNext version

**Files:**
- Delete: `worker/package.json`, `worker/package-lock.json`
- Modify: `package.json` (pin `"@opennextjs/cloudflare": "1.20.7"` exactly), `package-lock.json`
- Modify: `.github/workflows/pr-validation.yml` and `.github/workflows/deploy.yml:66-67,88-101` (remove the second `npm ci` and the symlink staging)
- Modify: `scripts/check-toolchain.mjs`
- Test: `tests/unit/toolchain.test.ts`

- [ ] **Step 1: Write failing test** `toolchain > single lockfile and exact opennext pin`: `worker/package-lock.json` does not exist, and the root devDependency matches `/^\d+\.\d+\.\d+$/`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/toolchain.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Run `npm install --save-dev --save-exact @opennextjs/cloudflare@1.20.7`. The build command becomes `npx opennextjs-cloudflare build --config worker/web-wrangler.toml`. No reason for the old `1.20.2` pin was recorded, so the full build in Step 4 is mandatory.
- [ ] **Step 4: Run** `npx vitest run && npx opennextjs-cloudflare build --config worker/web-wrangler.toml`. Expected: PASS, and `.open-next/worker.js` exists.
- [ ] **Step 5: Sonnet review, then commit** `build: use a single lockfile and one pinned OpenNext toolchain`.

### Task 0.3: Deploy uses one install and adds no suites

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Test: `tests/unit/workflow-deploy.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `deploy workflow > installs dependencies once`: exactly one `npm ci`.
  - `deploy workflow > lint and tests remain dispatch-only`: the step containing `npm run test` has `if: github.event_name == 'workflow_dispatch'`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/workflow-deploy.test.ts`. Expected: FAIL on the first test.
- [ ] **Step 3: Implement** the removal of the second install only.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Sonnet review** of the release-critical `deploy.yml` diff, then commit `ci: single install for production deploy`.

### Task 0.4: Dependabot, retention and stale workflows

**Files:**
- Create: `.github/dependabot.yml`
- Modify: `.github/workflows/lighthouse.yml` (`retention-days: 7`)
- Test: `tests/unit/dependabot-config.test.ts`

- [ ] **Step 1: Write failing test** `dependabot > npm and actions are monthly, grouped and limited`:
  - `npm` (`/`) and `github-actions` entries;
  - each with `schedule.interval: "monthly"` and `open-pull-requests-limit: 2`;
  - a `groups` entry with `update-types: ["minor","patch"]`.

  Also assert lighthouse `retention-days: 7`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/dependabot-config.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Security updates stay ungrouped.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Owner action G7.** Disable the two stale registered workflows. Then **G-MIN follow-up** 14 days later.
- [ ] **Step 6: Sonnet review, then commit** `ci: group and limit dependabot updates; shorten report retention`.

---

## Workstream 1 — integrity and dead code

### Task 1: Delete verified dead code and unused vars

**Files:**
- Delete: `createEconomySectionCache`, `MANAGED_SECTIONS` and `isFreshEconomyRecord` from `worker/economy-section-cache.js`. Move `isOfficialEconomyRecord` into `worker/section-builders.js` and delete the file.
- Delete: `worker/health-report.js`, `app/components/WithdrawnEvidence.tsx`.
- Delete scripts: `ensure-cloudflare-pages-domain.mjs`, `fetch-betting-odds.mjs`, `prepare-election-poll-ingest.mjs`, `verify-uk-context-route.mjs`.
- Delete tests that only covered the removed code: `tests/worker/economy-section-cache.test.ts`, `tests/worker/health-report.test.ts`.
- Modify: `worker/wrangler.toml:19-21` (drop `ENVIRONMENT`, `DATA_REFRESH_TTL_SECONDS`, `DATA_STALE_TTL_SECONDS`) and the comment in `app/lib/usePublicationHealth.ts`.
- Keep: `scripts/prepare-nhs-rtt-ingest.mjs` and `scripts/nhs-rtt-parser.mjs` (NHS retrieval path undecided, master plan Wave 3).
- Test: `tests/unit/dead-code.test.ts`

- [ ] **Step 1: Write failing test** `dead code > removed modules stay removed`: the deleted paths are absent, and a text scan of `worker/`, `app/` and `scripts/` finds no `createEconomySectionCache|readManifest|v10:manifest|v10:section:`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/dead-code.test.ts`. Expected: FAIL.
- [ ] **Step 3: Delete** the files.
- [ ] **Step 4: Run** `npm run lint && npx vitest run && npx wrangler deploy --dry-run --outdir /tmp/wb --config worker/wrangler.toml`. Expected: PASS.
- [ ] **Step 5: Sonnet review, then commit** `chore: remove runtime-unused modules, scripts and Worker vars`.

### Task 2: Untrack the generated snapshot; RSS and sitemap carry only current evidence

**Files:**
- Delete from git: `app/generated/metricsSnapshot.ts`, and add `app/generated/` to `.gitignore`.
- Create: `tests/fixtures/publication/current-snapshot.json` (sanitized public artifact, `meta.fixture: true`).
- Modify `scripts/generate-build-snapshot-module.mjs`. Input order:
  - the `--input` path;
  - else fetch `https://public-data.org/data/metrics-snapshot.json` with a 10 s timeout;
  - else export `null`.

  Never reuse a previous output.
- Modify `app/lib/discovery.ts:58-70`: `getBuildPublication` requires `evaluate(...)` current at build time, with Task 3's module if it has landed, else `sectionCurrentness`.
- Modify `app/lib/rssFeed.ts`, `app/sitemap.ts` and `app/lib/serverMetricsSnapshot.ts`; the dev branch reads the fixture.
- Test: `tests/unit/rssFeed.test.ts`, `tests/unit/build-snapshot-module.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `rss > omits a dataset whose validity ended before build time`: polling `expiresAt: "2026-09-30"`, `now = 2026-11-06` ⇒ no `election-polls`.
  - `rss > renders no dataset items when snapshot is null`.
  - `build snapshot module > writes null export when input missing and fetch fails`.
  - `build snapshot module > is not tracked by git`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/rssFeed.test.ts tests/unit/build-snapshot-module.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - `getBuildPublication(section, rawSnapshot, now = new Date())`;
  - `generate({ input?: string, fetchImpl?: typeof fetch, now: Date }): Promise<{ wrote: "artifact" | "null" }>`.
- [ ] **Step 4: Run** `npx vitest run && npm run build:prepare && npx opennextjs-cloudflare build --config worker/web-wrangler.toml`. Expected: PASS.
- [ ] **Step 5: After the requested release,** `curl -s https://public-data.org/feed.xml | grep -c "2026-09-27"` returns `0`.
- [ ] **Step 6: Commit** `fix: build RSS and sitemap only from current committed evidence`.

---

### Task 2b: Cap public cache lifetimes at 300 s (independent of G9)

**Files:**
- Modify: `worker/public-data-entry.js:48-54` `cacheControlFor`
  - `fresh = min(remaining, maxFreshSeconds)`;
  - `stale-while-revalidate = max(0, min(remaining, 300) - fresh)`;
  - `no-store` when `remaining <= 0`.
- Modify: `app/feed.xml/route.ts:11` (`public, max-age=300`).
- Modify: `next.config.ts`. Set `expireTime: 300`, which bounds Next's stale-while-revalidate. The prerendered held and static pages (`/section/[id]`, `/stories/[slug]`, `/sources`) get `export const revalidate = 300`, so OpenNext no longer emits `s-maxage=31536000`.
  - That this OpenNext mapping holds is *unverified* until Step 4.
  - If it does not hold, those routes become dynamic under `gateRoute`. A short SSR is preferable to a year-long cached held notice.
- Modify: `scripts/release-smoke.mjs` (header-lifetime assertion).
- Test: `tests/worker/cache-lifetime.test.ts`, `tests/unit/release-smoke.test.mjs`

**Interfaces (Produces):** `cacheLifetimeSeconds(cacheControl: string): number` in `scripts/lib/cache-lifetime.mjs`. It returns max(max-age, s-maxage) + stale-while-revalidate + stale-if-error, `0` for `no-store`, and `Infinity` when the header is unparseable.

- [ ] **Step 1: Write failing tests:**
  - `cache lifetime > snapshot total lifetime never exceeds 300 s` for remaining validity 10 s, 300 s and 86,400 s.
  - `cache lifetime > expired snapshot is no-store`.
  - `cache lifetime > feed.xml lifetime is at most 300 s`.
  - `release smoke > fails when any evidence or held HTML response lifetime exceeds 300 s`, run against recorded headers including today's `s-maxage=31536000, stale-while-revalidate=2592000`.
- [ ] **Step 2: Run** `npx vitest run tests/worker/cache-lifetime.test.ts tests/unit/release-smoke.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite and the OpenNext build. Inspect `.open-next` prerender metadata or `wrangler dev` headers for `/section/nhs/`. Expected: lifetime ≤ 300.
- [ ] **Step 5: After the requested release,** `curl -sI https://public-data.org/section/nhs/ https://public-data.org/data/metrics-snapshot.json https://public-data.org/feed.xml` all show lifetime ≤ 300.
- [ ] **Step 5b: Record the request cost (T-R3.5).** Capping stale-while-revalidate means shared caches revalidate `/data/metrics-snapshot.json` against the data Worker at most every 300 s per cache, instead of serving stale for up to about 14 h. Each revalidation is a Worker request (cache hits are billed as requests) and, on a Workers-cache miss, 1 KV read. Record `pulse-data-worker` requests/day and KV reads/day from Cloudflare analytics for 3 days before and 3 days after release in `docs/operations/free-resource-budget.md`. If requests rise by more than 10% of the 100k/day account allowance, return to the owner.
- [ ] **Step 6: Commit** `fix: cap public evidence and held-notice cache lifetimes at 300 seconds`.

## Workstream 2 — one policy module, one route manifest

### Task 3: `contracts/evidence-policy.js` with characterization parity

**Files:**
- Create: `contracts/evidence-policy.js`, `tests/worker/evidence-policy.test.ts`, `tests/worker/evidence-policy-parity.test.ts`

**Interfaces (Produces), identical to target §3:**
```ts
export type Decision = "published" | "held" | "retired";
export type UnavailableReason = "held" | "no-record" | "shape" | "retrieval-expired" | "observation-expired" | "clock-skew" | "not-current";
export type Verdict = { state: "current" | "unavailable" | "held"; reason: UnavailableReason | null; validUntil: string | null };
export type FeedPolicyInput = { id: string; requirement: "required" | "optional" | "independent";
  validity: { retrievalMaxAgeMs: number; observationMaxAgeDays?: number; observationMaxAgeHours?: number; explicitExpiry?: boolean } };
export type RouteEntry = { path: string; kind: "static" | "evidence" | "api"; feeds: string[]; gate: "none" | "any-published" | "all-of" | "product" };
export function decisionFor(feedId: string, config?: object): Decision;                       // unknown → "held"
export function evaluate(feed: FeedPolicyInput, record: SectionRecord | null, decision: Decision, now: Date): Verdict;
// SectionRecord = inner verified section record, NOT the Task 9 FeedRecord wrapper; callers pass feedRecord?.record ?? null
export function projectPublic(edition: object, now: Date, config?: object): { snapshot: object | null; validUntil: string | null };
export function routeAccess(route: RouteEntry, now: Date, verdicts: Record<string, Verdict>): "serve" | "unavailable" | "not-found";
```

Duplicates to collapse, from the review's verified line references in `worker/publication-currentness.js`:

- the validity-deadline computation repeated in `sectionValidityDeadline` (`:195-228`) and `sectionPresenceDeadline` (`:234-248`), and inside `sectionCurrentness` (`:124-131`);
- the `maxAgeDays`/`maxAgeHours` conversion at `:164-169` and `:213-219`;
- the sentiment measure ids `["inflation","bankRate","unemployment"]` hard-coded at `:45` and `:348`.

- [ ] **Step 1: Write failing tests** in `evidence-policy.test.ts`:
  - `evidence policy > unknown feed id is held`.
  - `evidence policy > held wins over a current record`.
  - `evidence policy > now equal to validUntil is unavailable`.
  - `evidence policy > missing record is unavailable not zero`: reason `no-record`, no `value` field.
  - `evidence policy > older retrieval within its validity stays current`.
  - `evidence policy > clock skew beyond MAX_CLOCK_SKEW_MS is unavailable`.
  - `evidence policy > projectPublic returns null snapshot when nothing is current`.
- [ ] **Step 2: Write parity tests.** For every snapshot fixture under `tests/fixtures/**`, each section, and `now` ∈ `[fetchedAt+1h, validUntil-1ms, validUntil, validUntil+1d]`:
  - `evaluate(...).state === "current"` ⇔ `currentSectionRecord(record, now)`;
  - `projectPublic(x, now).snapshot` deep-equals `filterPublicationSnapshot(filterCurrentSnapshot(x, now))`, or both are null.
- [ ] **Step 3: Run** `npx vitest run tests/worker/evidence-policy*.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement.** Move the logic out of `worker/publication-currentness.js`, the validity parts of `worker/observation-contract.js` and the decisions in `contracts/publication-policy.js`. The old modules re-export from it.
- [ ] **Step 5: Run** `npx vitest run`. Expected: PASS for the full suite.
- [ ] **Step 6: Commit** `refactor: introduce one evidence policy module with parity proof`.

### Task 4: Rewire every policy call site

**Files (modify):**
- `app/lib/serverMetricsSnapshot.ts` (`:21-24` and `:34-37` are identical branches; merge them), `app/lib/metricsSnapshot.ts:110,146`, `app/lib/useMetrics.ts:191,214-215,235`, `app/lib/dataExplorer.ts:78,89`, `app/data/sections/[file]/route.ts:23`, `app/section/[id]/page.tsx:87-90`, `app/cost-of-living/page.tsx:15` (hard-coded `["sentimentPulse","housePriceIndex","realWages"]`)
- `worker/public-data-entry.js:100,112,213,278`, `worker/publication-publisher.js`, `worker/public-snapshot.js`, `worker/publication-recovery.js`
- `scripts/verify-production.mjs:239`, `scripts/snapshot-canary.mjs:59`, `scripts/generate-section-downloads.mjs`
- Delete: `worker/freshness-policy.js`. `worker/publication-currentness.js` becomes re-exports only (deleted in Task 17a).
- Test: `tests/unit/policy-single-owner.test.ts`

- [ ] **Step 1: Write failing test** `policy > only evidence-policy defines currentness`: a source scan finds:
  - no definitions of `filterCurrentSnapshot|currentSectionRecord|sectionValidityDeadline` outside `contracts/evidence-policy.js`;
  - no literal `status !== "ok"`/`cacheState !== "fresh"` in `app/lib`;
  - no hard-coded section arrays in `app/cost-of-living/page.tsx`;
  - `policy > no module imports worker/publication-currentness`: no `app/`, `worker/`, `scripts/` or `contracts/` file imports it. Today `app/` has 5 such imports. They are rewired to `@/contracts/evidence-policy` here, so Task 17a can delete the shim.
- [ ] **Step 2: Run** `npx vitest run tests/unit/policy-single-owner.test.ts`. Expected: FAIL listing call sites.
- [ ] **Step 3: Replace** the calls one directory per commit: worker, app, scripts.
- [ ] **Step 4: Run** `npm run lint && npx vitest run && npx opennextjs-cloudflare build --config worker/web-wrangler.toml`. Expected: PASS.
- [ ] **Step 5: Sonnet review, then commit** (×3) `refactor: route <dir> currentness through evidence-policy`.

### Task 5: Derived route manifest and a single page gate

**Files:**
- Create: `contracts/routes.json` (non-feed routes only), `app/lib/gateRoute.ts`, `tests/unit/route-manifest.test.ts`
- Modify: `feeds/registry.js` (add `routeManifest()`); the 13 data pages and route handlers listed in review F5; `contracts/publication-policy.js` (remove the `publicationEnabled` alias at `:57-59`, `publicationRouteEnabled`, and the duplicate story map at `:185-189`)

**Interfaces:**
- Consumes: `FEEDS` (Task 6), `routeAccess` and `RouteEntry` (Task 3).
- Produces:
  - `routeManifest(): RouteEntry[]`, merging `contracts/routes.json` with per-feed entries `/section/<slug>/` and `/data/sections/<slug>.{json,csv}` derived from `FEEDS`;
  - `gateRoute(path: string, now?: Date): { access: "serve" | "unavailable" | "not-found"; heldFeeds: string[] }`.

- [ ] **Step 1: Write failing tests:**
  - `route manifest > every app route file has a manifest entry`: glob `app/**/{page.tsx,route.ts}`, `app/sitemap.ts`, `app/robots.ts` against `routeManifest()`.
  - `route manifest > section routes are derived from FEEDS`: every `FEEDS` slug yields `/section/<slug>/` with `feeds:[id]`, and `routes.json` contains no `/section/` entry.
  - `gateRoute > held-only evidence route is unavailable not 404`.
  - `gateRoute > unknown path is not-found`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/route-manifest.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Pages call `gateRoute` once. `unavailable` renders `<PublicationOffline heldFeeds>`, with copy naming the held publication, not "data publications are offline" unless nothing is published (review F11).
- [ ] **Step 4: Run** the full suite and the build. Expected: PASS.
- [ ] **Step 5: Commit** `refactor: gate every route through one derived manifest`.

---

## Workstream 3 — declarative feeds

### Task 6: Feed definition schema, projections and the first feed (`realWages`)

**Files:**
- Create:
  - `feeds/index.js`, `feeds/define-feed.js`, `feeds/registry.js`
  - `feeds/real-wages/{feed.js,parse.js,fixtures/}` (`parse.js` moved from `worker/real-wages.js`)
  - `feeds/_kit/{fetch.js,html.js,csv.js,dates.js,ons-bulletin.js}`
  - `scripts/generate-feed-projections.mjs`
- Modify: `contracts/source-catalog.js:525` (the `realWages` entry comes from the projection), `worker/publication-plan.js:11`, `worker/observation-contract.js:161`, `worker/section-builders.js`, `app/lib/sectionDownloads.ts`, `app/lib/sectionContent.ts` (metadata only); regenerated `contracts/section-discovery.json` and `contracts/measure-definitions.json`
- Test: `tests/worker/feed-registry-projection.test.ts`, `tests/worker/feeds/real-wages.test.ts`

**Interfaces (Produces):**
```ts
export function defineFeed(def: FeedDefinition): Readonly<FeedDefinition>;   // throws on schema violation (target §2.2)
export const FEEDS: readonly FeedModule[];   // FeedModule = { definition, collect, collectShard?, combine? }
export function feedCatalog(): Record<string, object>;
export function collectionPlan(): Record<string, { jobType: string; collector: string }>;
export function observationContracts(): Record<string, object>;
export function sectionDiscovery(): Record<string, object>;
export function downloadIds(): string[];
export function releaseFamilies(): Array<{ feedId: string; pattern: RegExp }>;
export function measureDefinitions(): object[];
export function routeManifest(): RouteEntry[];   // completed in Task 5
```

- [ ] **Step 1: Capture** `tests/fixtures/registry/legacy-projections.json` with `node scripts/generate-feed-projections.mjs --capture-legacy` (Haiku). Commit it first.
- [ ] **Step 2: Write failing tests:**
  - `feed index > lists every feeds/* folder`.
  - `defineFeed > rejects missing validity`, `> rejects slug not kebab`, `> rejects source id not in SOURCE_CATALOG`.
  - `projection > realWages catalog entry equals legacy FEED_CATALOG.realWages`, and the same deep-equal parity for `collectionPlan`, `observationContracts` (compare `maxAgeDays` and the extractor name), `sectionDiscovery["real-wages"]` and `measureDefinitions` for `realWages`.
  - `real-wages parse > collect parses captured bulletin fixture`.
- [ ] **Step 3: Run** `npx vitest run tests/worker/feed-registry-projection.test.ts tests/worker/feeds`. Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** `npx vitest run && node scripts/generate-feed-projections.mjs --check`. Expected: PASS, "no drift".
- [ ] **Step 6: Commit** `feat: declarative feed definitions with parity-proven projections (realWages)`.

### Task 7: Move the remaining feeds and dedupe helpers

**Files:**
- For each feed (`gdpTracker`, `sentimentPulse`, `employmentStats`, `taxRevenue`, `nationalDebt`, `migrationStats`, `housePriceIndex`, `crimeStatistics`, `electionPolling`, `nhsStats`, `bettingOdds`, `releaseCalendar`, `nhsReleaseCalendar`, `governmentContracts`, `internationalComparison`, `earlyYears` with `automation: "static"`), create `feeds/<slug>/{feed.js,parse.js,fixtures/}`.
- Delete each old collector module after its parity passes. After the last feed, delete:
  - `worker/section-builders.js`, `worker/live-feed-collectors.js`, `worker/observation-contract.js`, `worker/publication-plan.js`;
  - shims `worker/betting-markets.js` and `worker/crime-statistics.js`.

  The hand sections of `contracts/section-discovery.json` and `contracts/measure-definitions.json` become generated.
- `taxRevenue`'s special `tax-revenue-live` branch becomes an ordinary `collect`. `governmentContracts` and `internationalComparison` declare `shards`.
- Test: `tests/worker/feeds/<slug>.test.ts`, `tests/worker/feed-registry-projection.test.ts`, `tests/worker/bundle-size.test.ts`

- [ ] **Step 1 (per batch):** extend parity with the batch ids. Run: FAIL.
- [ ] **Step 2 (Haiku):** move the module and fixtures, and replace **byte-identical** helpers with `_kit` imports.
- [ ] **Step 3 (Sonnet decides):** helpers whose bodies differ, e.g. `decodeHtml` in `national-debt.js` vs `economy-evidence.js`, or the two zip readers in `live-nhs-collector.js` and `xlsx-workbook.js`. Merge only after a fixture test pins each original's output on its own inputs. Otherwise keep a feed-local helper.
- [ ] **Step 4:** run `npx vitest run tests/worker && node scripts/generate-feed-projections.mjs --check`. Then check bundle size: `bundle size > data worker bundle under 80% of Free script limit`, reading `/tmp/wb` from the dry-run. Expected: PASS.
- [ ] **Step 5:** commit per batch, `refactor: move <feeds> into declarative feed folders`.
- [ ] **Step 5b: Rewire every `worker/feed-registry.js` importer (T-R4.2).** This is mechanical (Haiku, Sonnet review), done after the last batch.
  - App: `app/sources/[id]/page.tsx:15` (`FEED_REGISTRY`, `PUBLICATION_SOURCE_REGISTRY`), `app/lib/metricsSnapshot.ts:2` (`FEED_REGISTRY_VERSION`) and `app/lib/measureAvailability.ts:3` (`provenanceFor`) now import from `@/feeds/registry`.
  - The 12 worker importers listed in the review (fan-in of `feed-registry.js`) and any scripts are rewired the same way.
  - `feeds/registry.js` exports those four names with unchanged shapes, proven by the Task 6 parity fixture.
  - Guard test `feed registry > no module imports worker/feed-registry`: a source scan of `app/`, `worker/`, `scripts/` and `contracts/`, excluding the shim itself.
  - `worker/feed-registry.js` stays as a pure re-export until Task 17a deletes it.
  - Run `npm run lint && npx vitest run && npx opennextjs-cloudflare build --config worker/web-wrangler.toml`. Expected: PASS.
  - Commit `refactor: import feed registry projections from feeds/`.
- [ ] **Step 6 (final):** test `feed sprawl > a new feed needs only its folder and one index line`. It uses only Task 6 projections and Task 3 policy. In a temp copy, add probe feed `feeds/__probe/` plus one index line, run projections, and assert:
  - the feed appears in `feedCatalog()`, `collectionPlan()`, `downloadIds()`, `releaseFamilies()` and `sectionDiscovery()`;
  - `decisionFor("__probe") === "held"`;
  - the git diff of hand-edited files is exactly 3 paths, plus files written by `generate-feed-projections.mjs`.

  Route, schedule and build assertions are in Task 18. Commit `test: prove single-folder feed registration`.

---

## Workstream 4 — one pipeline, minimal state

### Task 8: Measure collector and finaliser CPU on the existing pipeline

Runs **before** Tasks 9–10.

**Files:**
- Create: `scripts/measure-collector-cost.mjs` (runs each existing collector against its fixtures under `node --cpu-prof`; **indicative only**, because Node CPU is not Workers CPU)
- Modify: `docs/operations/free-resource-budget.md`. Add the results table, and also fix its drift: 11 published sources, 12 Queue deliveries/day, and edition detail is `no-store`, not immutable.

- [ ] **Step 1 (Haiku):** `node scripts/measure-collector-cost.mjs --all > /tmp/cost.txt`. Expected: one line per feed, `feedId cpuMs bytes`.
- [ ] **Step 2 (owner runs, token stays local):** during the next scheduled daily run on the **current** pipeline, `npx wrangler tail pulse-data-worker --format json > tail.json`. Record `cpuTime` and wall time per message type and section, including `finalise-run`.
- [ ] **Step 3 (Opus):** compare against the Free consumer CPU limit, recording whether it was verified. List any over-limit feed for **G-CPU**. Retries are never a substitute. Record the measured p95 job durations; Task 10 uses them.
- [ ] **Step 4: Commit** `docs: record measured collector cost per feed`.

### Task 9: Per-feed KV records with dual-write and dual-read

**Files:**
- Create: `worker/feed-store.js`, `tests/worker/feed-store.test.ts`
- Modify: `worker/publication-collection-runner.js` (writes `v20:feed:<id>`, plus the old fragment and terminal keys during the dual window), `worker/publication-publisher.js` (reads `v20:feed:*` first, falls back to v12/v13, logs divergence)

**Interfaces (Produces):**
```ts
export const FEED_KEY_PREFIX = "v20:feed:";
export type FeedRecord = { feedId: string; record: SectionRecord | null;
  lastAttempt: { runId: string; at: string; status: "success" | "failure"; reason: string | null } };
export async function readFeedRecord(env, feedId: string): Promise<FeedRecord | null>;
export async function writeFeedAttempt(env, feedId: string, runId: string,
  outcome: { record?: SectionRecord; error?: Error }, now: Date): Promise<"written" | "kept-newer">;
// exactly 1 KV put per call; record replaced only if newer verified (existing storedFragmentWins rule)
```

- [ ] **Step 1: Write failing tests:**
  - `feed records > success writes exactly one put`.
  - `feed records > failed attempt keeps prior evidence only within validity`.
  - `feed records > older retrieval never replaces newer`.
  - `publisher > dual read prefers v20 and matches legacy output`.
  - `kv budget > dual-write healthy run writes at most 50`.
- [ ] **Step 2: Run** `npx vitest run tests/worker/feed-store.test.ts tests/worker/cloudflare-publication.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Dual-write for at least 7 production days. Record the daily divergence logs and the dual-write KV count in `free-resource-budget.md`.
- [ ] **Step 4: Run** the full suite and the dry-run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: per-feed KV records with dual-write and dual-read`.

### Task 10: Three Queue message types, shards, DLQ and minimal writes (G4)

**Files:**
- Create: `worker/pipeline.js`
- Delete:
  - `worker/publication-queue-dispatcher.js`, `publication-job-runner.js`, `publication-comparison-runner.js`;
  - the re-exports in `queued-publication-entry.js`.

  Stop writing the terminal, run-fragment, global-fragment, `v12:publication:current` and `status` keys after G4.
- Modify: `worker/publication-run-lifecycle.js` (keep `createRun`, `enqueuePublicationRun`, `finaliseRun` lease and idempotency semantics on `v20:run:*`), `worker/public-data-entry.js` (`scheduled`/`queue` → `pipeline.js`), `worker/wrangler.toml` (`dead_letter_queue = "public-data-jobs-dlq"`), `scripts/bootstrap-cloudflare-publication.mjs`, `worker/public-snapshot.js`
- Test: `tests/worker/pipeline.test.ts`, `tests/worker/kv-write-budget.test.ts`, `tests/worker/health-metadata.test.ts`

**Interfaces (Produces):**
```ts
type Message = { type: "collect"; runId: string; feedId: string; shard?: string }
             | { type: "finalise"; runId: string; deadlineAt: string }
             | { type: "bootstrap"; scope: "bootstrap"; feeds?: string[]; force?: boolean; includeContracts?: boolean; comparisonRefresh?: boolean };
export function dueFeeds(now: Date, scope: "daily" | "3h" | "weekly" | "bootstrap", config?: object): string[];
export function runDeadline(createdAt: Date, feeds: string[], measuredP95Ms: Record<string, number>): Date;
// = createdAt + max(25 min, Σ p95 × 1.5)
export async function scheduled(controller, env, ctx): Promise<void>;
export async function dispatch(message: { body: Message; attempts: number; ack(): void; retry(o?: { delaySeconds: number }): void }, env, ctx): Promise<void>;
export async function finalise(runId: string, env, now: Date): Promise<{ status: "published" | "no-change" | "incomplete" | "pending" | "already-finalised" }>;
export const REASON_CODES = { "no-current-observation": "n", "collector-failed": "c", "not-scheduled": "s" } as const;
// mirrors UNAVAILABLE_REASONS (worker/publication-availability.js:24-28); an unknown reason ⇒ encodeHealth throws (fail closed)
export function buildHealthMetadata(edition: object, now: Date): { metadata: object; overflow: object | null };
// metadata = {v:1, e:editionId, g:generatedAt, u:validUntil, s:"ready"|"degraded", m:"id,id", h:"id,id", x:"id:n,id:c"} ≤ 1,000 B JSON;
// x packs every unavailable {id, reason} as "id:code", so reasons are never lost. When it does not fit:
// metadata = {v:1, e, g, u, s, t:1} and overflow = {editionId, missingRequired[], held[], unavailableSections[{id,reason}]} → v20:edition:health
export function healthBodyFromMetadata(metadata: object, overflow: object | null): object;
// returns today's public body shape exactly: {status, ready, degraded?, missingRequiredSections?, unavailableSections?[{id,reason}]}
// t:1 with missing or mismatched overflow ⇒ {status:"degraded", ready:false, degraded:true}
// Distinct from the existing publicArtifactMetadata(publication, artifact) at publication-publisher.js:109, which is deleted here.
```

- [ ] **Step 1: Write failing tests:**
  - `kv budget > healthy daily run with current publications writes at most 16 keys`: counting fake, real config, fixtures.
  - `kv budget > held feeds produce zero writes and zero sends on cron`.
  - `kv budget > 50 synthetic published feeds write at most 60 keys`.
  - `pipeline > redelivered bootstrap never re-sends collect batch`: a run with `dispatchedAt` set ⇒ 0 sends.
  - `pipeline > redelivered finalise after success writes nothing`: `finalisedAt` set ⇒ 0 puts.
  - `pipeline > unknown message type is retried, not acked`.
  - `pipeline > deadline passed with partial success finalises incomplete`.
  - `pipeline > 50 synthetic feeds at measured p95 finalise complete before derived deadline`.
  - `pipeline > sharded feed collects only missing shards`.
  - `health metadata > 50 feeds all unavailable stays within 1024 bytes or degrades closed`: overflow ⇒ `t:1` plus an overflow record. Health returns `degraded`/`ready:false` when the overflow key is missing or has another `editionId`.
  - `health metadata > reasons round-trip for every UNAVAILABLE_REASONS value`.
  - `health metadata > unknown reason fails closed`.
  - `health > metadata-backed body equals legacy body`. It is byte-identical to today's `healthResponse` for the live-shaped state (`missingRequiredSections:["housePriceIndex","nhsStats"]`, `unavailableSections:[{id:"crimeStatistics",reason:"no-current-observation"},{id:"housePriceIndex",reason:"no-current-observation"}]`), the ready state and the bootstrapping state, before G5.
  - `health metadata > 17 feeds with every feed unavailable fits without overflow`.
- [ ] **Step 2: Run** `npx vitest run tests/worker/pipeline.test.ts tests/worker/kv-write-budget.test.ts tests/worker/health-metadata.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Measure finaliser CPU on a 50-feed (about 2 MB) artifact in `wrangler dev`, and record it. **G4:** stop legacy writes only after 7 clean divergence-log days. Record in `free-resource-budget.md` that a rollback after G4 fails closed but degrades as legacy fragments expire.
- [ ] **Step 4: Run** the full suite, the dry-run and `bundle size` (Task 7). Expected: PASS.
- [ ] **Step 5: After the requested release,** record the daily KV put count from Cloudflare KV analytics. It must be ≤ 16 for 3 consecutive days.
- [ ] **Step 6: Commit** `feat: single three-message publication pipeline with minimal KV state`.

### Task 11: Archive read path

**Files:**
- Modify `worker/edition-archive.js`:
  - `listEditionSummaries` reads only the index;
  - `archiveEdition` verifies the hash and summary at write time and stops writing `v1:edition:summary:*` for new editions;
  - `readEditionRaw` keeps the legacy summary-key fallback.
- Modify `worker/public-data-entry.js:385-400`. Detail success returns `Cache-Control: public, max-age=60` and `ETag: "<contentHash>.<publicationConfigHash>"`, and honours `If-None-Match` with a 304. Errors stay `no-store`.
- Modify `app/editions/page.tsx`: 20 per page, with static-safe page links.
- Test: `tests/worker/edition-archive.test.ts`, `tests/unit/editions-page.test.tsx`

`publicationConfigHash` is the FNV-64 hash of the stable-stringified `config/publications.json`, computed at module load. Reuse the existing `fnv64` in `worker/measure-catalog.js` by importing it, exporting it if it is not already exported. A test asserts there is no second `fnv64` definition: `edition detail > config hash reuses measure-catalog fnv64`. `contracts/evidence-domain.js:121` already duplicates it; Task 4 folds that copy into the same import.

- [ ] **Step 1: Write failing tests:**
  - `editions list > performs exactly one KV read for 60 retained editions`.
  - `editions list > excludes held-family changes`.
  - `edition detail > a publication hold changes the cacheable response identity`: the same edition under two configs gives different ETags, and neither response carries `max-age` above 60 or `immutable`.
  - `edition detail > errors are no-store`.
  - `editions page > renders at most 20 entries and a next link`.
  - `archive write > rejects content whose hash mismatches before indexing`.
- [ ] **Step 2: Run** `npx vitest run tests/worker/edition-archive.test.ts tests/unit/editions-page.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite. Expected: PASS. After the release, `/editions/` must be under 200,000 bytes.
- [ ] **Step 5: Commit** `perf: serve the edition list from its index and paginate the archive page`.

### Task 12: Health semantics (G5)

**Files:**
- Modify: `worker/public-data-entry.js` `healthResponse`, `contracts/public-surfaces.json`, `app/lib/usePublicationHealth.ts` validator
- Test: `tests/worker/health-contract.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `health > held required feed is reported in held and does not degrade`.
  - `health > published required feed without current observation degrades` (`housePriceIndex`).
  - `health > response never contains run ids or KV key names`.
- [ ] **Step 2: Run** `npx vitest run tests/worker/health-contract.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** after **G5**.
- [ ] **Step 4: Run** the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: separate policy holds from failures in public health`.

---

## Workstream 5 — moved to a follow-up plan

Static-first delivery (Tasks 13–16 and 17b) lives in [`2026-11-06-static-first-delivery.md`](2026-11-06-static-first-delivery.md). That plan is **not executable until owner gate G9**. Design: target §6, which is conditional. Nothing in this plan depends on it.

---

### Task 17a: Retire legacy data-pipeline keys and shims; record the new ownership (G4, G-AGENTS)

**Depends on:** Task 10 plus 14 clean production days after legacy writes stopped (G4). Also Task 4, whose guard `policy > no module imports worker/publication-currentness` must pass, and Task 7 Step 5b, whose guard `feed registry > no module imports worker/feed-registry` must pass. Both guards must pass before the deletion step.

**Files:**
- Delete: re-export shims `worker/publication-currentness.js` and `worker/feed-registry.js`. Both become re-exports of `contracts/evidence-policy.js` / `feeds/registry.js` in Tasks 3–6, and they are deleted only once no importer remains; `app/` imports both today. Also delete the legacy publication-policy route functions.
- Run: `scripts/delete-legacy-kv-keys.mjs` (**G4**: dry-run listing first; the owner runs it). It deletes only `v12:publication:*`, `v13:publication:run:*`, `v14:publication:public`, `v12:contracts:day:*`, `v12:section:governmentContracts`, `v10:*`. It never touches `v1:edition:*`.
- Modify:
  - `AGENTS.md` "Architecture and data", with text approved under **G-AGENTS**. Source membership and retrieval policy move from `worker/feed-registry.js` to `feeds/` (definitions) plus `contracts/evidence-policy.js` (currentness and route policy);
  - `docs/v1/ARCHITECTURE.md`;
  - `docs/operations/free-resource-budget.md`;
  - `docs/operations/deployment-ci-frugality.md`;
  - `scripts/check-static-architecture.mjs` and `scripts/check-source-ownership.mjs` (new owners);
  - the master plan's Wave 1 note (current run/commit protocol per G-225).
- Test: extended `tests/unit/dead-code.test.ts`; `tests/unit/source-ownership.test.ts`

- [ ] **Step 1: Extend tests:**
  - `dead code > removed modules stay removed` (the shims);
  - `source ownership > feeds/ owns source membership`.

  Run: FAIL.
- [ ] **Step 2: Delete** (Haiku, Opus review).
- [ ] **Step 3: Run** `npm run lint && npx vitest run && node scripts/check-static-architecture.mjs && node scripts/check-source-ownership.mjs`. Expected: PASS.
- [ ] **Step 4: Update** `IMPLEMENTATION-INVENTORY.md` and the master plan with the factual result.
- [ ] **Step 5: Commit** `chore: retire legacy publication keys and shims; record feeds/ ownership`.

---

### Task 18: Ready-to-scale probe across every layer

**Depends on:** Task 5 (`gateRoute`, `routeManifest`), Task 7 (projections) and Task 10 (`dueFeeds`). The edition-build assertion lives in the follow-up plan's Task 14.

**Files:**
- Test: `tests/worker/feed-sprawl-end-to-end.test.ts` (reuses Task 7's temp-copy probe helper)

- [ ] **Step 1: Write the test** `feed sprawl > probe feed is registered everywhere and held everywhere`. With `feeds/__probe/` added as in Task 7 Step 6, assert:
  - `routeManifest()` contains `/section/__probe/` and `/data/sections/__probe.{json,csv}`;
  - the sitemap source list contains the probe route, and the rendered sitemap excludes it while held;
  - `dueFeeds(now, "daily")` excludes it;
  - `gateRoute("/section/__probe/").access === "unavailable"`.
- [ ] **Step 2: Run** `npx vitest run tests/worker/feed-sprawl-end-to-end.test.ts`. Expected: PASS. If it fails, the failing layer is fixed in its owning task, not here.
- [ ] **Step 3: Commit** `test: prove a new feed is registered and held across every layer`.

## Definition of done: ready to scale to new reports

- [ ] A new feed is **3 hand-edited files** (`feeds/<slug>/feed.js`, `feeds/<slug>/parse.js` with fixtures, one line in `feeds/index.js`) **plus regenerated projections**. A bespoke view adds a component. This is proven by `feed sprawl > a new feed needs only its folder and one index line` (Task 7: projections, downloads, release families, 3-file diff) and `feed sprawl > probe feed is registered everywhere and held everywhere` (Task 18: route manifest, sitemap, schedule, gate). The feed is held, not collected and not routed until a separate G1 authorization.
- [ ] Every evidence-bearing or config-filtered public response has a total cache lifetime ≤ 300 s (Task 2b release-smoke assertion).
- [ ] One policy module: `policy > only evidence-policy defines currentness` passes, and every app route is in `routeManifest()`.
- [ ] Healthy daily run ≤ 16 KV writes with the current 11 published families, and ≤ 60 at 50 synthetic feeds (tests). Production KV analytics confirm ≤ 16 for 3 consecutive days.
- [ ] Collector and finaliser CPU measured on Workers; every feed fits, or has an owner G-CPU decision. The data Worker bundle is under 80% of the Free script limit.
- [ ] `/editions/` < 200 KB, `/data/editions.json` costs 1 KV read, and no config-filtered response is cacheable beyond 300 s.
- [ ] Health metadata fails closed above 1,024 B (test at 50 feeds).
- [ ] RSS, sitemap and downloads contain only evidence that was current at build time.
- [ ] PR validation is one `quality` job with safe lanes, and `main` deploys add no suites. G-MIN before/after minutes are recorded.
- [ ] All existing integrity tests (held gating, run isolation and dispatch lease, monotonic fragments, archive immutability, retrieval bounds) still pass, unweakened.

## Self-review

1. **Spec coverage:**
   - target §2 → Tasks 6–7;
   - §3 → Tasks 3–5;
   - §4 → Tasks 9–11;
   - §5 → Tasks 8 and 10;
   - §6 → the follow-up plan `2026-11-06-static-first-delivery.md` (Tasks 13–16, 17b), behind G9;
   - §7 → Task 2;
   - §8 steps 0–7 and the legacy-key part of step 10 → Workstream 0, Tasks 1–12, 17a and 18; steps 8–10 otherwise → the follow-up plan;
   - risks R4–R11, R14, R15 and R18 map to Tasks 0.1, 2b, 8, 9 and 10. R1–R3, R12, R13, R16 and R17 belong to the follow-up plan.
2. **Sign-off conditions** (references to Tasks 13–16 and 17b are to the follow-up plan):
   - M1 → Tasks 14 and 15, Review Focus 1;
   - M2 → Task 11 and Global Constraints;
   - M3 → Task 10 and the budget figures;
   - M4 → Tasks 15 and 16, Review Focus 2;
   - M5 → Workstream 0, Tasks 0.1 and 0.3, G-MIN;
   - M6 → Task 8 ordering;
   - M7 → Task 10;
   - M8 → inlined in Tasks 3, 4 and 13;
   - M9 → Tasks 15 and 16;
   - M10 → G9, Task 13/14 split, header tests;
   - M11 → shared interfaces in Tasks 3, 9 and 10;
   - M12 → Task 5, Task 7 Step 6 and the DoD.

   Round 2:
   - N1 → Task 16 pre/post-cutover release flow and Task 15 `staticRelease`;
   - N2 → Task 16 single secret-put exception with its two tests;
   - N3 → Task 10 reason codes and `healthBodyFromMetadata`;
   - N4 → Global Constraints and Task 2b;
   - N5 → Task 7 Step 6 narrowed, plus Task 18.

   Round 2 tracking: T-R2.1 → Task 14 embedding-first classification; T-R2.2 → split note under the ordering table; T-R2.3 → G3 and Task 15 Step 5b; T-R2.4 → CORP in Tasks 13 and 15; T-R2.5 → Task 11 `fnv64` reuse.

   Tracking items: T1 → `runDeadline`; T2 → `bundle size`; T3 → Task 14 Step 6; T4 → `health > metadata-backed body equals legacy body`; T5 → Tasks 9 and 10 budget notes; T6 → named reviewers and Task 7 Step 3; T7 → Task 8 doc fixes and Task 17a; T8 → Task 10 Step 3; T9 → G-AGENTS.
3. **Type consistency:**
   - `SectionRecord` (inner) vs `FeedRecord` (wrapper) are used consistently in Tasks 3, 9 and 10;
   - `RouteEntry.gate` includes `"product"` in the target and Task 3;
   - `projectPublic` is nullable in both;
   - the bootstrap message carries `scope`;
   - `buildHealthMetadata` replaces, and does not collide with, `publicArtifactMetadata(publication, artifact)`;
4. **Review Focus:** all 3 lines have owning tests (Tasks 9, 0.1 and 2b). Task 18 depends on Tasks 5, 7 and 10, so no test consumes an interface before its producing task.
6. **Split (ruling B):** Tasks 13, 14, 15, 16 and 17b appear only in the follow-up plan. Tasks 0.1–0.4, 1, 2, 2b, 3–12, 17a and 18 appear only here.
5. **Proportion:** decisions, signatures and tests only. No function bodies beyond the lane table and the gate rule.

**Execution recommendation:** Subagent-driven. Tasks 3, 6, 9 and 10 define interfaces that later tasks consume, and a shipped mistake there risks serving stale or held evidence. Fresh per-task review is worth its cost.
