# Tasks — public-data.org (living checklist)

> DRAFT in `_planning-drafts/` only. GitHub-flavoured checkboxes, grouped by roadmap phase.
> Each task is small and issue-scoped. Highest-leverage next step is pinned at the top.
> Nothing here authorises push/merge/deploy; all work stays fail-closed per `north_star.md`.

## ⭐ Highest-leverage next step

- [x] **Fix `docs/cloudflare-worker-backend.md` (CONTRADICTS-CODE).** It claimed the data
  Worker is internal, route-less and on a four-hour cron. Reality: 3 public `/data/*`
  routes + crons `17 3 * * *` and `47 */3 * * *` + automatic deploy from `main`.
  Corrected in place 2026-09-29 (branch `auto/docs-worker-backend-currency`) so no
  autonomous loop trusts a false architecture. Cheapest correctness win in the repo.

---

## Phase 0 — Documentation currency pass (#58)

- [x] Rewrite/retire `docs/cloudflare-worker-backend.md` to match the shipped 3-route,
  daily+3h data Worker with automatic deploy (see pinned task; done 2026-09-29).
- [x] Add a superseding note to `docs/architecture/decisions/0001-cloudflare-first-data-plane.md`
  (or author ADR-0002) recording the third route `/data/international-comparison.json`.
  Done 2026-10-01 (branch `auto/adr-0001-third-route-note`): added a dated "Superseded in
  part" banner recording the two→three route count and the Pages→OpenNext web-Worker
  delivery model, without editing the historical decision body.
- [ ] Follow-up (2026-09-29): audit `docs/architecture/cloudflare-free-data-plane.md`
  for the same "manual-only deploy" claim just corrected in `cloudflare-worker-backend.md`,
  so the two docs agree the deploy is automatic from `main`.
- [ ] Reconcile `docs/architecture/cloudflare-free-data-plane.md`: two→three routes,
  `v12:`→current key scheme, manual-only→automatic web+data Worker deploy, "static Pages
  app"→OpenNext web Worker, "seven refreshes"→8 required sections.
- [ ] Correct `docs/architecture/source-contract-schema.md`: `retrieval` should not list
  "GitHub Actions ingest" as a live routine option (retired per `AGENTS.md`).
- [ ] Add a dated-history banner to `docs/evidence-audit/betting-markets-2026-07-14.md`
  noting market identity moved from "after Keir Starmer" to "after Andy Burnham" and the
  cadence is three-hourly, not two.
- [ ] Sweep remaining dated audits for "two-hour"/"four-hour" cron wording and legacy
  route/KV claims; annotate as historical where the finding is already implemented.
- [ ] Confirm no test still enforces a missing skill pointer
  (`tests/unit/gov-metrics-master-skill.test.ts` — the "Graphite Mountain" assertions).

## Phase 1 — Dependency cleanup (#45, #6)

- [ ] **#45** Grep for `framer-motion` / `motion.` / `AnimatePresence` usages
  (`app/components/Reveal.tsx`, `ClientOnlyChart.tsx` are prime suspects); confirm truly
  unused before removal.
- [ ] **#45** Remove `framer-motion` from `package.json`; preserve reduced-motion behaviour
  with CSS/native transitions.
- [ ] **#45** Regenerate `package-lock.json` deterministically; keep the diff under the
  `check-lockfile-policy` / change-complexity lockfile budget (1000 lines).
- [ ] **#6** Refresh PostCSS (and the `postcss ^8.5.19` override) and Sharp to current
  patched versions; keep the `node 24.17.0` / `npm 11.13.0` pin and `@types/node ^20` split.
- [ ] Run `npm run lint`, `npm test`, `npm run build:check` after each dependency change.

## Phase 2 — Gate rationalisation

- [ ] Record the decision: **KEEP `scripts/check-change-complexity.mjs`** (30 files / 5
  concern groups / 2500 source / 1000 lockfile lines) as anti-slop guards.
- [ ] Review `scripts/check-pr-description.mjs` friction: does the prose contract earn its
  cost, or relax to the minimum that protects real provenance/evidence claims?
- [ ] Review `scripts/check-lockfile-policy.mjs` friction against the #45/#6 lockfile churn.
- [ ] Apply the test-suite audit CUT list (8 process-policing vitest files) and CONSOLIDATE
  `gov-metrics-master-skill` — keep the CI wrapper scripts wired in `pr-validation.yml`.

## Phase 3 — Reader state & delivery alignment (#56, #58)

- [ ] **#56** Route homepage/topic/explorer availability through one canonical section
  record so pages cannot disagree about currency.
- [ ] **#56** Replace the dead-end unavailable panel with an honest "last verified X for
  <period>; next release <date>" state where `nextReleaseDate` exists — still fail-closed
  on currentness.
- [ ] **#56** Reframe `DataHealthBar` to name what *is* current first, count second.
- [ ] **#58** Align `docs/operations/deployment-ci-frugality.md` + delivery READMEs with
  the two real workflows (`pr-validation.yml`, `deploy.yml`); remove residual scheduled-
  Actions / manual-promotion language.

## Phase 4 — Data + charts onboarding capability

- [ ] Collapse the two ONS registries into one (`app/lib/config.ts` `ONS_SERIES` is inert;
  `worker/index.js` registry is live) before any new feed.
- [ ] Add `A3WW` (real-terms pay) via the existing ONS-CSV collector + contract test that
  asserts CSV shape and CDID (not just HTTP 200).
- [ ] Add `D7BU` (food inflation) the same way; compose a "Cost of living" section.
- [ ] Ship one accessible publication-point chart per new measure (screen-reader table,
  keyboard, focus, reduced-motion, 360px reflow) — no new charting dependency.
- [ ] Add per-series CSV/JSON export from the existing public snapshot (stated platform
  contract, currently unbuilt).
- [ ] Spike UK HPI onboarding under `scripts/` (34.8 MB, range-request capable) for Housing
  and a route to revive regional comparison with valid ONS geography codes.
- [ ] Spike Carbon Intensity feed with a NEW `EvidenceClass` for operational admin data
  (do not mislabel it an official statistic).

## Phase 5 — V1.0 hardening (#53, #73)

- [ ] **#73** Land NHS RTT current-publication discovery/parsing (data-reliability-repair
  Task 5); NHS either publishes current or fails closed honestly.
- [ ] **#53** Record issue #257 operational evidence: 7 consecutive scheduled runs + one
  exercised Worker/Pages rollback.
- [ ] **#53** Confirm degraded-release contract (`publicationState:"degraded"`,
  `missingRequiredSections`, health `ready:false`) end-to-end.
- [ ] **#53** Claim production only after exact-head route/health checks and an observed
  public journey — never merge status alone.

## Cross-cutting guardrail checks (run against every task above)

- [ ] No synthetic/zero/interpolated/forecast value introduced.
- [ ] No combined total or national/overall score introduced.
- [ ] No new public Worker route or paid/tracking dependency without a recorded ADR.
- [ ] Accessibility + static-first fallback preserved.
