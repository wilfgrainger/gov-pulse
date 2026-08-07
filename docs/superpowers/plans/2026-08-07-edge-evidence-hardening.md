# Edge Evidence Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render current evidence at request time on Cloudflare Workers, make the evidence registry authoritative, degrade safely when individual feeds fail, remove retired data code, and repair production provenance.

**Architecture:** Keep `pulse-data-worker` as the narrow collection/publication worker for the two `/data/*` routes, add an OpenNext-hosted `public-data-web` Worker for the Next.js application, and make request-time SSR read the current public snapshot. Derive currentness policy from `worker/feed-registry.js`, allow explicit degraded publications without stale values, and delete the obsolete `worker/index.js` implementation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Cloudflare Workers, `@opennextjs/cloudflare`, Wrangler, KV, Queues, Vitest, Playwright.

## Global Constraints

- No synthetic national score, interpolation, stale-as-current fallback or mixed evidence classes.
- Required source failures may produce an explicit degraded publication but never retain an expired asserted value.
- The data worker keeps exact routes `/data/metrics-snapshot.json` and `/data/health.json`.
- No paid Cloudflare product, analytics, personal-data collection or new secret surface.
- `main` remains untouched; all changes stay on `superpowers/edge-evidence-hardening` until PR review.

---

### Task 1: Make the feed registry authoritative for currentness

**Files:**
- Modify: `worker/feed-registry.js`
- Modify: `worker/publication-currentness.js`
- Modify: `app/lib/config.ts`
- Modify: `tests/unit/dataSourceMetadata.test.ts`
- Modify: `tests/worker/publication-currentness.test.ts` or the existing equivalent currentness test file

**Interfaces:**
- Produces: `retrievalMaxAgeMs` on active registry definitions and `retrievalMaxAgeMs(section)` helper.
- Consumers: publication currentness checks and metadata consistency tests.

- [ ] Add failing tests proving each active publication section has one registry-backed retrieval currentness policy and that no UI-only ONS registry is treated as runtime source configuration.
- [ ] Add `retrievalMaxAgeMs` to each active feed definition using the existing values: 36h for sentiment/GDP/employment/tax/migration/crime, 40d debt, 14d polling, 45d NHS, 4h betting, 72h contracts.
- [ ] Replace `RETRIEVAL_MAX_AGE_MS` hard-coded policy ownership with registry-derived lookup while preserving the exported compatibility constant if tests/imports need it.
- [ ] Remove inactive `ONS_CSV_BASE`, `BOE_API_BASE`, `ONS_SERIES` and `BOE_SERIES` exports from `app/lib/config.ts` after reference checks.
- [ ] Run focused metadata/currentness tests.

### Task 2: Publish explicit degraded editions without stale evidence

**Files:**
- Modify: `worker/queued-publication-entry.js`
- Modify: `worker/public-data-entry.js`
- Modify: `worker/public-snapshot.js`
- Modify: `contracts/publication-diagnostics.js`
- Modify/add: Worker publication tests covering missing required sections and health state

**Interfaces:**
- Produces: `meta.publicationState` with `ready | degraded` on valid artifacts; health exposes `ready`, `degraded` and included/missing section counts without source-internal errors.
- Consumers: public API, SSR web application and production verifier.

- [ ] Add a failing test where one required section has expired and prove the public artifact excludes that section instead of returning the previous stale value.
- [ ] Change publication finalisation so a non-empty, valid current snapshot can publish when required feeds are missing; record `missingRequiredSections` and `publicationState: "degraded"`.
- [ ] Keep `publicationState: "ready"` only when every required section is present and current.
- [ ] Keep total publication failure when no current source-owned evidence survives or the artifact contract is invalid.
- [ ] Update prepared-artifact completeness checks so degraded artifacts are valid when metadata explicitly records missing required sections.
- [ ] Update `/data/health.json` to return generic `ready` or `degraded` state with no private Queue/KV details.
- [ ] Run focused queue/public API tests.

### Task 3: Remove the retired Worker implementation

**Files:**
- Delete: `worker/index.js`
- Modify: `docs/architecture/source-ownership.json`
- Modify: tests and docs containing active references to `worker/index.js`

**Interfaces:**
- Produces: one live execution architecture only.

- [ ] Add a failing architecture test that rejects active references to `worker/index.js` and legacy `/metrics` or `/all` public API descriptions.
- [ ] Confirm no production entrypoint imports the file.
- [ ] Delete `worker/index.js`.
- [ ] Update ownership simplification counts and any documentation references so the deletion is recorded as retired code rather than a live collector.
- [ ] Run source-ownership and static-architecture guards.

### Task 4: Move the web frontend to request-time Cloudflare SSR

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.ts`
- Create: `open-next.config.ts`
- Create: `web/wrangler.toml`
- Create: `app/lib/serverMetricsSnapshot.ts`
- Modify: `app/page.tsx`
- Modify: `app/section/[id]/page.tsx`
- Modify: relevant trust/sources routes if they render publication-derived data
- Modify/add: unit tests for server snapshot selection

**Interfaces:**
- Produces: `readServerMetricsSnapshot(): Promise<MetricsSnapshot | null>` using a bounded canonical-origin fetch with `cache: "no-store"`.
- Consumers: server-rendered homepage and section routes.

- [ ] Add failing tests proving production server rendering does not use `BUILD_METRICS_SNAPSHOT` as evidence and invalid network payloads fail closed.
- [ ] Add `@opennextjs/cloudflare` at a version compatible with Next.js 16 and scripts `build:web`, `preview:web`, `deploy:web`.
- [ ] Configure the OpenNext adapter and `public-data-web` Wrangler worker with `nodejs_compat`, static asset binding and catch-all `public-data.org/*` route.
- [ ] Keep the two existing data-worker routes more specific than the web catch-all route.
- [ ] Implement bounded server snapshot retrieval from `https://public-data.org/data/metrics-snapshot.json`; allow test injection and local deterministic fallback only outside production request rendering.
- [ ] Make homepage and evidence routes async and derive initial presentation from the request-time snapshot.
- [ ] Retain client revalidation as secondary freshness protection.
- [ ] Run Next build and targeted rendering tests.

### Task 5: Make publication provenance accurate and public-safe

**Files:**
- Modify: `app/components/NationalEvidenceEdition.tsx`
- Modify: `app/lib/nationalEvidence.ts`
- Modify: `.agents/PROGRESS.md`
- Modify: `README.md`
- Modify: `docs/architecture/source-ownership.json`
- Modify: `scripts/verify-production.mjs`
- Modify/add: verifier tests

**Interfaces:**
- Consumes: snapshot `meta.registryVersion`, `meta.generatedAt`, `meta.publicationState`, application commit SHA.
- Produces: visible non-secret provenance and exact-head verification.

- [ ] Add tests for publication state/provenance presentation and exact gov-pulse revision verification.
- [ ] Rename lead selection wording from subjective recency/editorial language to deterministic publication priority unless a real ranking score is implemented.
- [ ] Surface registry version, evidence generated time, publication state and app revision in a compact trust/provenance area.
- [ ] Rewrite `.agents/PROGRESS.md` so it no longer claims the old gov-metrics deployment is current; describe only verifiable gov-pulse branch/live state.
- [ ] Replace bare historical issue references that imply the issues exist in gov-pulse with explicit migration context or remove them.
- [ ] Update the production verifier to require a current publication state and current gov-pulse revision marker.
- [ ] Run verifier tests.

### Task 6: Change production deployment from Pages custom-domain frontend to OpenNext Worker

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/pr-validation.yml`
- Modify: `scripts/check-hosting-boundary.mjs`
- Modify: `scripts/check-static-architecture.mjs`
- Modify/add: deployment-order and hosting-boundary tests

**Interfaces:**
- Produces deployment order: validate -> data worker -> publication readiness -> web Worker -> Pages seed/assets -> production verification.

- [ ] Add failing workflow tests requiring the OpenNext build/deploy step and preserving data-worker route ownership.
- [ ] Build OpenNext in PR validation in addition to deterministic browser checks.
- [ ] Deploy `public-data-web` after the data worker and verified publication are ready.
- [ ] Keep Pages deployment only as the seed/static fallback origin until a later explicit storage migration.
- [ ] Update hosting guards to prohibit GitHub Pages and to treat the web Worker as production frontend while permitting the Pages seed origin.
- [ ] Verify workflow YAML and static architecture tests.

### Task 7: Full verification and PR

**Files:**
- No new production files unless verification exposes a defect.

- [ ] Run/rely on GitHub PR validation for toolchain, hosting, lint, unit/Worker, OpenNext build and Playwright.
- [ ] Review changed files for secrets, account identifiers newly exposed to browser code, stale values and duplicated source configuration.
- [ ] Confirm `worker/index.js` is absent and no legacy public endpoint remains documented as live.
- [ ] Confirm a degraded fixture contains no expired value for the missing feed.
- [ ] Open one PR to `main` with architecture summary, safety properties, deployment impact, review checklist and rollback notes.
