# Feed architecture review — 6 November 2026

**Status:** Review record. It changes no code, publication state or deployment.
**Companion documents:** [target design](feed-architecture-target-2026-11-06.md) and the
[implementation plan](../superpowers/plans/2026-11-06-feed-architecture-simplification.md), and the follow-up [static-first plan](../superpowers/plans/2026-11-06-static-first-delivery.md), which is not executable until G9.
**Execution authority:** [`docs/v1/MASTER-DELIVERY-PLAN.md`](../v1/MASTER-DELIVERY-PLAN.md). This review is Wave 1
foundation work: it consolidates interfaces before more sources are added.

## Summary for the owner

1. Eleven evidence families are published today, yet a feed is described across about 20 non-test files. `realWages` is named in 20 (F1). Each new source multiplies that cost.
2. Currentness, hold and route policy live in 6 modules with 1,885 lines, plus about 19 currentness call sites and 33 route-gate calls in 24 app files (F2). These copies can drift, and drift is how held or stale evidence would leak.
3. A healthy daily run makes **39 KV writes**. Every published section writes the same record twice plus a terminal (F3). That is 4% of the 1,000/day free allowance now. At 50 feeds it would be about 160/day, and retries multiply it.
4. Every evidence page is server-rendered per visitor. A page view costs about 3–4 Worker requests and about 2–3 KV reads: SSR, a cross-Worker snapshot fetch and a `no-store` health poll (F5). On the free tier this caps the site at roughly 25–33k page views/day, and the account shares that cap with other Workers.
5. An uncached `/data/editions.json` reads, SHA-256-hashes and parses every retained edition body, about 280 KB each and up to 60 (F6). On a 10 ms CPU budget this is the largest single CPU hazard I found. `/editions/` HTML is 861 KB.
6. `/feed.xml` and the sitemap are built from a committed 273 KB snapshot dated 1 October. Live RSS today advertises September polling as the "latest verified evidence" (F7). This is an evidence-integrity defect, not just clutter.
7. The Queue path has 7 message types, 3 runner modules and per-job terminal bookkeeping (F4). Two families bypass the plan map entirely.
8. Health is permanently `degraded` because `nhsStats` is both *required* and deliberately *held* (F8). Monitoring cannot tell a policy hold from a failure.
9. GitHub Actions: the repo is public, so standard runner minutes cost nothing (verified). Even so, every PR push runs two `npm ci` passes (two lockfiles, two OpenNext versions), lint, the full suite and a full OpenNext build across 3–4 runner jobs. Dependabot runs with no grouping or limits (F10).
10. Keep: fail-closed held gating, run-scoped fragments, monotonic evidence, the immutable archive, bounded retrieval and about 184 test files (§D). The target design keeps every one of these and removes duplication around them.

## A. Scope and method

**Tree inspected:** `audit-tree` = `main` (`7c6386d`) plus the two reviewed stabilisation PRs (head `3d87e42`; open as PR #225). I inspected `worker/` (58 `.js` files, 14,114 lines, verified with `wc`), `contracts/`, `config/publications.json`, `app/` routes and data libraries, `scripts/`, `.github/workflows/`, `package.json` and `worker/package.json`. I also read the ADRs, `docs/v1/ARCHITECTURE.md`, the operations budget documents and the master plan.

**Live probes (6 Nov 2026, read-only GET):** `/`, `/editions/`, `/section/nhs/`, `/stories/household-budgets/`, `/data/health.json` and `/feed.xml`.

**Platform limits** were checked against current documentation on 6 Nov 2026 (§E). Anything not confirmed there is marked *unverified*.

**Haiku inventories (H1–H7): what I verified and what I corrected**

| Inventory | Claim relied on | Verification | Result |
|---|---|---|---|
| H1 | 58 worker JS files, 14,114 lines; fan-in leaders | `wc -l worker/*.js` | Verified |
| H2 | 12 published (11 + archive), 8 held | read `config/publications.json` | Verified |
| H2 | "6 hard-coded files + up to 8 more" per feed | grep of `realWages`/`real-wages` over non-test, non-generated files | **Understated:** 20 distinct files |
| H3 | 11 daily jobs; 39 KV writes per healthy run | read `publication-plan.js:47-90`, `publication-collection-runner.js:53-76`, `publication-run-lifecycle.js:99,172,240`, `publication-publisher.js:248-257` | Verified (3+10+11+10+1+1+3) |
| H3 | "11 run reads via `enqueueCompletedBootstrapFinaliser`" on daily runs | `publication-run-lifecycle.js:244-246` returns before any read unless the run id starts with `bootstrap-` | **Wrong for daily runs** (0 reads). Fixed daily reads are about 65, not 76 |
| H3 | Queue config, crons, bindings | read `worker/wrangler.toml` | Verified |
| H4 | No `.github/dependabot.yml` | `ls .github` | True, but **Dependabot is enabled in repository settings** (GitHub lists a "Dependabot Updates" dynamic workflow) and runs unconfigured |
| H4 | Two `npm ci` per full run | read `pr-validation.yml` | Verified. Also found root `@opennextjs/cloudflare ^1.20.7` vs `worker/package.json` pinning `1.20.2` |
| H5 | Route sizes, cache headers, health body | re-probed 5 routes | Verified (`/editions/` 861,205 B; `/` 349,735 B; health body identical) |
| H6 | Production snapshot read is request-time with `connection()` | read `app/lib/serverMetricsSnapshot.ts:29,41` | Verified |
| H6 | Generated module 273,371 B, `generatedAt` 1 Oct | `wc -c` and live `/feed.xml` | Verified. Live RSS shows the 27–28 Sep poll |
| H6 | 8 routes lack a route-level gate | route table cross-check | Verified as stated. All 8 are either non-data or filtered downstream (see F2) |
| H7 | Zero-reference files; `createEconomySectionCache`, `readManifest` runtime-unused | grep | Verified |

Other claims in H1–H7 were not individually rechecked; nothing below depends on them. GitHub run history (the 717 PR runs and 53 Dependabot runs) could not be queried, because the session proxy blocks Actions API paths. Those figures come from the owner and are *unverified* here.

**Documentation drift found during verification:**

- `docs/operations/free-resource-budget.md` says only `nationalDebt` is enabled and models 2 Queue deliveries/day. The real figures are 11 sources and 12 deliveries/day.
- The master plan's Wave 1 note cites an atomic `PUBLICATION_COMMIT_KEY`. It exists on `main` (`worker/publication-entry.js:20`) but is removed by the stabilisation PR. The plan should record which protocol is current once #225 is decided.

## B. Current architecture (one page)

```mermaid
flowchart LR
  subgraph Sources
    ONS[ONS / BoE / Find a Tender / YouGov / MiC]
  end
  subgraph DataWorker["pulse-data-worker (crons 03:17 daily, 47 */3)"]
    CRON[scheduled: refreshJobs publishedOnly] -->|sendBatch 11 + finalise +20 min| Q[(Queue public-data-jobs\n7 message types, batch 1, concurrency 1)]
    Q --> DISP[queue-dispatcher → job-runner]
    DISP --> COL[collectors: section-builders.js (9) /\nlive-feed-collectors.js (external) /\ncontracts / comparison]
    COL -->|run fragment + global fragment + terminal\n= 3 KV writes per section| KV[(KV METRICS_CACHE\n18 key families)]
    DISP --> FIN[finalise-run → publishFromCaches]
    FIN -->|reads ~28 fragments, current, status, contracts| KV
    FIN -->|public artifact + current + status (+ archive on change)| KV
    API[fetch: 6 exact /data/* routes\nWorkers Caching, no cross-version] -->|1–2 KV reads; editions 1+2N+U| KV
  end
  ONS --> COL
  subgraph WebWorker["public-data-web (OpenNext, public-data.org/*)"]
    SSR[Next SSR per request\nconnection() + no-store fetch] -->|subrequest| API
    BUILD[(committed app/generated/metricsSnapshot.ts\n1 Oct data)] --> RSS[feed.xml / sitemap at build]
  end
  Browser -->|HTML| SSR
  Browser -->|health.json no-store, every page + hourly| API
  Browser -->|metrics-snapshot.json (some pages)| API
  Pages[(Pages seed fallback)] -.->|recovery fetch| FIN
```

**Clocks.** Observation time (`__observation.observedAt`, period), retrieval time (`source.fetchedAt`), publication time (`meta.generatedAt`) and validity (`validUntil` / `expiresAt`) are kept separate. This is correct and must be preserved.

**Policy inputs.**

- Publication decisions: `config/publications.json` (repository-controlled; a change triggers a deploy).
- Source membership and retrieval policy: `contracts/source-catalog.js`, projected by `worker/feed-registry.js`.
- Observation validity: `worker/observation-contract.js`.
- Currentness: `worker/publication-currentness.js`.
- Route availability: `contracts/publication-policy.js`.

## C. Findings

Severity scale. **High:** blocks scaling or threatens evidence integrity. **Medium:** material cost or drift risk. **Low:** hygiene.

### F1 — Feed registration sprawl (High)

**Evidence.** Non-test, non-generated files naming `realWages` or `real-wages`:

- Code: `contracts/source-catalog.js:525`, `config/publications.json`, `worker/publication-plan.js:11`, `worker/section-builders.js`, `worker/observation-contract.js:161`, `worker/ons-release-calendar.js`
- Contracts: `contracts/section-discovery.json:134`, `contracts/measure-definitions.json`, `contracts/measure-coverage.json`, `contracts/public-surfaces.json`
- App: `app/lib/sectionContent.ts`, `app/lib/sectionDownloads.ts`, `app/lib/sections.ts`, `app/lib/nationalEvidenceSupport.ts`, `app/lib/releaseCalendar.ts`, `app/components/RealWages.tsx`, `HousePriceIndex.tsx`, `ReleaseCalendar.tsx`, `app/cost-of-living/page.tsx`
- Docs: `docs/architecture/source-ownership.json`

That is 20 files, plus 17 test files for the sibling `housePriceIndex`.

Two id vocabularies, camel `realWages` and kebab `real-wages`, are mapped by hand in at least three places. Two families (`governmentContracts`, `internationalComparison`) bypass `SECTION_COLLECTION_PLAN` entirely and are dispatched as special job types (`worker/publication-job-runner.js:18-90`). `taxRevenue` is a special branch inside `refreshSectionPayload` (`worker/publication-entry.js`, collector `tax-revenue-live`).

**Why it blocks scaling.** Every new source means about 15–20 coordinated edits across worker, contracts and app. Missing one is silent until production; for example, a family can be in the registry but absent from discovery. `defineFeed` (`contracts/source-catalog.js`) is already nearly declarative, so the fix is to make it the single source and derive the rest from it.

**Fix.** Target §2: one feed definition file plus one parser per feed, with every other registry derived from them.

### F2 — Duplicated gating, currentness and route logic (High)

**Evidence.**

- Six policy modules, 1,885 lines in total: `contracts/source-catalog.js` (752), `worker/publication-currentness.js` (380), `contracts/publication-policy.js` (379), `worker/observation-contract.js` (220), `worker/publication-availability.js` (115), `worker/freshness-policy.js` (39).
- `filterCurrentSnapshot(` has 19 call sites in 14 files across app, worker and scripts.
- There are 5 overlapping route resolvers: `publicationRouteEnabled`, `productRouteAvailable`, `publicRouteAvailable`, `publicationEnabled` (a pure alias of `publicationPublished`, `contracts/publication-policy.js:32-34,57-59`) and `publicationPublished`. They are called 33 times in 24 app files.
- The app re-implements status and validity checks: `app/lib/useMetrics.ts:191,214-215`, `app/lib/dataExplorer.ts:89`, `app/cost-of-living/page.tsx:15`.
- The 8 routes without a gate in their own file (`/`, `/feed.xml`, `/[trust]`, two money redirects, `/robots.txt`, `/sources` and its layout) are gated, if at all, by convention inside libraries.

**Why it blocks scaling.** Each new route or feed adds another place where "held/stale ⇒ unavailable" must be re-implemented correctly. The integrity rules are only as strong as the weakest copy.

**Fix.** Target §3: one policy module with one `evaluate()` and one `routeAccess()`, and a route manifest test that enumerates every `app/**/page.tsx` and route handler.

### F3 — KV write and read amplification (High at scale, Medium now)

**Evidence (healthy daily run, verified arithmetic).**

| Write | Count | Location |
|---|---|---|
| Run record (create with lease, dispatched, finalised) | 3 | `publication-run-lifecycle.js:99,172,240` |
| Run-scoped section fragment | 10 | `publication-collection-runner.js:59` |
| Global section fragment (same body again) | 10 | `publication-collection-runner.js:74` |
| Job terminal | 11 | `publication-run-lifecycle.js:22` |
| Contracts day shard plus contracts current | 2 | `government-contracts-cloudflare.js:474,620` |
| Public artifact, internal current, status (written even on `no-change`) | 3 | `publication-publisher.js:248,254,257` |
| **Total** | **39** | +3 to +4 on a new edition; +1 per failed attempt; up to +3 rollback |

- Writes per section job: 3. Linear model: about 3·N + 6. At 50 feeds that is about 156/day healthy; with 3 retries on 10% of jobs it is about 170.
- The free allowance is 1,000/day across the account (verified). The 29 Sep incident shows the account has already exceeded it.
- `main` before #225 also wrote a history record and a commit manifest, so 41 writes per run.

**Reads.**

- The finaliser reads about 2 candidates × 14 sections, plus about 7 fixed reads and 11 terminals (`publication-publisher.js:44-70`).
- Health reads 2 keys per request (`public-data-entry.js:526-527`) and is `no-store`. It is fetched by `SectionNav` on 18 page modules on every page load and then hourly (`app/lib/usePublicationHealth.ts:35,71,82`).
- The 18 key families include 2 legacy families with no runtime writer (`v10:section:*`, `v10:manifest`).

**Fix.** Target §4: one record per feed, with the attempt status folded into it, and one public artifact whose metadata carries the health summary. That gives about N + 2 writes and 1 read per health check.

### F4 — Queue fan-out complexity (Medium)

**Evidence.**

- 7 message types: `bootstrap-publication`, `finalise-run`, `finalise-international-comparison`, `refresh-international-comparison`, `refresh-section`, `refresh-external-section`, `refresh-contracts` (`publication-queue-dispatcher.js:34-232`, `publication-job-runner.js:18-92`).
- 4 runner modules: dispatcher, job-runner, comparison-runner (256 lines), collection-runner.
- There is a separate comparison batch manifest and base keys, and a separate bootstrap finaliser path.
- Consumer settings: `max_batch_size 1`, `max_concurrency 1`, no DLQ (`wrangler.toml:60-66`).
- The finaliser waits a fixed 20 minutes with a 25-minute deadline (`publication-run-lifecycle.js:75-76`). Eleven jobs run serially, and their real durations are unmeasured.
- Queue operations are well inside the 10,000/day free allowance (verified): about 12 messages × about 3 operations each.

**Why it blocks scaling.** Each "special" family (sharded contracts, batched comparison) adds a message type plus bookkeeping. With concurrency 1 and a fixed deadline, more feeds raise the chance of `incomplete` finalisation.

**Fix.** Keep Queues, collapse to 3 message types (`collect`, `finalise`, `bootstrap`), and let a feed declare `shards` instead of having its own runner (target §5).

### F5 — SSR per request for mostly static content (High)

**Evidence.**

- In production, `readServerMetricsSnapshot` calls `connection()` and fetches `https://public-data.org/data/metrics-snapshot.json` for every request (`app/lib/serverMetricsSnapshot.ts:12-13,29,41`).
- 13 page and route files use it: `app/page.tsx:13`, `section/[id]/page.tsx:89`, `money/page.tsx:22`, `calendar/page.tsx:20`, `cost-of-living/page.tsx:14`, `explore/page.tsx:20`, `briefing/page.tsx:19`, `compare/page.tsx:18`, `measure/page.tsx:29`, `measure/[id]/page.tsx:21`, `stories/[slug]/page.tsx:37`, `sources/[id]/page.tsx:87`, `data/sections/[file]/route.ts:22` (spot-checked).
- Browser-side, `fetchMetricsSnapshot()` (`app/lib/metricsSnapshot.ts:120-161`) refetches the snapshot from `useMetrics.ts:302`, `DataExplorer.tsx:672` and `NationalEvidenceEdition.tsx:96`. `usePublicationHealth` (`app/lib/usePublicationHealth.ts:71,82`) polls health from `PublicationFreshnessIndicator`, which `SectionNav.tsx:103` renders on 18 page modules.
- Live HTML is `private, no-store` and large: `/` 350 KB, `/explore/` 692 KB, `/compare/` 766 KB, `/calendar/` 680 KB, `/editions/` 861 KB.
- Per page view: 1 web Worker invocation with full React SSR, plus 1 data-Worker subrequest, plus 1 browser health request (2 KV reads), plus a browser snapshot request on Explorer/edition components. That is about 3–4 Worker requests.
- The account had at least 1,000 CPU-limit exceptions on 20 Oct (`docs/operations/cloudflare-resource-budget-recovery.md`). Attribution to this repo remains *unverified*.
- Cloudflare bills Worker-cache hits as requests (pricing page, verified), so edge-caching SSR output does not relieve the 100k/day cap. Static asset requests are "free and unlimited" and do not invoke the Worker by default (verified).

**Why it blocks scaling.** More reports mean more and larger SSR pages on a 10 ms CPU budget, inside a request cap shared with other account Workers.

**Fix.** Target §6: build evidence pages statically per edition, with a near-zero-CPU validity gate.

### F6 — Edition archive read path is O(N × edition size) per request (High)

**Evidence.**

- `listEditionSummaries` (`worker/edition-archive.js:305-328`) calls `readEditionRaw` for every index entry.
- `readEditionRaw` reads the full content blob, computes SHA-256 over it and `JSON.parse`s and validates the catalog (`:170-183`).
- Live `/data/edition.json` is 285 KB. Retention is up to 60.
- The list is cached for only 60 s per colo (`public-data-entry.js:389`). Detail reads are `no-store` (`:399`).
- `/editions/` HTML is 861 KB and slowest at 1.96 s (H5, re-probed).
- The daily publisher also re-reads retained editions in `reconcileRetainedEditionSummaries`.

**Why it blocks scaling.** Cost grows with history, so the archive gets slower and riskier as the product succeeds. CPU per uncached request was not measured; at N ≥ about 5 it is likely to exceed 10 ms *(unverified, needs measurement)*.

**Fix.** Verify integrity once at write time and serve the index (summaries plus hashes) from a single read. Edition detail becomes immutable and cacheable by id. Paginate `/editions/` (target §4.3, §6).

### F7 — Committed generated snapshot drives RSS and sitemap with expired evidence (High, integrity)

**Evidence.**

- `app/generated/metricsSnapshot.ts`: 273,371 B, tracked, `generatedAt` 1 Oct.
- `build:prepare` runs the generator with `--optional-missing` (`package.json:26`). The deploy never supplies `public/data/metrics-snapshot.json`; it is only fetched in the manual Pages-seed path (`deploy.yml:161-169`). So the committed file is the build input.
- `/feed.xml` (`force-static`) and the sitemap read it. `getBuildPublication` checks `status === "ok"` but not validity (`app/lib/discovery.ts:58-70`).
- **Live today:** `/feed.xml` titled "latest verified evidence" lists polling for "2026-09-27/2026-09-28". The live snapshot holds 2026-11-01/02.
- The committed module also retains `meta.publicationDiagnostics`, which `publicSnapshot()` strips. It therefore cannot be the generator's output, and its provenance is unknown.

**Why it matters.** It breaks "stale evidence is unavailable" in a syndicated channel, and it creates a second, unreconciled publication clock.

**Fix.** Untrack the module. Build-time artifacts must come from the current committed public artifact or render no evidence (target §7). This is fixed early as a low-risk win.

### F8 — Health semantics conflate policy holds with failures (Medium)

**Evidence.**

- Live: `{"status":"degraded","ready":false,"missingRequiredSections":["housePriceIndex","nhsStats"],...}`.
- `nhsStats` is held in config but `publicationRequirement: "required"` (`contracts/source-catalog.js:557`). `REQUIRED_PUBLISHED_SECTION_IDS` ignores publication state (`worker/feed-registry.js:37-39`).
- Health therefore cannot return `ready` while any required source is deliberately held. `housePriceIndex` is published but has no current observation, which is a real gap, yet it is indistinguishable from the policy hold.

**Fix.** "Required" means required among *published* feeds. Report `held` separately and keep the absent data unavailable. This is a public-contract change, so it needs user sign-off (decision gate G5).

### F9 — Dead, duplicate and legacy code (Low–Medium)

**Evidence (all verified by grep).**

- `worker/economy-section-cache.js` `createEconomySectionCache` and the `v10:section:*` writer: tests only.
- `worker/health-report.js`: tests and a comment only. `readManifest`/`v10:manifest` have no writer.
- `app/components/WithdrawnEvidence.tsx`: no references.
- Unreferenced scripts: `ensure-cloudflare-pages-domain.mjs`, `fetch-betting-odds.mjs`, `prepare-election-poll-ingest.mjs`, `prepare-nhs-rtt-ingest.mjs`, `verify-uk-context-route.mjs`.
- Unused vars `DATA_REFRESH_TTL_SECONDS` and `DATA_STALE_TTL_SECONDS` (`wrangler.toml:20-21`).
- Re-export shims: `worker/betting-markets.js`, `worker/crime-statistics.js`, and `queued-publication-entry.js` re-exports about 25 names.
- Duplicate helpers: `isRecord` ×13, `decodeHtml` ×9 (bodies differ), `isoDate` ×11, `parseCsvColumns` ×4. Duplicate XLSX/zip readers: `live-nhs-collector.js` vs `xlsx-workbook.js`. Duplicate NHS press-notice parser: `worker/nhs-press-notice.js` vs `scripts/nhs-rtt-parser.mjs`, which are not identical.
- PR validation still targets the stale branch `codex/hermes-v1` (`pr-validation.yml:5`). GitHub still lists `evidence-source-probe.yml` and `nhs-source-probe.yml` as active workflows, although the files are gone.

**Why it matters.** Diverging duplicate parsers are a correctness risk; for example, `decodeHtml` differs between `economy-evidence.js` and `national-debt.js`.

**Fix.** Workstream 0/1 deletions plus one shared parsing kit (target §2.3).

### F10 — GitHub Actions footprint (Medium)

**Evidence.**

- The repo is **public** (REST API). Standard GitHub-hosted runners are free in public repositories (GitHub billing docs, verified). Cache storage is 10 GB per repo (verified). Artifact-storage terms for public repos are *unverified*.
- A docs-only PR spins up 3 runner jobs (`classify`, `docs`, `quality`). A code PR spins up 3 (`classify`, `full-quality`, `quality`).
- `full-quality` runs:
  - static/source guards;
  - `npm ci` for the root (945 lock entries);
  - `build:prepare`;
  - a second `npm ci --prefix worker` (459 lock entries) for a *different* `@opennextjs/cloudflare` version: `1.20.2` pinned vs root `^1.20.7`, symlinked over the root copy;
  - lint, the **entire** vitest suite (184 test files) and a full OpenNext build, on every push.
- `deploy.yml` repeats both installs and a full build on every relevant `main` push.
- Dependabot has no config, so no grouping, cadence or open-PR limit, and there are two lockfiles to update.
- 717 PR runs and 53 Dependabot runs reported by the owner: *unverified* here (API blocked).

**Fix.** Workstream 0 in the plan:

- a single `quality` job;
- path lanes;
- the full suite in every code lane, but no build for worker-only changes that `app/` does not import (affected-only `vitest --changed` was considered and rejected: 27 test files read the source tree directly, so it would miss them);
- build only when build inputs change;
- one lockfile;
- grouped monthly Dependabot;
- optional move of deploys and edition rebuilds to Cloudflare Workers Builds (3,000 free minutes per month, verified).

### F11 — Live-site observations (Medium)

**Evidence.**

- `/stories/household-budgets/` (held story) is titled "Data publications are temporarily offline". That copy implies a site-wide outage while 11 families are live.
- That page and `/section/nhs/` advertise `s-maxage=31536000, stale-while-revalidate=2592000`, so shared caches may retain a held notice for a year after a source is restored. Whether Cloudflare's edge honours this for Worker responses is *unverified*.
- `/data/health.json` is `no-store` and polled by every page (F3).
- `/data/international-comparison.json` returns 503 `publication_disabled` while held. That is correct fail-closed behaviour.
- `/section/crime-stats/` shows "temporarily unavailable" for a published family with no current observation. That is correct.
- Security headers on `/` are good (CSP, HSTS preload, XFO, nosniff, Referrer-Policy, Permissions-Policy). CSP still allows `'unsafe-inline'` for scripts.

- `/data/metrics-snapshot.json` sends `stale-while-revalidate` equal to the remaining validity (`public-data-entry.js:48-54`; live about 50,000 s). `/feed.xml` sends `max-age=3600` (`app/feed.xml/route.ts:11`).

**Fix.** Held notices name the specific held publication. Every evidence-bearing or config-filtered response has a total cache lifetime of ≤300 s (target §6.4; main plan Task 2b, independent of static-first).

### F12 — Two-Worker, three-delivery-path topology (Low–Medium)

**Evidence.** There are three ways the reader can receive evidence:

- the OpenNext web Worker with SSR (`web-wrangler.toml`);
- the data Worker API (`wrangler.toml`);
- the Pages seed fallback, which also feeds publisher recovery (`publication-recovery.js`, `STATIC_SNAPSHOT_SEED_URL`).

The static-export branch (`STATIC_EXPORT === "true"`) already exists for the Pages seed (`serverMetricsSnapshot.ts:20-25`).

**Fix.** One static asset build per edition, served by one small Worker. The data Worker keeps collection and the bounded API. The Pages seed retires after cutover (decision gate G8).

## D. What is already good and must be preserved

- **Fail-closed publication policy.** Unknown ids are disabled. Held families stay out of snapshots, archive responses, downloads and APIs. The data Worker returns 503/no-store before any KV read for gated routes (`public-data-entry.js:574-576`). Errors are never cached.
- **Currentness semantics.** Observation, retrieval, publication and validity clocks are separate. Stale or missing evidence is dropped, never zero-filled. Older evidence is reused only within its original validity (`publication-publisher.js:44-70`, `storedFragmentWins`).
- **Run isolation and monotonic fragments** (#225). Write-ahead dispatch lease. Retries cannot turn failure into success (`finaliseRun` marks `incomplete`).
- **Immutable edition archive.** Content-addressed bodies, write-once summary corrections, 60-entry retention.
- **Bounded, untrusted retrieval.** Approved host allowlist, manual redirect checks (`response-limits.js`), size caps, `global_fetch_strictly_public`, workbook expansion limits.
- **Held feeds are not collected on schedule** (22 Oct containment). Cron no-ops cost 0 KV and 0 Queue operations.
- **Workers Caching with `cross_version_cache = false`**, so a policy-changing deploy never serves old cached responses.
- **Tests and guards:** 63 Worker and 121 unit test files, `check-static-architecture.mjs`, `check-source-ownership.mjs`, the workflow allow-list test and the PR lane test. These are the safety net for the migration and must all pass at every step.
- **Exact data-Worker route table** and the public-surface contract.
