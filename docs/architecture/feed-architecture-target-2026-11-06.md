# Feed architecture target design — 6 November 2026

**Status:** Proposed. It needs owner review before any implementation, and it changes no publication state.
**Inputs:** [review](feed-architecture-review-2026-11-06.md), `docs/v1/MASTER-DELIVERY-PLAN.md` (Wave 1
"consolidate foundations"), `AGENTS.md` evidence rules, and issue #218 (static-first, per-Worker attribution,
KV writes well below 1,000/day).
**Plan:** [`docs/superpowers/plans/2026-11-06-feed-architecture-simplification.md`](../superpowers/plans/2026-11-06-feed-architecture-simplification.md).

## Summary for the owner

1. **Adding a feed** means 3 hand-edited files: `feeds/<id>/feed.js` (declarative definition), `feeds/<id>/parse.js` (collector/parser) and one guarded line in `feeds/index.js`. The same PR also carries regenerated projections (`section-discovery.json`, `measure-definitions.json`, `public-surfaces.json`, `source-ownership.json`), which are produced by a script and drift-checked in CI. Routes are derived from the definitions. A feed with a bespoke view also needs its component. The feed is held by default until you authorize it.
2. **One policy module.** `contracts/evidence-policy.js` decides `current | unavailable | held` and route access. The worker, app, build and scripts all call it; there are no copies.
3. **One pipeline with 3 Queue message types:** `collect`, `finalise`, `bootstrap`. Queues stay, because the 10 ms cron CPU budget cannot run parsers. Contracts and comparison become ordinary sharded feeds. Collector CPU is **measured on the existing pipeline before any rewrite**.
4. **KV goes from 18 key families to 5.** Writes per healthy run go from **39 to 16** (11 feeds; the run record keeps its 3 idempotency writes). At 50 feeds the target is about 55/day, about 6% of the free allowance.
5. **Static-first delivery (Workstream 5) is conditional** on your go/no-go (G9), taken on measured per-Worker traffic and CPU. If approved, each committed edition is built once into static assets by Cloudflare Workers Builds, the single deployer of the static Worker (free tier, 3,000 min/month). Builds always use the last release-verified commit.
6. **Fail-closed without JavaScript, for every evidence-bearing file.** Evidence routes — HTML, Next RSC payloads, edition JSON, section downloads, RSS and sitemap — pass through a tiny asset-gate Worker. It serves a pre-built "unavailable" variant once embedded evidence expires, or once a feed is held after the build. A hold takes effect through a gate-only redeploy that does not need the full rebuild. The gate does no SSR and reads no KV.
7. **Per page view:** about 3–4 Worker requests and 2–3 KV reads today. Target: 1 Worker request for a full evidence page load, plus 1 per gated RSC/JSON fetch on client navigation, and 0 KV reads. Non-evidence pages cost 0 requests.
8. **Archive:** the list is served from one index read, with integrity verified at write time. Edition detail stays policy-filtered at request time, so it gets a short `max-age=60` plus an ETag tied to the publication config, never a long immutable lifetime. `/editions/` is paginated.
9. **The generated snapshot module is deleted.** RSS, sitemap and downloads are produced by the edition build from the current committed artifact, or carry no evidence.
10. **Strangler migration** in independently shippable, revertible steps. Production keeps working at every step. The cutovers (static Worker route, KV key switch, health contract) are explicit owner decisions.

## 1. Design principles (non-negotiable)

- AGENTS.md evidence rules are unchanged:
  - Missing, stale, incomplete or unreconciled evidence is *unavailable*, never zero or interpolated.
  - Held evidence is never served.
  - There are no synthetic totals.
  - Observation, retrieval, publication and validity clocks stay separate.
  - Official statistics, administrative records, polling and markets stay distinct.
- Publication decisions remain only in `config/publications.json` and change only with explicit user authorization (master plan invariant).
- Cloudflare free tier only. Durable Objects, D1 and R2 have free tiers (verified) but are **not** adopted (§10).
- Every simplification step is backward compatible, tested and revertible on its own.

## 2. Feed definition: one file and one parser

### 2.1 Layout

```
feeds/
  index.js                 // export const FEEDS = [realWages, gdpTracker, ...]  (one line per feed; guarded by test)
  _kit/                    // shared, tested building blocks (fetch, html, csv, xlsx, pdf, ons-bulletin, dates)
  real-wages/
    feed.js                // defineFeed({...})  — the only declaration
    parse.js               // export async function collect(ctx): Promise<FeedResult>
    fixtures/              // captured upstream samples for tests
  government-contracts/
    feed.js                // declares shards: { kind: "day", window: 7 }
    parse.js               // export async function collectShard(ctx, shardKey); export function combine(shards)
```

### 2.2 `defineFeed` schema (extends today's `contracts/source-catalog.js` `defineFeed`)

| Field | Replaces | Notes |
|---|---|---|
| `id` (camel), `slug` (kebab route id) | manual camel↔kebab maps in publications/sections/discovery/surfaces | `slug` is the single route id |
| `title`, `displayName`, `description`, `category`, `evidenceClass`, `geography`, `editorial{unit, caveat, revisionStatus, publicationPeriod}` | source-catalog, section-discovery.json, sectionContent.ts metadata | |
| `sources: [sourceId]` | source-catalog `sourceIds` (sources stay in `SOURCE_CATALOG`; host allowlist derived from it) | |
| `cadence: {collect: "daily" \| "3h" \| "weekly", publication}` | `refreshCadence`, `publication-schedule.js`, `SECTION_COLLECTION_PLAN` | due-ness computed, not listed |
| `validity: {retrievalMaxAge, observationMaxAgeDays \| maxAgeHours \| explicitExpiry}` | `observation-contract.js` `OBSERVATION_CONTRACTS`, `retrievalMaxAgeMs` | consumed only by the policy module |
| `requirement: "required" \| "optional" \| "independent"` | REQUIRED/OPTIONAL lists | evaluated only among *published* feeds |
| `measures: [ {id, label, unit, …} ]` | `contracts/measure-definitions.json`, `measure-coverage.json` entries | JSON contracts become generated projections, checked in CI for drift |
| `downloads: {json: true, csv: columns}` | `app/lib/sectionDownloads.ts` | |
| `releaseTitles: [RegExp source]` | `ons-release-calendar.js` `RELEASE_FAMILIES`, `app/lib/releaseCalendar.ts` | |
| `shards?: {kind, window}` | contracts day-shard runner, comparison batch runner | generic sharded collection |
| `view: "series" \| "polling" \| "contracts" \| <ComponentKey>` | `SECTION_CONTENT` entries | generic series view by default; bespoke component optional |

**Publication state is deliberately not in the definition.** A feed absent from `config/publications.json` is held, so unknown ids still fail closed. It is not collected on schedule, not routed and not built. Publishing it is the separate, user-authorized one-line config change.

### 2.3 Parser interface

```ts
type FeedContext = { fetch: BoundedFetch; now: Date; feed: FeedDefinition; previous: FeedRecord | null };
type FeedResult = { data: object; observation: { period: string; observedAt: string; publishedAt: string | null };
                    source: { url: string; fetchedAt: string; edition?: string } };
export async function collect(ctx: FeedContext): Promise<FeedResult>;              // throws on any shape/identity failure
// sharded feeds only:
export async function collectShard(ctx: FeedContext, shardKey: string): Promise<object>;
export function combine(shards: Record<string, object>, ctx: FeedContext): FeedResult;
```

`BoundedFetch` wraps the existing `response-limits.js` and `approved-source-hosts.js`; hosts are derived from `sources`. `feeds/_kit/` absorbs the duplicated helpers listed in review F9: `decodeHtml` ×9, `isoDate` ×11, `parseCsvColumns` ×4, two XLSX readers, ONS bulletin discovery ×3.

### 2.4 Derived projections (no hand edits)

`feeds/registry.js` exports pure functions that rebuild today's shapes from `FEEDS`:

- `FEED_CATALOG`
- `SECTION_COLLECTION_PLAN`
- `OBSERVATION_CONTRACTS`
- `REQUIRED_PUBLISHED_SECTION_IDS`
- section-discovery `sections`
- `SECTION_DOWNLOAD_IDS`
- `RELEASE_FAMILIES`
- measure definitions

During migration, parity tests assert that each projection is deep-equal to the current hand-written object, so the old modules can be replaced by re-exports and then deleted. `contracts/public-surfaces.json` topics and `docs/architecture/source-ownership.json` are generated by `scripts/generate-feed-projections.mjs`, and CI checks for drift.

## 3. Single policy and currentness module

`contracts/evidence-policy.js` (isomorphic JS, no Node or DOM APIs) replaces the decision logic in `publication-currentness.js`, `freshness-policy.js`, `observation-contract.js`, `publication-availability.js` and the route parts of `publication-policy.js`.

```ts
type Decision = "published" | "held" | "retired";
type Verdict = { state: "current" | "unavailable" | "held"; reason: UnavailableReason | null; validUntil: string | null };
// SectionRecord = the inner verified section record ({section, data, source, __observation...}) — NOT the
// storage wrapper FeedRecord {feedId, record, lastAttempt} of §4.1. Callers pass `feedRecord?.record ?? null`.
export function decisionFor(feedId: string, config?: PublicationConfig): Decision;          // unknown → "held"
export function evaluate(feed: FeedPolicyInput, record: SectionRecord | null, decision: Decision, now: Date): Verdict;
export function projectPublic(edition: InternalEdition, now: Date, config?: PublicationConfig): { snapshot: PublicSnapshot | null; validUntil: string | null };
export function routeAccess(route: RouteEntry, now: Date, verdicts: Record<string, Verdict>): "serve" | "unavailable" | "not-found";
// RouteEntry = { path: string; kind: "static" | "evidence" | "api"; feeds: string[]; gate: "none" | "any-published" | "all-of" | "product" }
```

- `evaluate` is the only place that turns clocks into availability. Boundary rule: `now >= validUntil` ⇒ unavailable. A clock skew above `MAX_CLOCK_SKEW_MS` ⇒ unavailable.
- The order is fixed: decision first (held wins), then shape, then retrieval age, then observation validity.
- `projectPublic` returns `snapshot: null` when no feed is current. Callers render the unavailable state and never fall back to older data.
- **Route manifest.** `routeManifest()` in `feeds/registry.js` returns the full `RouteEntry[]`:
  - per-feed entries come from `FEEDS`: `/section/<slug>/` (gate `all-of`, feeds `[id]`), `/data/sections/<slug>.json|csv`, and every multi-feed page that lists the feed;
  - `contracts/routes.json` holds only the hand-written non-feed routes, e.g. `/`, `/compare`, `/sources`, `/[trust]`;
  - gate `product` covers routes controlled by a product capability rather than a feed, e.g. stories and the edition archive.

  A new feed therefore needs no manifest edit.
- One test enumerates `app/**/page.tsx`, `route.ts`, `sitemap.ts` and `robots.ts` and fails if any route is missing from `routeManifest()`. This closes the "8 routes without a gate" gap mechanically.
- Pages call one wrapper, `gateRoute(path)`, instead of 33 ad-hoc checks.

## 4. Minimal state: KV keys and writes

### 4.1 Key families

| Target key | Content | TTL | Replaces |
|---|---|---|---|
| `v20:feed:<feedId>` | latest *verified* record and `lastAttempt {runId, at, status, reason}` | none | run fragment, global fragment, terminal, `v12:section:governmentContracts` |
| `v20:feed:<feedId>:shard:<key>` | shard payload (sharded feeds only) | window + 3 d | `v12:contracts:day:*`, comparison batch/base keys |
| `v20:run:<runId>` | `{createdAt, deadlineAt, expectedFeeds, jobsEnqueuedAt, dispatchedAt, finalisedAt, status}` — the same write-ahead lease and idempotency markers the code relies on today (`publication-run-lifecycle.js:121` returns early when `dispatchedAt` is set; `:191` returns `alreadyFinalised` when `finalisedAt` is set) | 14 d | `v13:publication:run:*` (3 writes per run: create with lease, dispatched, finalised) |
| `v20:edition:public` | public artifact body. **Metadata** (KV limit 1,024 B, verified): `{v:1, e:editionId, g:generatedAt, u:validUntil, s:state, m:"id,…", h:"id,…", x:"id:code,…"}`. `x` packs each unavailable section with a 1-char reason code (`n` no-current-observation, `c` collector-failed, `s` not-scheduled, the three `UNAVAILABLE_REASONS` at `publication-availability.js:24-28`). An unknown reason fails closed | none | `v14:publication:public`, `v12:publication:status`, `v12:publication:current` |
| `v20:edition:health` | full health detail `{editionId, missingRequired[], held[], unavailable[{id,reason}]}`, written **only** when the id lists do not fit in metadata | none | — |
| `v1:edition:index`, `v1:edition:content:<sha>`, `v1:edition:summary-correction:<id>` | unchanged immutable archive (new editions stop writing the separate summary key; the index already holds summaries) | none | `v1:edition:summary:*` (read-only for existing editions) |

**Rules:**

- A feed record is replaced only by a newer *verified* record. The existing monotonic rule (`storedFragmentWins`) moves here unchanged.
- A failed attempt updates only `lastAttempt`, and the prior evidence remains usable only within its own validity.
- The internal "current" record is dropped. The finaliser rebuilds the edition from feed records every run, so there is no second copy to reconcile.
- **Health body parity.** `healthBodyFromMetadata` reproduces today's public body exactly, including `unavailableSections: [{id, reason}]`, from `m`, `h` and `x`. No reason is lost.
- **Metadata byte budget.** Measured by serialising the compact record with `JSON.stringify` (no whitespace) using the real feed ids, edition id format and ISO timestamps:

  | State | Size | Result |
  |---|---|---|
  | Live today: 2 missing-required, 6 held, 2 unavailable | **285 B** | fits |
  | 17 feeds, worst case: all 17 unavailable, 10 missing-required, 6 held | **640 B** by my measurement (the Chief of Staff measured about 683 B under slightly different assumptions) | fits |
  | 50 feeds, worst case (estimated at about 18 B per `x` entry and 16 B per id) | about 2.1 KB | overflows |

  The r2 figure of about 190 B omitted the held list.
- **Metadata overflow fails closed.** When the metadata would exceed 1,000 B, `buildHealthMetadata` writes only `{v,e,g,u,s,t:1}`. The full detail `{editionId, missingRequired[], held[], unavailableSections[{id,reason}]}` goes to `v20:edition:health`, which costs +1 write only on overflow runs.
  - Health reads the metadata (1 read). When `t:1`, it also reads `v20:edition:health` (2 reads).
  - If that key is missing or its `editionId` differs, health reports `{status:"degraded", ready:false, degraded:true}`. It never reports `ready`.
  - A 50-feed test exercises this path.
- **Rollback after legacy writes stop (G4)** fails closed but degrades. The previous data Worker would read v12 fragments that are no longer refreshed. Those fragments are served only within their own validity, then become unavailable. This is a stated trade-off, not a silent one.

### 4.2 Writes per healthy daily run

| Item | Today | Target | Target at 50 feeds |
|---|---|---|---|
| Run record (create + lease, dispatched, finalised) | 3 | 3 (kept for idempotency) | 3 |
| Per collected section (fragment ×2 + terminal) | 30 (10 × 3) | 10 (10 × 1) | 49 |
| Contracts (shard + current + terminal) | 3 | 2 (shard + feed record) | 2 |
| Publish (public + current + status) | 3 | 1 (public, health in metadata) | 1 (+1 `v20:edition:health` on metadata overflow) |
| **Healthy total** | **39** | **16** (11 feeds: 3 + 10 + 2 + 1) | **55** (56 on overflow) |
| Dual-write window (Task 9, about 7 days) | — | about 49 (16 + legacy 33) | — |
| New edition | +3 (content, summary, index) | +2 (content, index) | +2 |
| Each failed attempt | +1 terminal | +1 (`lastAttempt`) | +1 |
| Worst case (every job fails 4×, new edition) | about 39 + 33 + 3 = 75 | about 16 + 33 + 2 = 51 | about 255 |

All target figures stay below 26% of the 1,000/day free allowance even in the 50-feed worst case, which leaves room for other Workers on the account. The plan's acceptance test fixes the healthy figure at **≤ 16 for the current 11 published families** and ≤ 60 at 50 feeds.

### 4.3 Reads

- Finaliser: N feed records + 1 index + 1 public, which is 13 today against about 65 now.
- API:
  - `/data/metrics-snapshot.json`: 1 read (edge cache ≤300 s, capped by validity).
  - `/data/health.json`: 1 read (`getWithMetadata`), or 2 when metadata is truncated.
  - `/data/editions.json`: 1 read.
  - `/data/edition.json?edition=`: 1–2 reads.
    - **Cache policy:** `public, max-age=60` with `ETag: "<contentHash>.<publicationConfigHash>"` and `If-None-Match` → 304.
    - **Why not immutable:** the archived *content* is immutable, but the *response* is filtered by `filterPublicationCatalog`/`filterPublicationSummary` against the deployed `config/publications.json` at request time (`public-data-entry.js:399`, `no-store` today).
    - A hold changes the config hash, and so the ETag. Browser and shared caches can hold a superseded response for at most 60 s, which matches today's `/data/editions.json` list policy.
    - `cross_version_cache = false` isolates only the Workers cache. It does not purge browser or downstream shared caches, so no config-filtered response may carry a long lifetime.
- Reader page views: 0 KV reads.

## 5. Single publication pipeline

```mermaid
flowchart LR
  CRON[cron 03:17 daily / 47 */3] -->|dueFeeds(now) ∩ published| RUN[write v20:run:id\nsendBatch collect×N\nsend finalise +delay]
  RUN --> Q[(Queue: collect | finalise | bootstrap)]
  Q -->|collect feedId [shard]| P[feeds/id/parse.js via BoundedFetch]
  P --> V[validate shape + identity + reconcile]
  V -->|1 write| FK[(v20:feed:id)]
  Q -->|finalise runId| F[read feed records → evaluate() → projectPublic()]
  F -->|1 write + archive on change| PUB[(v20:edition:public, archive)]
  F -->|editionId changed OR min validUntil < now+36h| HOOK[POST Workers Builds deploy hook]
  HOOK --> BUILD[static edition build] --> ASSETS[(Workers Static Assets)]
```

- **Queues are kept.** Free tier verified: 10,000 operations/day and 24 h retention. The cron's 10 ms CPU limit (verified) cannot run XLSX, PDF or bulletin parsers, and per-feed messages give isolation and retries.
- **Message types collapse from 7 to 3.**
  - `collect {runId, feedId, shard?}`
  - `finalise {runId, deadlineAt}`
  - `bootstrap {scope: "bootstrap", feeds?, force?, includeContracts?, comparisonRefresh?}`

  Sharded feeds enqueue `collect` per missing shard; the last shard, or the finaliser, calls `combine`.
- **Idempotency is preserved.** The run record keeps the #225 write-ahead dispatch lease:
  - `jobsEnqueuedAt` is written before `sendBatch`;
  - `dispatchedAt` is written after both sends;
  - a redelivered bootstrap that finds `dispatchedAt` never re-sends.

  `finalisedAt` stays as well: a redelivered `finalise` after success writes nothing.
- **Finaliser completeness** reads `lastAttempt.runId` on each expected feed record, so there are no terminal keys. The deadline behaviour is unchanged: when the deadline passes with ≥1 success, the run finalises with the current verified subset and records `incomplete`. A retry never converts failure into success.
- **The deadline is derived, not fixed:** `deadline = createdAt + max(25 min, Σ measured p95 job duration × 1.5)`. The fixed 20/25-minute window with concurrency 1 would mark runs `incomplete` at about 50 feeds.
- **Consumer settings.** Keep `max_concurrency 1` and add a dead-letter queue (`public-data-jobs-dlq`, free) so exhausted messages stay observable.
- **Queue consumer CPU on the free plan (verified 6 Nov 2026, developers.cloudflare.com/queues/platform/limits/):** consumer CPU time defaults to 30 s and is configurable up to 5 min (`limits.cpu_ms`). The page lists no Free/Paid difference; only queue counts and message retention differ. The 10 ms Free CPU limit applies to HTTP requests and Cron Triggers, not queue consumers. Per-feed measurement (Task 8) is still required, because the design depends on real parser durations.
  - Main plan Task 8 measures `cpuTime` per job with `wrangler tail` on the **existing** pipeline, before any pipeline rewrite (plan Tasks 9–10). The finaliser's build-and-hash of a 50-feed artifact (about 2 MB) is measured too.
  - A feed that cannot fit goes to the owner for a hold or cost decision (G-CPU). It is never masked by retries (`docs/operations/cloudflare-resource-budget-recovery.md` §7).
- **Worker script size.** About 50 parsers plus `_kit` in one data Worker bundle. Each feed batch records `wrangler deploy --dry-run --outdir` size, and CI fails above 80% of the Free-plan script-size limit. Verified 6 Nov 2026 (developers.cloudflare.com/workers/platform/limits/): the Free plan Worker size limit is 64 MiB uncompressed and the page states there is no compressed size limit. The earlier assumption of a binding 3 MB compressed limit was wrong. The 80% guard is therefore a regression check, not a binding constraint at about 50 parsers. Splitting collectors into a second Worker stays the fallback.
- **Subrequests (verified 6 Nov 2026).** The Free plan allows 50 subrequests per invocation (internal-service subrequests such as KV: 1,000). A collector job that fetches more than about 40 external URLs cannot be relied on to run on Free. Task 8 records the external fetch count per job; a job over 40 is split into more jobs or goes to G-CPU.

## 6. Static-first delivery (conditional on owner gate G9)

**Implemented by the follow-up plan** [`2026-11-06-static-first-delivery.md`](../superpowers/plans/2026-11-06-static-first-delivery.md) (Tasks 13–16, 17b), which is not executable until G9. The main plan [`2026-11-06-feed-architecture-simplification.md`](../superpowers/plans/2026-11-06-feed-architecture-simplification.md) does not depend on this section. Below, "plan Task 13–16" refers to the follow-up plan.

Workstream 5 adds a third Worker, two build variants per route and a build hook. It starts only after you decide go/no-go (**G9**), based on:

- measured per-Worker requests and CPU in Cloudflare analytics (issue #218), showing that SSR on `public-data-web` is a material cost or CPU-limit driver.

The measured edition build time (§6.3) is **not** a G9 input, because it can only be measured after G9. It is the entry criterion of G3, the gate before anything deploys to Cloudflare.

If G9 is no-go, Workstreams 0–4 still stand on their own. The cheaper fallback is to remove the browser health poll and snapshot refetch from reader pages, which is Task 13's client change, applied alone.

### 6.1 Route classes

| Class | Routes | Delivery | Worker invoked? |
|---|---|---|---|
| Static | `/sources`, `/sources/[id]` (prose and provenance), `/[trust]` pages, `/robots.txt`, `/money/buyer\|supplier/[id]` redirects (`_redirects`, *unverified support, else gate Worker*), stories prose shells, fonts, images, JS/CSS | Workers Static Assets (asset-first) | No |
| Evidence (edition-static) | **Every evidence-bearing file**, not only HTML:<br>• HTML of `/`, `/section/[slug]`, `/measure`, `/measure/[id]`, `/explore`, `/compare`, `/briefing`, `/cost-of-living`, `/money`, `/calendar`, `/stories/[slug]`, `/editions`, `/editions/[id]`;<br>• the Next export **RSC payload files** for those routes (`*.txt` / `__next.*` flight data fetched on client navigation);<br>• `/_edition/<id>/*.json` (Explorer and freshness data);<br>• `/data/sections/*.json\|csv`;<br>• `/feed.xml`;<br>• `/sitemap.xml` | pre-rendered per edition by `next build` with `output: "export"` (the existing `STATIC_EXPORT` path) | Yes, via the gate (`run_worker_first` patterns generated from the manifest), about 1 ms, 0 KV |
| API (data Worker, unchanged surface) | `/data/metrics-snapshot.json`, `/data/health.json`, `/data/editions.json`, `/data/edition.json`, `/data/international-comparison.json`, `/data/contracts/history.json` | `pulse-data-worker` | Yes |

Client interactivity on `/compare`, `/measure` and `/sources/[id]` uses URL state in the browser. These three pages read `searchParams` today and already skip it under `STATIC_EXPORT` (`compare/page.tsx:20`, `measure/page.tsx:22`, `sources/[id]/page.tsx:141,157`). They need a client-side Suspense reader to keep deep links working. Explorer data loads from gated static per-edition JSON assets (`/_edition/<id>/snapshot.json`), not from the data Worker.

**The build classifies every emitted file.** Any file that contains an evidence value from the build input must be registered in the manifest with a gate entry and an unavailable variant: an empty-evidence RSS or sitemap, an RSC payload of the unavailable page, or a 503 JSON body. A build test fails otherwise.

### 6.2 The gate (fail-closed without JavaScript)

- The build emits `edition-manifest.json`, which is bundled into the gate Worker as a module constant:

  ```
  { editionId, builtAt, sha,
    files: { "<served path>": { validUntil, feeds: [feedId], unavailable: "<variant path>" | { status: 503 } } } }
  ```

  It has one entry per evidence-bearing file (HTML, RSC payload, JSON, CSV, XML).
- Each evidence route is built twice:
  - **available**: evidence embedded, valid until the *minimum* `validUntil` of the feeds it embeds;
  - **unavailable**: the same page with every evidence block rendered as unavailable, produced by `projectPublic` with those feeds forced unavailable. The route's RSC payload is paired the same way.
- Gate algorithm:
  - unavailable when `now >= file.validUntil`, **or** when `file.feeds ∩ HELD_FEEDS` is non-empty;
  - otherwise `ASSETS.fetch(request)`;
  - if unavailable, `ASSETS.fetch(variant)`, or a `503 {"error":"Evidence unavailable"}` no-store for data files.

  HTML, RSC and data responses are `Cache-Control: no-store`; hashed JS/CSS stays `public, max-age=31536000, immutable`. Unknown evidence path ⇒ 404 no-store. Gate CPU is one map lookup, a set intersection and a date compare.
- **Security headers survive static delivery.** Static export does not apply `next.config.ts` `headers()` (today `next.config.ts:15-33`). The header set is the union of `next.config.ts` and `public/_headers`: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP and Cross-Origin-Resource-Policy. It moves to `contracts/security-headers.js`. The gate adds it to every response it returns, and the `_headers` file adds it to asset-first responses.
- **Holds and retractions do not depend on a successful rebuild.** `HELD_FEEDS` is a gate Worker **secret** (a JSON array), derived from `config/publications.json` by `scripts/gate-held-feeds.mjs`.
  - **One actor sets it:** `deploy.yml`, as the first step on any `config/publications.json` change, runs `wrangler secret put HELD_FEEDS --name public-data-static`. This is the single, narrowly scoped exception to "Workers Builds is the only deployer". It sets a secret and uploads no code or assets.
    - Cloudflare API tokens grant Workers edit rights broadly, so the token *can* deploy. A per-Worker, secrets-only scope is *unverified*, and none is claimed here.
    - The controls are the workflow tests (exactly one command touching `public-data-static`), the `release/verified` ruleset, and environment protection on the job.
    - After any `wrangler rollback`, `staticRelease` re-applies the current `HELD_FEEDS`, because a rollback may restore an older value (*unverified*).
  - It runs before the data-Worker deploy and before `release/verified` advances, so before any rebuild.
  - Every file that embeds the held feed immediately serves its unavailable variant, which is coarse but fail-closed, even if the rebuild later fails.
  - The gate's effective held set is the manifest's build-time held list ∪ `HELD_FEEDS`. An unparseable secret makes every evidence file unavailable.
  - The data Worker applies the same hold on its own redeploy, which needs no Next build.
  - Whether `secret put` creates a version without re-uploading assets is *unverified* and is tested in plan Task 15 Step 4. The fallback that does not depend on any build is the existing full-pause tool: route evidence paths to `worker/offline-pages-entry.js`.
- **Expiry between builds** is handled by the gate's deadline, with no rebuild needed. The finaliser also triggers a rebuild when the earliest embedded `validUntil` is within 36 h, so readers normally see fresh evidence rather than the coarse unavailable variant. If the build fails, the unavailable variant is served at the deadline. That is coarse, but fail-closed.

### 6.3 Build trigger and input

- Workers Builds free tier (verified): 3,000 build minutes/month, 1 concurrent build, 20 min timeout, deploy hooks (rate limit 10/min per Worker, 100/min per account). The limits table lists deploy hooks with a Free-plan value, so they are available on Free (the Deploy Hooks page itself was not read). Builds expose `WORKERS_CI_COMMIT_SHA` and `WORKERS_CI_BRANCH`, support custom build and deploy commands, and let you choose the production branch (verified 6 Nov 2026). GitHub `workflow_dispatch` stays the fallback (free for this public repo).
- **One deployer.** Workers Builds is the *only* deployer of `public-data-static` code and assets, for both code releases and edition rebuilds. The only exception is the `HELD_FEEDS` secret update (§6.2). After cutover, `deploy.yml` deploys only the data Worker.
- **Verified commit only, without a release deadlock.**
  - Workers Builds is connected to a dedicated branch `release/verified`, not to `main`. Edition rebuilds also build that branch, so they always use the last verified SHA, never unverified `main` HEAD.
  - **Pre-cutover:** reader pages are still OpenNext. `deploy.yml` deploys OpenNext and the data Worker, runs the full `test:release` (reader-page revision meta), then fast-forwards `release/verified`.
  - **Post-cutover:** `deploy.yml` deploys the data Worker and checks only what it deployed: `verify-worker-deployment.mjs` plus `release-smoke.mjs --data-only <sha>` (data routes, health contract, cache-lifetime cap). Then it fast-forwards `release/verified`.
    - Reader-page revision meta cannot be checked at this point, because the static Worker serving those pages is deployed *after* the branch advances.
    - The reader-page SHA smoke runs at the **end** of each Workers Builds build (`scripts/static-release.mjs`: build → deploy → smoke). On failure the build runs `wrangler rollback` to the previous static version and fails visibly.
    - A failing SHA therefore never stays live, and later edition rebuilds of it roll back the same way until `main` is fixed.
  - The advance needs a `contents: write` grant on that one job, with a ruleset restricting `release/verified` to Actions (G3).
  - Whether a `GITHUB_TOKEN` push triggers Workers Builds is *unverified*, so plan Task 15 proves it. The fallback is that `deploy.yml` POSTs the build hook after advancing.
- The deploy-hook URL is a Worker secret (`EDITION_BUILD_HOOK`).
- Build input: `GET /data/metrics-snapshot.json` and `/data/editions.json` from production. The build asserts that `meta.editionSummary.id` equals the id passed by the hook. On a mismatch (KV eventual consistency, edge cache) it retries for 5 minutes, then fails without deploying. Every value goes through `evaluate()` at build time.
- **Budget (unmeasured):** the designer's estimate is about 5 min per build. An independent estimate for a two-variant export plus `npm ci` is 10–15 min.
  - At 4 builds/day that is 600–1,800 min/month, 20–60% of the allowance.
  - Plan Task 14 measures it. Each build must stay under 15 min (timeout 20 min), and the projected monthly total under 1,500 min (50%). Otherwise, return to the owner before G3 (this is the G3 entry criterion).

### 6.4 Held and offline notices

- A held route renders a notice naming the specific held publication ("NHS waiting-times evidence is held from publication while…"), never "data publications are offline", unless `anyEvidencePublished()` is false.
- HTML is never `s-maxage=31536000`. Evidence-bearing or config-filtered responses have a total lifetime (max-age/s-maxage + stale-while-revalidate + stale-if-error) of ≤300 s. Plan Task 2b enforces this before, and independent of, static-first.

### 6.5 Per-request budget (free tier: 100,000 requests/day, 10 ms CPU per invocation, account-wide)

| Per reader page view | Today | Target |
|---|---|---|
| Worker requests | about 3–4 (web SSR + data subrequest + health + some snapshot) | full evidence page load 1 (gate); each client-side navigation 1 RSC fetch (+1 if Explorer JSON is loaded), so about 1–3; static page 0 |
| CPU | full React SSR of 0.35–0.86 MB HTML (unmeasured; account saw ≥1,000 CPU-limit errors on 20 Oct, attribution unverified) | gate about 1 ms (target <2 ms p99, measured in plan Task 15) |
| KV reads | about 2–3 (health 2 no-store + snapshot on cache miss) | 0 |
| Page views/day before the 100k cap (if this project had the whole account) | about 25–33k | about 33–95k evidence views, depending on client navigation (roughly a 3× gain; minus API/monitor traffic); static views unlimited |

The browser health poll and live snapshot refetch are removed from reader pages. The freshness indicator reads the edition manifest baked into the page. `/data/health.json` remains for monitors.

## 7. Generated snapshot module: decision

**Delete `app/generated/metricsSnapshot.ts` from git and from the import graph.**

- Production builds use the fetched current public artifact (§6.3).
- Local dev and tests use `tests/fixtures/publication/current-snapshot.json`. This is clearly a fixture: dated, never shipped, with a test proving it is excluded from `.open-next` and `out`.
- Until static delivery lands, `/feed.xml` and `sitemap.xml` render dataset items only when `evaluate()` says current at build time. With no input they render no evidence items. Fixing stale RSS (review F7) is Task 2 and does not wait for the cutover.

## 8. Migration path (strangler; each step shippable and revertible)

| Step | Change | Production effect | Revert |
|---|---|---|---|
| 0 | CI footprint (Workstream 0) | none (CI only) | revert workflow |
| 1 | Delete verified dead code and vars | none | revert commit |
| 2 | Untrack generated module; RSS/sitemap evidence only if current | RSS stops advertising expired evidence | revert commit |
| 2b | Cap total cache lifetime (max-age/s-maxage + stale-while-revalidate) at 300 s for evidence and held HTML, the snapshot and the feed; independent of G9 | held notices and snapshots no longer cacheable for up to a year or about 14 h | revert commit |
| 3 | `evidence-policy.js` with characterization parity tests; rewire call sites one module per PR | none (parity-proven) | revert per PR |
| 4 | Route manifest + `gateRoute`; route enumeration test | none | revert |
| 5 | Feed definitions + `_kit`; projections replace hand registries (one feed first: `realWages`, then mechanical moves) | none (parity-proven) | revert per feed |
| 6a | Measure collector and finaliser CPU on the **existing** pipeline (`wrangler tail`); owner decision G-CPU for any over-limit feed; owner decides PR #225 (G-225) | none | n/a |
| 6b | Pipeline: feed records + 3 message types, **dual-write then dual-read** (publisher reads `v20:feed:*` first, falls back to v12/v13) for 7 days, then stop old writes (G4). Archive list from index | KV writes 39 → about 16 (about 49 during dual-write); editions list 1 read | redeploy previous data Worker. Before G4: old keys still current. After G4: fails closed, degrades as legacy fragments expire |
| 7 | Health contract: required ∩ published, `held[]` list (**G5**) | health no longer degraded by policy holds alone (still degraded by real gaps such as `housePriceIndex`) | revert |
| — | **G9 go/no-go for static-first**, on measured traffic and CPU; build time is checked later, at G3 | — | — |
| 8 | Static export compatibility, then the variant build and manifest in CI (artifact only), then the gate Worker under `public-data-static` on a non-production route (G-DNS) | none | delete Worker |
| 9 | **Cutover (G2):** route `public-data.org/*` to the static gate Worker; OpenNext Worker kept deployed, unrouted, for 14 days | SSR removed; per-view cost about 1 request | re-route to `public-data-web` (one `wrangler` route change) |
| 10 | Retire old KV keys and shims (**G4**, main plan Task 17a; deletion only with approval) and, if G9, OpenNext and the Pages seed (**G8**, follow-up Task 17b) | smaller build | restore from git; keys deleted only after 14-day dual-read evidence |

## 9. Risk register

| # | Risk | Likelihood | Impact | Mitigation | Owner decision |
|---|---|---|---|---|---|
| R1 | Static page shows evidence past `validUntil` | Low | High (integrity) | gate deadline per route; `now >= validUntil` boundary test; HTML `no-store` | — |
| R2 | Edition build fails repeatedly | Medium | Medium | coarse unavailable variant at the deadline; alert via run record; GitHub dispatch fallback | — |
| R3 | Build reads a stale artifact (KV about 60 s eventual consistency, edge cache) | Medium | Medium | edition-id assertion and retry; never deploy on mismatch | — |
| R4 | Queue consumer CPU on free plan too low for parsers | Low (30 s default verified; real durations unmeasured) | High | measure per feed on the existing pipeline (Step 6a) before any pipeline rewrite; hold a feed rather than mask it | G-CPU: hold or paid executor, with explicit cost approval |
| R12 | Evidence escapes via non-HTML static files (RSC payloads, `/_edition/*.json`, downloads, RSS, sitemap) | Medium | High (integrity) | every emitted file classified; build test fails on any ungated evidence-bearing file; gate covers all classes | — |
| R13 | A hold must take effect while the rebuild is failing | Low | High (integrity) | `HELD_FEEDS` secret set by `deploy.yml` before any rebuild; full-pause fallback | — |
| R14 | Health metadata exceeds 1,024 B at scale | High at 50 feeds | Medium | packed ids and reason codes, else `t:1` + `v20:edition:health`; health degrades closed on a mismatch | — |
| R17 | Post-cutover release checks cannot see reader pages before deploy | — | — | data-only checks gate the branch advance; reader smoke plus automatic rollback at the end of the build | — |
| R18 | Long-lived cache lifetimes on evidence or held HTML (live today) | High today | High (integrity) | main plan Task 2b caps total lifetime at 300 s, independent of G9 | — |
| R15 | Data Worker bundle exceeds the Free script-size limit (64 MiB uncompressed, verified) with about 50 parsers | Low | High | size check per batch at 80% of the limit; split collectors into a second Worker | — |
| R16 | Edition build exceeds 15 min or 50% of monthly minutes | Medium | Medium | measure in follow-up plan Task 14; pass required before G3 | G3 |
| R5 | Dual-read bug serves an old key | Low | High | parity and characterization tests; publisher compares both paths and logs divergence for 7 days | G4 before deleting old keys |
| R6 | Account-shared quotas consumed by other Workers (`graingers-worker`, `mi-five-v2`) | Unknown | High | per-Worker attribution in Cloudflare analytics (issue #218); budgets assume ≤20% share | — |
| R7 | A lane skips the build for a change that breaks it | Low | Medium | no affected-only tests: every code lane runs the full suite. The `worker` lane skips the Next build only when no changed file is in `appImportClosure()`. Shared inputs always select the full lane. `main` deploys add no suites (documented deploy behaviour unchanged) | — |
| R8 | Static file count or size limits (20,000 files, 25 MiB per file, verified) | Low | Low | budget check in build (two variants × about 200 routes) | — |
| R9 | `_redirects` unsupported or behaves differently | Low | Low | gate Worker handles redirects | — |
| R10 | Health contract change breaks monitors | Low | Medium | additive fields first; `missingRequiredSections` semantics change only after G5 | G5 |
| R11 | Workers Builds needs a GitHub app connection and a hook secret | — | — | owner action; least privilege; hook only triggers builds | G3 |

## 10. Options considered and rejected

| Option | Why rejected |
|---|---|
| Keep OpenNext SSR and edge-cache the HTML | Cache hits are billed as requests (pricing docs), so the 100k/day cap is not relieved. Validity-bounded HTML caching across policy deploys is fragile |
| Client-rendered evidence on a static shell | Violates P01: "critical context and history tables readable without JavaScript" |
| Build-time static evidence without a gate | Cannot fail closed at `validUntil` between builds without JS |
| D1 (free: 100k rows written/day, verified) for observations | KV after reduction uses about 1.5% of its quota. D1 adds schema migrations and a second consistency model. Revisit beyond about 300 feeds or when runtime history queries are needed |
| Durable Objects (SQLite, free, verified) for run coordination | Idempotent finaliser plus deadline already suffices; adds a class and migrations |
| R2 (free 10 GB, verified) for the archive | 60 editions × about 0.3 MB ≈ 18 MB is far below KV's 1 GB. Revisit if editions exceed 2 MiB or retention grows past about 1,000 |
| Drop Queues; run collectors inside cron | Cron CPU limit 10 ms (verified); no isolation or retry |
| Daily static build on GitHub Actions | Free for this public repo, but the owner has asked for no large Actions jobs. Kept only as a fallback |
| Codegen the feed index from folders | Bundler cannot glob-import; codegen adds a moving part. A one-line index plus a completeness test is simpler |
| Merge data and web Workers now | Different bindings and blast radius; revisit after Step 10 |
| Cloudflare Pages for the static site | Two hosts and identities. Workers Static Assets keeps one route |
