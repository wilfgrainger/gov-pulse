# V1 implementation inventory

**Evidence checked:** 12 October 2026, approximately 10:16 UTC.
**Code reviewed:** production `main` at `5b677304`; V1 candidate code at `e48a71a`. The candidate is not deployed.
**Purpose:** factual inventory; execution order is in [MASTER-DELIVERY-PLAN.md](MASTER-DELIVERY-PLAN.md).

## Capability inventory

| Priority | Code and observed state | Verified gap / next evidence |
|---|---|---|
| P01 Editorial redesign | Premium ink/paper visual system and navigation are implemented and have partial production proof. Candidate adds held-route behavior. | All ten populated journeys, four viewport widths, mobile interactions, manual accessibility and independent design sign-off remain open. Critical chart context must remain useful without JavaScript. |
| P02 Measure atlas | Measure routes and search/filter/detail structures exist. Current local catalog contains 38 definitions. | Production public catalog currently contains only debt ratio and debt stock; reconcile all definitions, availability, geography, source and exports. Audit every topic chart for a shared figure, accessible axis/units, gap handling, no-JavaScript observation history, and download parity. |
| P03 Comparison studio | Comparison route, selection and chart structures exist. | Production evidence offers only the two national-debt measures; peer and cross-measure comparisons remain unavailable. Verify valid/invalid selections, URL restore, local saves, and export parity. |
| P04 Briefings, stories, RSS | Briefing, story, RSS and edition archive code exist. Production RSS is debt-only; three archive entries were observed. | Candidate enables two authored stories, pending editorial/fact-check review. Verify source edition binding, stable dates/IDs, feed correctness and populated journey. |
| P05 Calendar/watchlist | Calendar and watchlist interface exists. | Candidate configuration holds both release-calendar families; calendar page has no current published event payload. Verify official dates, unknown states, watchlist and ICS. |
| P06 Cost of living | Cost-of-living interface and source normalizers exist. | Housing, rent, prices, earnings and rates are held. Verify source series/geography/units/history and integrated explanatory journey. |
| P07 Polling | Polling table, collectors and normalization code exist. | Publication is held. Verify original publications and at least two pollsters, fieldwork metadata, corrections, production values and export. |
| P08 Public money | Procurement collector, dossier and history UI exist. | Publication is held; history endpoint returned `503 publication_disabled`. Verify complete bounded source window, notice identity/amendments and reproducible buyer/supplier dossiers. |
| P09 International | Source adapters, selection UI and comparison support exist. | Publication is held; public comparison JSON returned `503 publication_disabled`. Reconcile country/year/status/export against a refreshed public edition. |
| P10 Provenance and archive | Source pages, edition APIs and archive code exist. Production lists three editions; latest detail was retrievable. | Full source→measure→observation→edition→revision path, consistency after partial writes, immutable detail coverage and archive telemetry remain unproved. |

Some implementation exists for all ten priorities: **10/10 have at least partial code**. No priority has complete production acceptance evidence: **0/10**. A single percentage of work completed would be misleading because the deliverables differ greatly in size and many blockers are source or production proofs rather than missing code. The current registry's 38 definitions must not be confused with 38 published measures.

## Shared implementation findings

- Current source/retrieval membership is in `worker/feed-registry.js`; related concepts also appear in `contracts/measure-definitions.json`, `config/publications.json`, `contracts/public-surfaces.json`, `worker/measure-catalog.js`, app metadata and `docs/architecture/source-ownership.json`. A02 must assign one owner per concept before consolidating.
- Public route capability and evidence publication are distinct. Candidate `e48a71a` makes topic/source/detail pages explain holds while keeping held section downloads unavailable, and filters static candidate/download paths through policy.
- Candidate `e48a71a` makes archive write failure fatal before later publication writes, but current writes still span separate KV records and collector fragments share per-section keys. Run-scoped artifacts and an explicit committed edition reference remain Wave 1 architecture work.
- The historical chart-consolidation task is only partial. Current topic pages still use `FinancialTimeSeriesChart` through `ClientOnlyChart`, whose server fallback is a loading skeleton. Re-inventory current chart instances rather than relying on the older plan's count; carry forward shared figure structure, units/axes, visible gaps, server-rendered history without JavaScript, and chart/table/download parity into P01/P02 and affected feature journeys.
- The live prepared snapshot had `publicationState=degraded` with no missing-required IDs, while `/data/health.json` named `nhsStats` missing. This is a confirmed public-contract inconsistency to resolve and regression-test.
- A stale Pages seed can bypass new policy if recovery serves its projection unchanged. PR #214 has this latent code path. At audit time, public Pages snapshot returned 503, so no live held-source exposure was observed; direct KV inspection was unavailable.
- No code feature state authorizes evidence activation. Keep all current publication holds.

## Historical plan reconciliation (W0.02)

The three earlier reinvention plans under `docs/superpowers/plans/` contain valuable implementation history, but are superseded for execution by [the master delivery plan](MASTER-DELIVERY-PLAN.md):

1. **`2026-10-01-publication-reinvention.md` (Round 1)**:
   - *Status*: Superseded.
   - *Retained / Merged*: Lead history cards (PR #204), Contract dossier (PR #205), Place lookup (PR #206), One indicator compare (PR #207/#208), Polling table without averages (PR #209), Edition archive and read API (PR #210/#211), and Premium look (PR #212).
   - *Retired*: The artificial Cloudflare Free tier operations budget ceiling (which previously constrained feature ambition) was explicitly retired in Round 2 and remains retired.

2. **`2026-10-02-publication-reinvention-round-2.md` (Round 2)**:
   - *Status*: Foundation carried forward; superseded as the active sequence by the V1 master plan.
   - *Retained / Merged*: The ten reader priorities (P01–P10), fail-closed source verification, explicit unavailable states, semantic HTML/accessibility commitments, and no-synthetic-index invariant. Tasks 1–11 delivered code assets and test suites.
   - *Open work carried into V1 Waves 1–5*: Tasks 12–16 (full populated comparison studio, live reader assurance, multi-viewport review, and ten-priority production sign-off) are mapped into V1 Waves 1, 2, 4, and 5.

3. **`2026-10-03-publication-reinvention-round-two.md` (Round 2 execution record)**:
   - *Status*: Historical execution ledger; superseded.
   - *Carried forward*: Deployed receipts (e.g. 9 October live verification of `2ef54a4` and 12 October baseline of `5b67730`) are preserved in `docs/operations/revamp-progress.md` and `docs/v1/RELEASE-READINESS.md`.

## Repository-wide duplication, orphan, and boundary audit (W0.03)

- **Source and measure ownership**: Verified by `scripts/check-source-ownership.mjs` across 12 active sources, 5 withdrawn sources, and 5 withdrawn routes. Membership is owned by `worker/feed-registry.js` with public route mapping in `contracts/public-surfaces.json` and definitions in `contracts/measure-definitions.json`.
- **Legacy ingestion retirement**: Verified by `tests/unit/legacy-ingestion-retirement.test.ts`. Unused legacy scrapers, synthetic models, and unbounded collectors are cleanly retired.
- **Worker module typing**: Added `"type": "module"` to `worker/package.json` to ensure clean ES module parsing across the toolchain.
- **Identified fragile boundaries to resolve in Wave 1**:
  1. *Readiness contract mismatch*: `/data/health.json` and `/data/metrics-snapshot.json` degraded state parity (Defect 1).
  2. *Pages fallback policy bypass*: Unfiltered seed consumption in worker recovery paths (Defect 2).
  3. *Multi-KV publication atomicity*: Lack of an atomic commit manifest across publication artifacts (Defect 3).
  4. *No-JS chart fallback*: `ClientOnlyChart` rendering a loading skeleton instead of accessible observation tables.

## Historical record handling

The 1 October, 2 October round-two, and 3 October round-two plans contain useful implementation detail, but their old checkboxes and snapshots are not current proof. They remain preserved as historical evidence and are superseded for execution by [the master plan](MASTER-DELIVERY-PLAN.md). The prior `docs/operations/revamp-progress.md` remains the concise record of signed-off work and prior checks.
