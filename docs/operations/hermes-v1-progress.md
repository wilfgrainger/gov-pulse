# Hermes V1 working progress

**Purpose:** resumable progress ledger for the V1 delivery programme. Updated before
compaction/restart and after each completed work item. Factual source of truth for
what changed and what is verified; the six `docs/v1/` records remain the canonical
programme records.

## Objective

Complete and launch public-data.org as a coherent, source-backed UK public evidence
publication with ten integrated reader capabilities (P01–P10), per
`docs/v1/MASTER-DELIVERY-PLAN.md` (Option B). Held evidence stays held; no source
activation, deployment, publication, merge or spend without explicit user
authorization.

## Baseline

- Branch: `codex/hermes-v1` (worktree of `gov-pulse`, `main` is the release branch)
- Baseline commit: `7ca7f3b` (docs: record Wave 1 quality gate rerun after revert of `597b8b0`)
- Production release branch: `main` (last verified deployment receipts in `docs/operations/revamp-progress.md`)
- Wave 1 exit criteria were recorded as satisfied in the master plan; verified
  against code on 15 October 2026:
  - `contracts/publication-policy.js` preserves `missingRequiredSections` on degraded snapshots ✓
  - `worker/public-data-entry.js` and `worker/queued-publication-entry.js` filter Pages seeds through `filterPublicationSnapshot` ✓
  - `worker/queued-publication-entry.js` scopes section fragment KV keys to runId (`RUN_PREFIX = "v13:publication:run:"`) ✓
  - Staged publish-after-write with `PUBLICATION_COMMIT_KEY` manifest in `worker/publication-entry.js`, verified in `tests/worker/cloudflare-publication.test.ts` ✓
  - `ClientOnlyChart` supports `fallbackContent` with accessible static fallback frame ✓
  - `scripts/check-source-ownership.mjs` and `scripts/check-static-architecture.mjs` exist and are referenced ✓
- **Wave 2 is the active wave.**

## Completed

### W2.01 — wire the no-JavaScript fallback into the two remaining chart components

**What changed**
- `ClientOnlyChart.tsx`: carried over the uncommitted `aria-busy="false"` fix on
  the static `fallbackContent` branch (no false loading pulse when the fallback
  is real content).
- `FinancialTimeSeriesChart.tsx` (used by 14 chart panels: debt, GDP, tax,
  employment, house prices, real wages, NHS, migration, early-years, economy,
  sentiment): passes a real `fallbackContent` — "interactive chart requires
  JavaScript", the **latest published values** for every series (formatted with
  the same `valueFormatter`), and the observation window — instead of the
  loading-skeleton branch. The pre-existing `ObservationTable` below the chart
  continues to provide the complete history without JavaScript.
- `PollingPublicationChart.tsx` (election-polls section): passes a real
  `fallbackContent` — "interactive scatter plot requires JavaScript", the
  selected parties with the per-point disclosure, and the fieldwork window; the
  per-poll table below remains the no-JavaScript data path.

**Verification**
- Focused SSR tests added: `ClientOnlyChart.test.tsx` (skeleton-free fallback
  with `aria-busy="false"`), `FinancialTimeSeriesChart.test.tsx` (latest
  values + window in SSR HTML, no `animate-pulse`; table present in document),
  `PollingPublicationChart.test.tsx` (SSR fallback summary, no skeleton).
- Full suite: **175 files / 1,138 tests pass** (was 1,134; +4 new).
- Lint: 0 errors (1 pre-existing warning in `worker/offline-pages-entry.js`).
- `tsc --noEmit`: clean. `check-static-architecture.mjs` + `check-source-ownership.mjs`: pass.
- Toolchain check: pass (Node 24.17.0, npm 11.13.0).
- OpenNext production build (`opennextjs-cloudflare build`): **complete**
  (`Worker saved in .open-next/worker.js`).
- Local browser/dev-server check: `/section/national-debt/` SSR HTML contains the
  fallback summary (latest values + window) in both chart shells, no
  `animate-pulse`; held families (`/section/economy/`, `/section/election-polls/`)
  render their evidence-hold notices with no chart shell — no regression.
- **Playwright e2e (real Chromium, local `next dev`) — 2026-10-15:**
  **28 passed / 0 failed / 12 skipped** (full suite, desktop + mobile projects).
  The 12 skips are the deploy/platform-gated tests — chiefly the
  `live-mobile.spec.ts` production audits (`test.skip(!publicBaseUrl)`, requires
  the held `PLAYWRIGHT_BASE_URL`) — not W2.01 failures.
  - `smoke.spec.ts` "home page loads cleanly" passed in real Chromium with
    `chartWarnings` empty: **no Recharts `width(0) height(0)` render warnings**.
    This is a *negative* check — it rules out a broken/zero-size chart render,
    but it cannot *positively* confirm the `svg.recharts-surface` mounts,
    because `ClientOnlyChart` renders Recharts only when `mounted && hasSize`
    and the headless dev container measures zero size (fallback persists
    silently, emitting no warning).
  - The **positive** mount assertion — `svg.recharts-surface:visible` in
    `live-mobile.spec.ts:23` (presence + viewport fit) — is gated behind
    `PLAYWRIGHT_BASE_URL` + the Pixel 7 project, so it **does not run locally**
    and remains the one deploy-dependent proof. Its absence locally is
    environment/deployment gating, **not a W2.01 regression**: the pre-change
    baseline shows the identical zero-size/fallback behavior in this dev
    environment.

## Blockers

- None for local implementation.

## Next action after W2.01

1. ~~Record the Playwright e2e result (chart mounting with JS in real Chromium).~~
   **Done** — local real-Chromium run recorded above (28/0/12). The *positive*
   `svg.recharts-surface:visible` assertion is deploy-gated; it stays the one
   deploy-dependent evidence item until a real deployment is made.
2. ~~Re-inventory all `ClientOnlyChart` usages to confirm no other skeleton
   branches remain (only the two above were identified).~~ **Done** — exactly two
   shells use it (`FinancialTimeSeriesChart`, `PollingPublicationChart`); both
   pass a real `fallbackContent`, so the `animate-pulse` skeleton branch (only
   reachable when `fallbackContent` is absent) is dead in both. `chartExport.ts`
   references the component in a comment only. No other skeleton branches remain.
3. Select the next bounded Wave 2 gap from the master plan's per-capability rows
   (P02 catalog/exports parity, P03 URL restore/export, P04 story binding,
   P05 ICS/watchlist verification, P06–P09 held-family journeys).
4. Update `docs/v1/ACCEPTANCE-RESULTS.md` (the P01 no-JavaScript defect row is
   now closed) and `docs/v1/RELEASE-READINESS.md` (P01 local evidence) with the
   verified state. Keep the real-browser chart-mount proof held for the
   post-deployment run; do **not** claim production evidence without a
   deployment.