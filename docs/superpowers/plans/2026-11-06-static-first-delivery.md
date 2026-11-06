# Static-First Delivery Implementation Plan (follow-up)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Not executable until owner gate G9 is approved.** This plan was split out of [`2026-11-06-feed-architecture-simplification.md`](2026-11-06-feed-architecture-simplification.md), the main plan, under the Chief of Staff's proportion ruling B (`docs/architecture/feed-architecture-signoff-2026-11-06.md` §R3.3). Task numbers 13–16 are kept so that existing citations stay valid. Task 17b is new. Every task here appears only in this file.

## Summary for the owner

1. This plan replaces per-visitor OpenNext SSR with a per-edition static export served by a tiny validity- and hold-aware gate Worker. Design: target §6, which is conditional.
2. It starts only if you approve **G9**, on the measurements below. If G9 is no-go, the main plan still delivers the brief. A cheaper fallback, removing the browser health poll and snapshot refetch, is Task 13's client change shipped alone.
3. Every evidence-bearing file is gated: HTML, RSC payloads, edition JSON, downloads, RSS and sitemap. Expiry and holds serve pre-built unavailable variants without JavaScript.
4. A hold takes effect through one `HELD_FEEDS` secret update, without a rebuild. A rollback re-applies the current held set.
5. Workers Builds is the single deployer of the static Worker, building only the release-verified branch. The reader-page smoke runs after deploy, with automatic rollback.
6. Security headers move to `contracts/security-headers.js`, created in **Task 13 of this plan**, and are applied by the gate and `_headers`.
7. Expected gain, unmeasured: per evidence page view, about 3–4 Worker requests become about 1–3, and 2–3 KV reads become 0. Gate CPU target is p99 < 2 ms.
8. Main risk: build time against the 20-minute Workers Builds timeout and 3,000 min/month. It is measured in Task 14, and passing it is the **G3** entry criterion, not a G9 criterion, which avoids a circular dependency.
9. Your gates here: **G9**, **G-DNS**, **G3**, **G2**, **G8**. G1 publication changes are never part of this plan.
10. Done means the "If G9 was approved" Definition of Done at the end holds.

**Goal:** Serve public-data.org's evidence pages as verified per-edition static files behind a fail-closed gate, cutting per-visitor Worker requests, CPU and KV reads within the Cloudflare free tier.

**Architecture:**

- Each edition is built once with `next build` and `output: "export"`, and every evidence-bearing file gets an unavailable variant.
- A small gate Worker (`public-data-static`) serves assets. It switches to variants when validity ends or when a feed is held.
- The data Worker from the main plan remains the API and the build input.

**Tech Stack:** Next 16 (`output: "export"`), Workers Static Assets, Workers Builds (deploy hooks), Wrangler 4, Vitest 4.

**Spec:** [`docs/architecture/feed-architecture-target-2026-11-06.md`](../../architecture/feed-architecture-target-2026-11-06.md) §6 (conditional on G9), §8 steps 8–10, and risks R1–R3, R12, R13, R16 and R17. Also the main plan [`2026-11-06-feed-architecture-simplification.md`](2026-11-06-feed-architecture-simplification.md) and [`docs/v1/MASTER-DELIVERY-PLAN.md`](../../v1/MASTER-DELIVERY-PLAN.md).

## G9 entry criteria (all required, recorded in `docs/operations/free-resource-budget.md`)

The build-minutes criterion is **not** a G9 criterion. It cannot be measured before Tasks 13–14 exist, and those run after G9. It is the entry criterion of **G3** (below), the gate before anything is deployed to Cloudflare. All production effects stay behind owner gates: Tasks 13–14 produce no production change, and Task 15 onward needs G3.


1. **Measured traffic.** Per-Worker requests/day for `public-data-web`, `pulse-data-worker` and every other Worker on the account, over ≥7 days, from Cloudflare analytics (issue #218).
2. **CPU attribution.** CPU p50/p99 and CPU-limit exceptions per Worker, showing that `public-data-web` SSR is a material share of request or CPU pressure. If it is not, G9 is no-go and the main plan's fallback applies.
3. **Main plan prerequisites done:** Tasks 4, 5, 7 and 10 merged, and Task 12 decided.

## Consumes (from the main plan)

- `evaluate`, `projectPublic`, `routeAccess` and `RouteEntry`: main-plan Task 3 (`contracts/evidence-policy.js`).
- `gateRoute` and `routeManifest`: main-plan Task 5 (`app/lib/gateRoute.ts`, `feeds/registry.js`).
- `FEEDS`: main-plan Task 6 (`feeds/index.js`).
- `finalise` in `worker/pipeline.js` and `buildHealthMetadata`: main-plan Task 10.
- `cacheLifetimeSeconds`: main-plan Task 2b (`scripts/lib/cache-lifetime.mjs`).

`contracts/security-headers.js` is **created by Task 13 of this plan**. Until then, the header set stays in `next.config.ts` and `public/_headers`.

## Global Constraints

- All main-plan Global Constraints apply unchanged: free tier only, the evidence rules, the validity boundary `now >= validUntil`, the 300 s total cache-lifetime cap, no publication-state changes, the `quality` check name and the action allow-list.
- Static assets: 20,000 files and 25 MiB per file. Workers Builds: 3,000 min/month, 1 concurrent build, 20 min timeout.
- HTML, RSC and data responses served by the gate are `no-store`. Only hashed `/_next/static/*` is immutable.
- `public-data-static` code and assets are deployed only by Workers Builds from `release/verified`. The single exception is `wrangler secret put HELD_FEEDS`.

## Review Focus

1. **Evidence reachable through a non-HTML static file** (RSC payload, `/_edition/*.json`, `/data/sections/*`, `/feed.xml`, `/sitemap.xml`) after `validUntil` or after a hold. Expect: every evidence-bearing emitted file is gated and paired with an unavailable variant. Tests:
   - `edition build > every emitted file containing fixture evidence values is served only through a gated pattern` (Task 14);
   - `asset gate > gates RSC, edition JSON, downloads, feed and sitemap` (Task 15).
2. **A feed is held after the last successful build and the next rebuild fails.** Expect: the unavailable variants are served immediately. Test: `asset gate > a feed held after build serves the unavailable variant even when the edition build fails` (Task 15).
3. **Build reads an older artifact than the finaliser just wrote** (KV eventual consistency, edge cache). Expect: no deploy on an edition-id mismatch. Test: `edition build > refuses to emit when fetched editionId differs from requested` (Task 14).

## Ordering, dependencies and delegation

| Task | Title | Depends on | Ships to prod? | Delegate (reviewer) | Gate |
|---|---|---|---|---|---|
| — | Static-first go/no-go | entry criteria above | — | owner | **G9** |
| 13 | Static-export compatibility; remove browser polls; security-headers module | G9, main 4, 5 | none until 16 | Sonnet | G9 (Step 5 fallback may ship alone with separate owner approval) |
| 14 | Edition variant build + manifest; build-time measurement | 13, main 7 | CI artifact | **Opus** | G9; Step 6 result feeds **G3** |
| 15 | Asset-gate Worker: all evidence classes, hold fast path, headers | 14 | new Worker, unrouted | **Opus** | **G3**, **G-DNS** |
| 16 | Build trigger, single verified deployer, cutover | main 10, 15 | **reader-visible** | **Opus** | **G2** |
| 17b | Retire OpenNext, Pages seed, `publication-recovery.js` | 16 + 14 days | cleanup | Haiku deletes (Opus review) | **G8** |

Task 16 is the largest. If its diff exceeds one reviewable PR (about 800 changed lines), split it into build trigger, then `deploy.yml` release flow, then cutover (G2). Each split keeps its own tests.

### Owner decision gates

- **G9** — Go/no-go on the entry criteria above.
- **G-DNS** — Any new hostname, e.g. `next.public-data.org`, for the non-production gate route.
- **G3** — Entry criterion: Task 14 Step 6 build minutes, with a median clean build < 15 min and projected 4 builds/day × 30 < 1,500 min/month. If it fails, the owner decides to stop, simplify the variant build, or accept the cost profile; no deployment happens until then. Once met, connect the repo to Cloudflare Workers Builds on branch `release/verified`.
  - Create the deploy hook and store `EDITION_BUILD_HOOK` as a `pulse-data-worker` secret.
  - Grant only the `deploy.yml` job that advances the branch `permissions: contents: write`; the workflow default stays `contents: read`.
  - Add a branch ruleset so only GitHub Actions may push `release/verified`.
  - Provide a Cloudflare API token able to run `wrangler secret put` on `public-data-static`.
    - Cloudflare tokens grant *Workers Scripts: Edit* broadly. I have **not** verified that a token can be restricted to secret writes on one Worker, so you should assume it can deploy any Worker in the account.
    - The controls are Task 16's workflow tests, which allow exactly one command touching `public-data-static`, the branch ruleset, and GitHub environment protection on the job holding the token.

  You perform these steps; no secret enters the repo or chat.
- **G2** — Production route cutover to the static gate Worker, after the Task 16 evidence pack.
- **G8** — Retire the Pages seed fallback, `worker/publication-recovery.js` and the OpenNext web Worker (Task 17b).

### Risks owned by this plan (target §9)

R1 (static evidence past `validUntil`), R2 (repeated build failure), R3 (stale build input), R12 (non-HTML evidence escape), R13 (hold during a failed rebuild), R16 (build time and minutes), R17 (release checks after cutover).

---

### Task 13: Static-export compatibility and removal of browser polling

**Files:**
- Modify the three `searchParams` pages for client-side URL reading under `<Suspense>`: `app/compare/page.tsx:16-20`, `app/measure/page.tsx:20-22`, `app/sources/[id]/page.tsx:141,157`.
- Modify `app/data/sections/[file]/route.ts`. Under `EDITION_BUILD=1`, it is replaced by static files from `scripts/generate-section-downloads.mjs`.
- Modify `app/money/buyer/[id]/page.tsx` and `app/money/supplier/[id]/page.tsx`: redirects move to `_redirects`.
- Remove from reader pages the browser snapshot refetch and health poll:
  - `fetchMetricsSnapshot()` in `app/lib/metricsSnapshot.ts:120-161`, called by `useMetrics.ts:302`, `DataExplorer.tsx:672` and `NationalEvidenceEdition.tsx:96`;
  - `usePublicationHealth` (`app/lib/usePublicationHealth.ts:71,82`), rendered by `PublicationFreshnessIndicator` in `SectionNav.tsx:103`.

  The indicator and Explorer read the build's edition data instead.
- Create: `contracts/security-headers.js`, moved from `next.config.ts:15-24` `securityHeaders`, which `next.config.ts` now imports. The set is the union of `next.config.ts` and `public/_headers`: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP **and Cross-Origin-Resource-Policy**.
- Modify: `scripts/lib/pr-validation-lane.mjs` (adds the `staticExportCheck: boolean` output and its surface list) and `.github/workflows/pr-validation.yml` (one `if:`-gated step).
- Test: `tests/unit/static-export-compat.test.ts`, `tests/unit/prValidationLane.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `static export > next build with output export succeeds for all routes` spawns `EDITION_BUILD=1 next build` against the fixture.
    - It is **excluded from every default PR lane** (`describe.skipIf(process.env.STATIC_EXPORT_CHECK !== "1")`).
    - `quality` sets `STATIC_EXPORT_CHECK=1` only when the PR touches the static-export surface: `next.config.ts`, `scripts/build-edition-site.mjs`, `app/lib/editionManifest.ts`, `worker/asset-gate.js`, `worker/static-wrangler.toml`, or one of the 3 `searchParams` pages. It also runs on `workflow_dispatch`.
    - After G3, the same export runs in every Workers Builds build anyway.
    - Cost: one extra Next build (unmeasured; roughly 1–2 runner-minutes, since today's whole PR run is about 235 s aggregate) **only** on those PRs. Free for this public repo, but counted in G-MIN.
  - `pr lane > default full lane contains no second Next build`: lane-rule plus workflow-text assertion, extending main-plan Task 0.1's test file. The `STATIC_EXPORT_CHECK` step carries an `if:` on the lane output, and `validationLane()` sets that output false for a change outside the surface list.
  - `pr lane > static-export surface change enables the export check`.
  - `static export > compare and measure restore state from URL on the client`.
  - `static export > no reader component fetches /data/health.json or /data/metrics-snapshot.json`.
  - `security headers > next config, public/_headers and contracts module export the same set including CORP`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/static-export-compat.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite and the OpenNext build (production still on SSR). Expected: PASS.
- [ ] **Step 5: Commit** `refactor: make evidence pages static-export compatible`. If G9 is no-go, the polling removal alone can ship under its own owner approval as the cheaper fallback (target §6).

### Task 14: Edition variant build, file classification and build-time measurement

**Files:**
- Create: `scripts/build-edition-site.mjs`, `app/lib/editionManifest.ts`, `tests/unit/edition-build.test.ts`
- Modify: `next.config.ts` (`output: "export"` when `EDITION_BUILD=1`), `app/lib/serverMetricsSnapshot.ts` (static branch reads the build input; no `connection()`)

**Interfaces (Produces):**
```ts
type GatedFile = { validUntil: string | null; feeds: string[]; unavailable: string | { status: 503 } };
type EditionManifest = { editionId: string; builtAt: string; sha: string; files: Record<string, GatedFile> };
// one entry per evidence-bearing file: HTML, RSC payload, /_edition/<id>/*.json, /data/sections/*, /feed.xml, /sitemap.xml
export async function buildEditionSite(opts: { editionId: string; sha: string; origin: string; fetchImpl?: typeof fetch; now: Date; outDir: string }): Promise<EditionManifest>;
export function recordFeedEmbedding(file: string, feedIds: string[]): void;   // called by the render path whenever projectPublic data for a feed is serialised
export function classifyEmittedFiles(outDir: string, embedding: Record<string, string[]>, evidenceValues: string[]): { evidenceBearing: string[]; clean: string[]; unexplained: string[] };
```

Classification is primary-by-construction, with a scan backstop:

- **Primary.** The render path records which feeds each emitted file embeds (`recordFeedEmbedding`). Every file with ≥1 feed becomes a manifest entry.
- **Backstop.** A value scan normalises formats before matching (strips thousands separators, `£`/`%`/units, and matches fixed-decimal and locale variants of each fixture value).
- **Failure.** A file the scan flags but the embedding record does not list is `unexplained` and fails the build.

- [ ] **Step 1: Write failing tests:**
  - `edition build > refuses to emit when fetched editionId differs from requested`.
  - `edition build > route validUntil is the minimum of embedded feeds`.
  - `edition build > every emitted file containing fixture evidence values is served only through a gated pattern`: walk **every** file in `outDir`. Assert each evidence-bearing path is a key of `manifest.files` with an existing variant or 503, and that `unexplained` is empty.
  - `edition build > reformatted values are caught by the normalised scan backstop`: a fixture value rendered as `1,234.5`, `£1.2bn` and `12.3%`.
  - `edition build > unavailable variants contain no evidence values` (HTML and RSC).
  - `edition build > held feeds are absent from every emitted file`.
  - `edition build > total files under 20000 and each under 25 MiB`.
  - `edition build > _headers carries the security header set and no s-maxage on HTML`.
  - `feed sprawl > probe feed emits no evidence in the edition build`. This was moved from main-plan Task 18: with the Task 7 probe feed `feeds/__probe/` added, `buildEditionSite` on the fixture emits no `__probe` evidence and lists no `__probe` file as available.
- [ ] **Step 2: Run** `npx vitest run tests/unit/edition-build.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Build each evidence route twice, the normal build and one with `projectPublic` forcing the route's feeds unavailable, into `/_unavailable/<path>`. Do the same for RSC payloads. Write `edition-manifest.json` and `_headers`.
- [ ] **Step 4: Run** `EDITION_BUILD=1 node scripts/build-edition-site.mjs --input tests/fixtures/publication/current-snapshot.json --edition <fixture id> --sha $(git rev-parse HEAD) --out out`. Expected: `out/edition-manifest.json` and `out/_unavailable/section/gdp/index.html`.
- [ ] **Step 5: Commit** `feat: build verified editions as static files with a complete gating manifest`.
- [ ] **Step 6: Measure** a clean `npm ci && node scripts/build-edition-site.mjs ...` on a 2-vCPU machine, three times, and record the median. Pass: < 15 min per build, and projected (4/day × 30) < 1,500 min/month. This result is the G3 entry criterion. If it fails, stop and return to the owner before G3.

### Task 15: Asset-gate Worker for all evidence classes, hold fast path and headers (G3, G-DNS)

**Files:**
- Create: `worker/asset-gate.js`, `scripts/gate-held-feeds.mjs`, `scripts/static-release.mjs`, `worker/static-wrangler.toml`.
  - `name = "public-data-static"`, `[assets] directory = "../out"`.
  - `run_worker_first` = every path pattern in `manifest.files`, generated.
  - **Secret** `HELD_FEEDS`, a JSON array; a missing secret is treated as `[]` only together with the build-time held list baked in the manifest.
  - No KV or Queue bindings, `workers_dev = false`.
  - Non-production route only after G-DNS.
- Test: `tests/worker/asset-gate.test.ts`, `tests/unit/static-release.test.mjs`

**Interfaces (Produces):**
```ts
export function createAssetGate(manifest: EditionManifest): { fetch(request: Request, env: { ASSETS: Fetcher; HELD_FEEDS?: string }): Promise<Response> };
// effective held set = manifest-time held feeds ∪ parse(HELD_FEEDS); unparseable HELD_FEEDS ⇒ every evidence file unavailable (fail closed)
export function heldFeedsFromConfig(config: object, feeds: string[]): string[];   // scripts/gate-held-feeds.mjs
export async function staticRelease(opts: { sha: string; editionId: string; build(): Promise<void>; deploy(): Promise<{ versionId: string; previousVersionId: string }>;
  smoke(sha: string): Promise<void>; rollback(versionId: string): Promise<void>; reapplyHeld(): Promise<void> }): Promise<"live" | "rolled-back" | "rolled-back-unsafe">;
// scripts/static-release.mjs — the Workers Builds build command: build → deploy → reader-page SHA smoke → on smoke failure `wrangler rollback <previousVersionId>` and exit non-zero
```

- [ ] **Step 1: Write failing tests:**
  - `asset gate > serves available asset before validUntil`.
  - `asset gate > serves unavailable variant when now equals validUntil`.
  - `asset gate > gates RSC, edition JSON, downloads, feed and sitemap`: one fixture path per class, each expired ⇒ variant or 503.
  - `asset gate > a feed held after build serves the unavailable variant even when the edition build fails`: manifest says current, `HELD_FEEDS='["gdpTracker"]'`, no rebuild ⇒ variant for every file embedding gdpTracker.
  - `asset gate > every response carries the security header set` (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP and CORP from `contracts/security-headers.js`).
  - `asset gate > HTML, RSC and data are no-store; hashed assets immutable`.
  - `asset gate > unknown evidence path returns 404 no-store`.
  - `asset gate > performs no KV or subrequest besides ASSETS`.
  - `asset gate > unparseable HELD_FEEDS makes every evidence file unavailable`.
  - `static release > smoke failure after deploy rolls back to the previous version`: fakes record `rollback(previousVersionId)` and the result `"rolled-back"`.
  - `static release > rollback preserves the current held set` (T-R3.2). `wrangler rollback` may restore the older version's `HELD_FEEDS` value (*unverified*). After any rollback, `staticRelease` re-applies `secret put HELD_FEEDS` with `heldFeedsFromConfig(current config)`, and the fake asserts the order rollback → secret put. If the re-apply fails, the result is `"rolled-back-unsafe"`, with a non-zero exit and the documented full-pause fallback.
  - `static release > smoke runs only after deploy and against the built sha`.
- [ ] **Step 2: Run** `npx vitest run tests/worker/asset-gate.test.ts tests/unit/static-release.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify the hold fast path on the non-production Worker.** Run `npx wrangler secret put HELD_FEEDS --name public-data-static` with `'["gdpTracker"]'`. Confirm that it creates a new version without re-uploading code or assets, and that held files switch within one minute. If not possible, document the full-pause fallback (route evidence paths to `worker/offline-pages-entry.js`) as the hold path and return to the owner before G2.
- [ ] **Step 5: Owner action G3.** Connect Workers Builds to `release/verified` for `public-data-static`. The build command is `npm ci && node scripts/static-release.mjs --edition "$EDITION_ID"`:
  - build → `wrangler deploy --config worker/static-wrangler.toml` → reader-page SHA smoke against the production or non-production host;
  - on a smoke failure, `wrangler rollback`.

  Create the deploy hook and store `EDITION_BUILD_HOOK`. Whether Workers Builds exposes the commit SHA as an env var is *unverified*; if not, use `git rev-parse HEAD`. Deploy-hook fallback if unavailable on Free: `workflow_dispatch` on `release/verified`.
- [ ] **Step 5b: Prove the trigger (T-R2.3).** Push to `release/verified` from a `deploy.yml` run using `GITHUB_TOKEN`, and confirm Workers Builds starts a build. GitHub suppresses *workflow* triggers from `GITHUB_TOKEN` pushes; whether app webhooks still fire is *unverified*. If no build starts, `deploy.yml` instead POSTs the same deploy hook after advancing the branch, using an owner-stored `STATIC_BUILD_HOOK` GitHub secret. Record the result.
- [ ] **Step 6: Measure** gate CPU p99 < 2 ms via `wrangler tail` on the non-production host.
- [ ] **Step 7: Commit** `feat: fail-closed asset gate for every evidence-bearing static file`.

### Task 16: Build trigger, single verified deployer and cutover (G2)

**Files:**
- **Version skew (T-R3.3).** During a release, the data Worker and the static Worker run different SHAs for minutes, or longer if the static build fails and rolls back. The data-API response shapes consumed by the static build and by browsers (`/data/metrics-snapshot.json`, `/data/editions.json`, `/data/edition.json`, `/data/health.json`) stay backward compatible for one release: additive fields only, and a removed field survives one further release. Test: `release smoke > data-only mode validates the previous release's public-surface schema`, run against `contracts/public-surfaces.json` at `release/verified`.
- Modify `worker/pipeline.js` `finalise` (main plan Task 10). After a successful publish, `POST env.EDITION_BUILD_HOOK` when:
  - the edition id changed, or `min(validUntil) < now + 36h`;
  - and no build was requested for this edition;
  - at most 2 per UTC day.

  A failed POST is logged and is never fatal.
- Modify `.github/workflows/deploy.yml`. Release flow by phase:
  - **Pre-cutover** (reader pages still on OpenNext; static Worker non-production only). Unchanged: `deploy.yml` deploys OpenNext and the data Worker and runs the full `test:release` against `https://public-data.org/`, which checks the OpenNext reader-page revision. Only then does it fast-forward `release/verified`, so Workers Builds builds the non-production static Worker from a verified SHA.
  - **Post-cutover.** `deploy.yml` deploys only the data Worker. It runs `scripts/verify-worker-deployment.mjs` and `release-smoke.mjs --data-only <sha>`, which checks the data-Worker routes, the health contract and the cache-lifetime cap. It does **not** check reader-page revision meta, because those pages come from the static Worker deployed afterwards. Then it fast-forwards `release/verified`.
    - The reader-page SHA smoke runs at the **end** of the Workers Builds build (`staticRelease`, Task 15, which also re-applies `HELD_FEEDS` after any rollback). On failure the build rolls back to the previous static version and fails visibly.
    - Edition rebuilds of the same SHA fail and roll back the same way, so a failing SHA can never stay live. The owner reverts or fixes `main`.
  - **Hold fast path, the one narrowly scoped exception to "Workers Builds is the only deployer".** On any change to `config/publications.json`, the first job step runs `npx wrangler secret put HELD_FEEDS --name public-data-static` with `heldFeedsFromConfig()` output. This sets a secret and uploads no code or assets. Cloudflare API tokens grant Workers edit rights broadly (account-wide *Workers Scripts: Edit*), so the token cannot be limited to secret writes on one Worker; a narrower scope is *unverified*. The real controls are the workflow tests below, which allow exactly one command touching `public-data-static`, plus the branch ruleset and environment protection (G3). It runs before the data-Worker deploy and before `release/verified` advances, so before any rebuild.
  - Remove all deployment of the web tier from `deploy.yml` at cutover.
- Modify `worker/static-wrangler.toml` (route `public-data.org/*` at cutover), `worker/web-wrangler.toml` (route removed; Worker kept deployed 14 days), `scripts/release-smoke.mjs` (`--data-only` mode; reader mode asserts manifest `sha` and `editionId`, gate headers and security headers)
- Test: `tests/worker/pipeline-build-trigger.test.ts`, `tests/unit/workflow-deploy.test.ts`, `tests/unit/release-smoke.test.mjs`

- [ ] **Step 1: Write failing tests:**
  - `build trigger > fires once per new edition`.
  - `build trigger > fires when earliest validity within 36h`.
  - `build trigger > hook failure does not fail finalise`.
  - `build trigger > never more than 2 per UTC day`.
  - `deploy workflow > no workflow deploys or uploads public-data-static code or assets`: across all workflows, no `wrangler deploy|versions upload|versions deploy|rollback` referencing `static-wrangler.toml` or `public-data-static`.
  - `deploy workflow > the only workflow command touching public-data-static is wrangler secret put HELD_FEEDS`: exactly one such step, gated on a `config/publications.json` change and ordered before the data-Worker deploy.
  - `deploy workflow > post-cutover release/verified advances after data-worker checks only`: the advance step `needs` the `verify-worker-deployment` and `release-smoke --data-only` steps, not reader-page smoke.
  - `deploy workflow > pre-cutover release/verified advances after full reader smoke`: selected by the presence of `web-wrangler.toml` routes.
  - `release smoke > data-only mode never requests reader pages`.
  - `release smoke > data-only mode validates the previous release's public-surface schema` (T-R3.3).
- [ ] **Step 2: Run** `npx vitest run tests/worker/pipeline-build-trigger.test.ts tests/unit/workflow-deploy.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Assemble the G2 evidence pack** (Haiku captures, Opus reviews). Comparing old and new on the non-production host:
  - same edition id;
  - same-observation parity on `/`, `/section/*`, `/measure/*`, downloads, `/feed.xml` and `/sitemap.xml`;
  - no-JS tables (Playwright `javaScriptEnabled: false`);
  - held families absent;
  - forced expiry and forced hold serve variants for HTML, RSC and JSON;
  - security headers identical to today's `/`;
  - Lighthouse via `lighthouse.yml` dispatch;
  - measured Workers Builds minutes for one week of edition builds.
- [ ] **Step 5: Owner gate G2.** Deploy the route change. Rollback: restore the `web-wrangler.toml` route and redeploy (about 1 minute).
- [ ] **Step 6: Verify** that the Workers Builds log for the cutover SHA shows `staticRelease` → `"live"`, and that `npm run test:release -- https://public-data.org/ <sha>` passes from a workstation. After 24 h, record per-Worker requests/day and CPU p99 from Cloudflare analytics (issue #218).
- [ ] **Step 7: Commit** `feat: serve public-data.org from verified static editions`.


### Task 17b: Retire OpenNext, the Pages seed and `publication-recovery.js` (G8)

**Depends on:** Task 16 plus 14 clean production days on the static Worker.

**Files:**
- Delete: `worker/web-wrangler.toml`, `worker/open-next.config.template`, the `@opennextjs/cloudflare` dependency, the Pages-seed steps in `deploy.yml`, `worker/publication-recovery.js` and its `STATIC_SNAPSHOT_SEED_URL` var, `worker/offline-pages-entry.js` only if the full-pause fallback has moved into the gate, and `contracts/public-surfaces.json` seed entries.
- Modify: `publishFromCaches` (no seed fetch; with no prior edition, the fallback is unavailable), `docs/v1/ARCHITECTURE.md`, `docs/operations/deployment-ci-frugality.md`, `scripts/check-static-architecture.mjs`. Any `AGENTS.md` wording about Pages and OpenNext goes through **G-AGENTS**, as in main-plan Task 17a.
- Test: extended `tests/unit/dead-code.test.ts`; `tests/worker/cloudflare-publication.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `dead code > OpenNext and Pages seed stay removed`.
  - `publisher > no prior edition and no seed yields unavailable, never a fabricated fallback`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/dead-code.test.ts tests/worker/cloudflare-publication.test.ts`. Expected: FAIL.
- [ ] **Step 3: Delete** (Haiku, Opus review) after **G8**.
- [ ] **Step 4: Run** `npm run lint && npx vitest run && node scripts/check-static-architecture.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `chore: retire SSR and the Pages seed fallback`.

## Definition of done (static-first)

- [ ] Every evidence-bearing static file is gated: HTML, RSC, edition JSON, downloads, feed and sitemap. Proven by the Task 14 classification test and the Task 15 gate tests.
- [ ] Holds apply without a rebuild, and a rollback re-applies the current held set.
- [ ] Security headers from `contracts/security-headers.js`, including CORP, are present on every gated and asset-first response.
- [ ] Reader full-page loads use 0 KV reads and 1 Worker request, and gate p99 CPU is < 2 ms (measured).
- [ ] Edition builds take < 15 min and use < 50% of monthly build minutes (measured).
- [ ] The probe feed emits no evidence in the edition build (`feed sprawl > probe feed emits no evidence in the edition build`, Task 14).
- [ ] One deployer for `public-data-static`, plus exactly one secret-update exception (Task 16 workflow tests).

## Self-review

1. **Spec coverage:** target §6.1–6.5 → Tasks 13–16; §8 steps 8–10 → Tasks 13–17b; risks R1–R3, R12, R13, R16 and R17 → Tasks 14–16.
2. **Exactly-once check:** Tasks 13, 14, 15, 16 and 17b appear only here. The main plan holds 0.1–0.4, 1, 2, 2b, 3–12, 17a and 18.
3. **Interfaces:**
   - `EditionManifest.files` is used in Tasks 14–16;
   - `staticRelease` returns `"live" | "rolled-back" | "rolled-back-unsafe"` in Task 15 and is consumed in Task 16;
   - consumed main-plan interfaces are listed under **Consumes**.
4. **Review Focus:** all 3 lines have owning tests in Tasks 14 and 15.
5. **Proportion:** moved text unchanged except T-R3.1 (token scope), T-R3.2 (rollback re-applies held set) and T-R3.3 (version skew). No function bodies.

**Execution recommendation:** Subagent-driven, after G9. Every task here gates reader-visible evidence.
