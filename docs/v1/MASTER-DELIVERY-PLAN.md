# public-data.org V1 master delivery plan

**Status:** Active programme; Wave 0 evidence is being consolidated.
**Scope:** Option B, all ten V1 capabilities.
**Authority:** This is the sole execution plan. The three reinvention plans under `docs/superpowers/plans/` remain historical implementation evidence.

## Objective

Complete and launch a coherent, source-backed public evidence publication with ten integrated capabilities. Build on the current product: inspect what exists, verify it, fix demonstrated gaps, and avoid rewriting working features for process or novelty. A capability is not complete because its route renders, code exists, a test passes, or a PR merges. It needs functional, browser, evidence, production, and independent sign-off evidence.

Evidence publication is separately controlled. Keep every unapproved source family held. Missing, stale, incomplete, ambiguous, or unreconciled evidence is unavailable, never zero or invented. A capability may be code-complete while its evidence remains held, but that does not satisfy the complete Option B launch bar.

## Decision hierarchy and invariants

1. Explicit user requirements and publication authorization.
2. Current production behavior and verified primary-source evidence.
3. Executable code, public contracts, and current automated tests.
4. Approved architecture decisions.
5. This plan.
6. Historical plans, audits, and old checkboxes.

- No publication switch changes without explicit user authorization after source-specific review.
- PR #213 is a reference-only visual experiment and must not be merged. Do not merge PR #214 wholesale; assess any useful work against the architecture, acceptance requirements and its required separate reviews.
- Do not add paid spend, publish, deploy, or merge beyond the user's requested scope.
- Keep official statistics, administrative records, polling, and market signals distinct.
- Every public claim names its measure, period, geography, unit, publication date, primary source, and material caveat.
- Public routes and evidence readiness are distinct. A held source may have a useful explanatory page, while its data endpoints remain unavailable.
- Preserve semantic HTML, keyboard access, visible focus, contrast, text alternatives, mobile reflow, and reduced-motion behavior.
- Public responses must not expose credentials, KV keys, Queue state, private diagnostics, or collector internals.

## Definition of V1 and acceptance contract

Every priority below requires all five acceptance dimensions: functional behavior, representative browser journey, reconciled evidence or a clearly reported hold, verification on the intended production revision, and named independent sign-off. The state of the supporting publication must be recorded separately from feature state. A held or empty demonstration is not a completed capability.

| ID | Required reader outcome | Lead and independent sign-off | Minimum acceptance outcome |
|---|---|---|---|
| P01 | Distinctive editorial publication across desktop and mobile | A03 + A14 | One design system across all journeys; real verified content; accessible navigation, charts, tables, reduced motion, and four-viewport review; critical context and history tables readable without JavaScript; no unsupported claims. |
| P02 | Searchable measure atlas and supported place discovery | A05 + A14 | Search/filter/deep-link/export flow; every measure reconciled to its definition and source; geographic claims use only source-supported boundaries and observations; audit every topic chart for unit, axis, gap, table and export parity. |
| P03 | Comparison studio | A06 + A14 | Compatible measures only; disclosed periods, units, geography, missingness and transformations; shareable/restorable state and export parity. |
| P04 | Dated briefings, evidence-led stories, and RSS | A07 + A14 | A meaningful change links through story and measure to its cited immutable edition; stable valid feed; editorial fact-check. |
| P05 | Release calendar and local watchlist | A08 + A14 | Publisher-announced dates, unknown/delayed/cancelled states, valid ICS, local-only watchlist, and change detection based on evidence rather than retrieval time. |
| P06 | Cost-of-living evidence | A09 + A14 | Prices, pay, rents, housing and rates retain distinct concepts, periods and geographies; source-reconciled values and no synthetic household score. |
| P07 | Polling laboratory | A10 + A14 | At least two independently verified pollsters, original publication links, fieldwork/sample metadata where supplied, visible corrections, no fabricated average. |
| P08 | Public-money investigation | A11 + A14 | Searchable source notices and buyer/supplier trails; declared complete universe; amendments and cancellations; no duplicate awards or unsupported wrongdoing claims. |
| P09 | International comparisons | A12 + A14 | Country/measure/year/status selections disclose denominators, incompatible years, missingness and exclusions; export reproduces the displayed data. |
| P10 | Source provenance, revisions, and archive | A13 + A14 | A reader can trace a real claim through measure, observation, source edition, public edition, and genuine revision; advertised archive details retrieve immutably. |

## Ownership and interfaces

| Role | Accountable area |
|---|---|
| A00 Programme Director | Scope, integration order, blockers, launch dashboard and final decision record. |
| A01 Repository Archaeologist | Existing code, historical decisions, duplication and implementation inventory. |
| A02 Principal Architect | Canonical contracts, ownership boundaries, runtime interfaces and integration dependencies. |
| A03 Design Director | Visual system, editorial templates, navigation and design acceptance. |
| A04 Evidence Platform Engineer | Source registry, retrieval, verification, currentness and publication pipeline. |
| A05 Atlas Engineer | Measure catalog, measure detail, geography and place discovery. |
| A06 Comparison Engineer | Compatibility rules, comparison state, visualisation and export fidelity. |
| A07 Editorial Engineer | Briefings, stories, RSS and evidence-aware editorial transitions. |
| A08 Calendar Engineer | Official release schedules, watchlist and ICS. |
| A09 Cost-of-Living Engineer | Price, pay, housing and interest-rate journeys. |
| A10 Polling Engineer | Pollster records, corrections, metadata and polling interface. |
| A11 Public-Money Engineer | Procurement universe, notices, dossiers and source-reproducible totals. |
| A12 International Data Engineer | Country source adapters, compatible comparisons and exclusions. |
| A13 Provenance Engineer | Immutable editions, revision semantics, source lineage and archive. |
| A14 Independent Quality Auditor | Independent code, evidence, accessibility, browser, performance and release review. |
| A15 Release and Operations Engineer | CI, exact-revision release, production smoke checks, recovery and handover. |

`worker/feed-registry.js` currently owns source membership and retrieval policy; public contracts own public shapes. Any ownership change must be explicit, backward-compatible where needed, and reflected in `AGENTS.md`, tests and the interface inventory. Feature teams consume agreed interfaces; they do not create parallel catalogs or publication rules.

## Controlled delivery waves

### Wave 0 — Establish production truth

**Exit before broad redevelopment:** dated production and GitHub baseline; item-level classification of the three historical plans; repository-wide duplicate/orphan/dead-path audit; classification of all ten priorities; separate PR #214 architecture review; fresh baseline checks and representative browser journeys; six V1 records established; unresolved evidence/operations gaps named; no unsupported completion percentage.

Tasks: W0.01 record release, PR/CI, public route, configuration and endpoint evidence; W0.02 classify the three earlier plans; W0.03 inspect current and legacy code for duplicate ownership, unused paths and fragile boundaries; W0.04 assess PR #214 by retain/rewrite/reject disposition; W0.05 rerun meaningful tests and browser paths; W0.06 consolidate this plan and its five factual records.

**Current result:** the six-document milestone, ten-priority inventory, ONS evidence check, design review, PR #214 assessment, plan-by-plan reconciliation (W0.02) and repository-wide duplication/orphan audit (W0.03) are complete and recorded in `IMPLEMENTATION-INVENTORY.md`. A14 reran the unit suite, lint, toolchain, and static architecture/source-ownership checks; local browser journeys and exact-head toolchain checks passed. **Wave 0 exit criteria are satisfied.** Active execution transitions to **Wave 1 — Consolidate foundations**. Hosted candidate quality and production verification remain outstanding release gates.

### Wave 1 — Consolidate foundations

Owners A02, A04, A13, A15. Agree canonical source/measure identity; publication decisions and fail-closed migration; public/private route ownership; currentness and revision semantics; immutable edition commit/recovery behavior; useful PR #214 changes; demonstrated duplication retirement; existing CI/release contracts; and an interface contract for feature work.

**Gate:** one owner per public evidence concept; no held evidence leaks; existing APIs remain compatible or have tested migration; named disposition for obsolete implementations; integration branch passes required `quality` check.

### Wave 2 — Complete the ten reader capabilities

Owners A03 and A05–A12; A04/A13 support shared evidence and provenance interfaces. Deliver P01–P10 in parallel only after Wave 1 contracts are stable. Design tokens and page templates precede major feature styling. Comparison consumes atlas contracts; stories reference immutable editions; calendar uses canonical measure identifiers. Each work package inspects the existing feature, identifies a proven gap, adds focused regression coverage, implements the full reader outcome, and provides a reviewable change.

**Gate:** local functional and representative browser acceptance for every capability. Data may still be held pending Wave 3.

### Wave 3 — Qualify evidence and publication

Owners A04, A10–A13. Reconcile ONS/BoE, housing/rents, NHS through an approved retrieval path, multiple pollsters, procurement completeness and identities, international source series, archive revisions, and announced release dates. Produce source-specific verification and activation recommendations.

For each family: collector works; primary values reconcile; provenance/currentness are valid; reader page/charts/exports agree; archive behavior is correct; independent evidence review passes; then obtain explicit user authorization before enabling; inspect the actual production result afterward. No blanket activation.

**Gate:** every family has an evidenced state, owner, and launch consequence; only individually verified and authorized families are public.

### Wave 4 — Integrate and independently assure

Owners A00, A02, A14. Test cross-feature navigation and edition consistency; same-observation parity across home, detail, comparison, stories, downloads and archive; visual/accessibility consistency; publication isolation in secondary routes; populated, sparse, stale, degraded, unavailable and held cases; performance and security.

**Gate:** all ten journeys pass independent acceptance; no unresolved critical/high-severity defect; inconsistent public evidence cannot escape through an alternate route.

### Wave 5 — Release and hand over

Owners A15, A00, A14. Freeze exact revision; run dependency, test, build and contract checks; deploy only through the requested controlled release; verify deployed SHA and routes; separately approve any source activation; verify each activated family’s page/API/export/archive; exercise rollback outside production; publish operating instructions, limitations and approved states; record formal acceptance.

**Gate:** production is the intended SHA; ten capabilities have meaningful production journeys; evidence states and approvals are explicit; rollback/recovery is proven; A14 and A00 sign-off is recorded. Do not claim Option B complete with a substantial mandatory capability empty, unverified or held indefinitely without an expressly revised scope.

## Integration rules

- Each implementation change has one bounded owner, a defined interface, focused checks, an independent review, and an integration point. Use isolated worktrees when parallel changes would otherwise share files.
- Do not begin broad redevelopment before Wave 0 inventory and Wave 1 interfaces. Independent read-only source checks and design exploration may continue.
- Avoid wholesale merges of architectural branches. Port the useful, verified ideas through compatible, reviewable changes.
- Keep commits and remote updates at meaningful reviewed milestones; run exact-head quality checks before pushing, and report the branch/revision so the IDE can stay on the intended workspace.
- Before calling any task complete, update the relevant factual record and this plan's current wave/gate state.

## Release dashboard and final acceptance

The release dashboard in `RELEASE-READINESS.md` records implemented/local/production/approved counts per capability; open defects by severity; source-family status; primary-source reconciliation; route and critical-journey results; accessibility/performance/security evidence; active release blockers; exact deployment revision; rollback; and named sign-off. Never substitute PR count, code volume, or agent activity for these measures.

The final acceptance matrix is the P01–P10 table above plus recorded functional, browser, evidence, production, publication-state and independent-review results. Every data activation remains a separate user-authorized action.
