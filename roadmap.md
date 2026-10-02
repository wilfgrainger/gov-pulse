# Roadmap — public-data.org

> Historical roadmap. The user-authorized 1 October 2026 reinvention is planned
> in `docs/superpowers/plans/2026-10-01-publication-reinvention.md`. Reconcile
> older issue/state claims against current code before acting; they are not
> scope restrictions or proof of present production state.

> DRAFT planning document in `_planning-drafts/` only. Themed phases derived from the
> ACTUAL current repo state (read 2026-09-28) and the known open issues below.
> Ordering is by leverage, not size. Nothing here authorises pushing, merging or deploying.

## Known open issues this roadmap absorbs

- **#73** — NHS evidence publication.
- **#58** — align delivery workflow / docs.
- **#56** — explicit reader state.
- **#53** — V1.0 release hardening.
- **#45** — remove unused `framer-motion` + regenerate lockfile.
- **#6** — refresh PostCSS / Sharp dependencies.

Repo facts confirmed against code: `package.json` still lists `framer-motion ^12.42.2`
(so #45 is real and open); `@types/node ^20.19.43` on Node 24 is deliberate; the data
Worker (`worker/wrangler.toml`, `worker/public-data-entry.js`) exposes exactly the three
`/data/*` routes; crons are `17 3 * * *` (daily) and `47 */3 * * *` (betting, three-hourly);
`worker/feed-registry.js` version `2026-08-02.1` lists 8 required + 2 optional sections plus
a separate government-contracts publication source.

---

## Phase 0 — Documentation currency pass (do first; it is the cheapest correctness win)

Several docs now contradict the shipped code and will actively mislead an autonomous loop.
Fix or retire them (see `DOC-REVIEW.md` for the full table). Highest-priority corrections:

- **`docs/cloudflare-worker-backend.md`** — describes the data Worker as "internal … not
  part of the public website delivery path", "No custom route is attached", "four-hour
  cron". All false now: it has three public routes and daily+3h crons. **CONTRADICTS-CODE.**
- **`docs/architecture/decisions/0001-cloudflare-first-data-plane.md`** — states the public
  Worker is "limited to **two** exact routes". A third route
  (`/data/international-comparison.json`) shipped later. Add a superseding note or an
  ADR-0002. **SUPERSEDED** on route count.
- **`docs/architecture/cloudflare-free-data-plane.md`** — "two exact routes", `v12:` KV key
  scheme, manual-only Worker deploy, "website remains a static Cloudflare Pages
  application", "seven … section refreshes". Contradicts the OpenNext web-Worker model,
  automatic deploy, `v1:`/current key usage and 8 required sections. **STALE / SUPERSEDED.**
- **`docs/architecture/source-contract-schema.md`** — lists `retrieval: … or GitHub Actions
  ingest` as a live option; routine Actions data collection is a retired concept per
  `AGENTS.md`. **CONTRADICTS-CODE** (minor).
- **`docs/evidence-audit/betting-markets-2026-07-14.md`** — market identity "Next PM after
  **Keir Starmer**" and a "two-hour" workflow. Live code is "after **Andy Burnham**" and a
  three-hour cron. **STALE** on identity/cadence (historical audit; keep dated, add note).
- **`AGENTS.md` "derive … from GitHub" / operating method** — reconcile with the
  cave-pony test-suite audit finding that a mandated "Graphite Mountain" skill file never
  existed; the current AGENTS.md already reads as honest review lenses, so mainly confirm
  no stale skill pointer remains in tests (`gov-metrics-master-skill.test.ts`).

Deliverable: every STALE / CONTRADICTS-CODE doc either corrected in place, given an explicit
"superseded by" banner, or moved to a dated-archive convention. Ties into **#58**.

## Phase 1 — Dependency cleanup (#45, #6)

- **#45** Remove `framer-motion` if genuinely unused (confirm no `motion`/`AnimatePresence`
  imports remain — `Reveal.tsx`/`ClientOnlyChart.tsx` are the likely users; verify before
  deleting), then regenerate the lockfile deterministically. Respect reduced-motion
  behaviour either way.
- **#6** Refresh PostCSS / Sharp (and transitively pinned `postcss ^8.5.19` override). Keep
  the toolchain pin (`node 24.17.0`, `npm 11.13.0`) and `@types/node ^20` intentional split.
- Keep changes inside the check-change-complexity budget (see Phase 2); lockfile churn is
  bounded by `check-lockfile-policy`.

## Phase 2 — Gate rationalisation (#58 adjacent)

Recommendation after reading the gate scripts:

- **KEEP `scripts/check-change-complexity.mjs`** — limits (30 files / 5 concern groups /
  2500 source lines / 1000 lockfile lines) are generous **anti-slop guards**, not friction.
  They stop an autonomous loop shipping a sprawling change. Keep as-is.
- **Friction candidates to review:** `check-pr-description.mjs` and `check-lockfile-policy.mjs`.
  These police PR prose/lockfile wording; the cave-pony audit already recommends dropping
  the *unit tests of* these helpers (not the CI wrappers). Decide whether the prose rules
  earn their friction or should be relaxed to the minimum that protects real provenance.
- Apply the test-suite audit's CUT list (8 process-policing vitest files) and the one
  CONSOLIDATE (`gov-metrics-master-skill`) — behaviour coverage is untouched.

## Phase 3 — Reader state & delivery alignment (#56, #58)

- **#56 explicit reader state** — make homepage/topic/explorer availability derive from the
  single canonical section record (the data-reliability-repair design's canonical-consistency
  task), and surface honest degraded/next-release state instead of a dead-end unavailable
  panel (the deep-dive review's highest-CX finding + `DataHealthBar` framing fix).
- **#58 align delivery workflow/docs** — reconcile `docs/operations/deployment-ci-frugality.md`
  and the delivery READMEs with the two actual workflows (`pr-validation.yml`, `deploy.yml`)
  and remove any residual claims of scheduled Actions collection / manual promotion.

## Phase 4 — Data + charts onboarding feature (the north-star capability)

Turn "add a source" into a bounded, contract-driven, accessible-by-default operation.

- Collapse the **two divergent ONS registries** first: `app/lib/config.ts` `ONS_SERIES`
  (inert, imported by nothing) vs the live `worker/index.js` registry. One registry, or the
  new-feed work inherits the ambiguity (deep-dive §4).
- Reuse the existing ONS-CSV collector to add near-zero-cost series behind an accessible
  publication-point chart (validated candidates from the deep-dive: `A3WW` real-terms pay,
  `D7BU` food inflation → a "Cost of living" section; contract must assert CSV shape + CDID,
  not just HTTP 200).
- Ship CSV/JSON export per series (a stated platform contract, currently unbuilt) — converts
  readers into citers using the already-public snapshot.
- Larger onboarding candidates (UK HPI for Housing + regional revival; Carbon Intensity for a
  new operational-data evidence class) follow the same contract-first path; HPI's 34.8 MB file
  is collected in `scripts/` under Actions, which the architecture permits.
- Every onboarded measure ships the accessibility bundle (screen-reader table, keyboard,
  focus, reduced-motion, 360px reflow). No new charting dependency.
  *Progress update (2026-10-01)*: Delivered 5 accessible publication-point visuals (`ContractsMonthlyPipeline`,
  `SupplierMarketConcentration`, `EconomicPulseGrid`, `HousingAffordabilityVisual`, `ReceiptsDebtVisual`) and
  fixed the Government Contracts observation policy mismatch, integrating £13.15B Find a Tender awards with
  monthly spending totals, supplier market concentration, and a British 538 editorial look and feel.

## Phase 5 — V1.0 hardening (#53, #73)

- **#73 NHS evidence publication** — land the current-publication discovery/parsing for NHS
  RTT (data-reliability-repair plan Task 5) so `nhsStats` publishes current, or fails closed
  honestly.
- **#53 V1.0 release hardening** — close out the operational evidence tracked in issue #257
  (seven consecutive scheduled runs + an exercised Worker/Pages rollback), confirm the
  degraded-release contract, and confirm production only via exact-head checks and observed
  public journeys — never merge-status alone.

---

## Sequencing rationale

Phase 0 and Phase 1 are cheap and unblock trust in the docs and the dependency tree. Phase 2
keeps the anti-slop guards while removing genuine friction. Phase 3 fixes the biggest reader
problem (numbers/degraded state) using existing selectors. Phase 4 is the strategic
capability. Phase 5 is the release gate. No phase weakens a NON-GOAL in `north_star.md`.
