# Public Evidence Reinvention 2026: Round Two Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Each task is an independently reviewable PR; do not bundle unrelated feature work.

**Goal:** Verify and finish the ten public evidence features against live sources and user journeys, then fix only the gaps that fail their acceptance checks.

**Architecture:** Keep the existing Next.js public application and the isolated Cloudflare data Worker contracts. Work in the user's priority order, with source-data repairs separated from UI acceptance work. Production evidence remains fail-closed; each PR contains one bounded behavior change or a verified feature slice.

**Tech Stack:** Next.js, TypeScript/React, Cloudflare Workers, Queues and KV, Vitest, GitHub Actions, and the existing production verification scripts.

**Spec:** `AGENTS.md` (mission, public promise, architecture, evidence contracts, security boundaries and delivery checks); ten feature priorities supplied by the user in this task.

## Global Constraints

- “A missing, stale, incomplete, ambiguous or unreconciled value is `null`/unavailable, never zero, a forecast, an interpolation or a synthetic replacement.”
- “Evidence is editorially separated by source class: official statistics, administrative data, polling and market signals are not joined to manufacture a trend.”
- “Never publish a synthetic crime total or a combined national score.”
- “A degraded edition must declare `meta.publicationState = "degraded"` and an exact `missingRequiredSections` manifest.”
- “Public errors are generic and operational details stay in private logs.”
- “Claim production only after exact-head checks and the affected public journey are observed.”
- “Do not push, merge, deploy or delete material outside the requested scope without explicit authority.”

## Review Focus

- Stale or missing source editions must become unavailable instead of retaining expired values.
- Revisions and source disagreements must remain visible with publication and observation dates intact.
- Different geographies, units, periods and evidence classes must not be combined into one comparison.
- Mobile, keyboard, reduced-motion and no-JavaScript states must preserve access to the evidence and its caveats.
- Public routes must not reveal secrets, account details, cache keys or operational error messages.

---

## PR 0: Make the comparison refresh result observable

**Purpose:** Report whether an explicitly forced comparison refresh succeeded, failed or did not reach a terminal state after the national publication has completed. Comparison failure must not fail or downgrade the national publication.

**Files:**
- Modify: `scripts/bootstrap-cloudflare-publication.mjs`
- Test: `tests/unit/bootstrap-cloudflare-publication.test.mjs`

- [x] Add a failing test where the national run finalises before the comparison terminal appears.
- [x] Add tests for success, failure and timeout/missing terminal; assert diagnostics omit raw source errors.
- [x] Implement a bounded poll of the run-scoped comparison terminal only when a forced comparison refresh was requested.
- [x] Keep national success independent of comparison status and print only the safe status and completion time.
- [x] Run the bootstrap tests, full Vitest suite, lint and `git diff --check`.
- [ ] After merge, use the protected recovery run to inspect the comparison outcome before changing source collectors.

## PR 1: Vibrant 538-inspired redesign

**Files:** `app/` layout and styles; affected component tests under `tests/unit/`.

- [ ] Verify homepage, topic, measure, polling, comparison and article layouts at desktop and 390px mobile widths.
- [ ] Verify keyboard search open/select/navigation, visible focus, semantic headings and reduced-motion behavior.
- [ ] Verify primary evidence and source caveats remain readable without JavaScript.
- [ ] If a check fails, add the smallest regression test, fix only the failing presentation path, and rerun the affected tests and production build.
- [ ] Record screenshots or browser evidence with the PR; do not create a PR for a verification-only pass.

## PR 2: Measure library and atlas

**Files:** `app/components/MeasureLibrary.tsx`, `app/lib/measureCatalog.ts`, `app/lib/measureAvailability.ts`, `app/measure/`, `tests/unit/MeasureLibrary.test.tsx`, `tests/unit/measureCatalog.test.ts`, `tests/unit/measureAvailability.test.ts`.

- [ ] Verify the eight canonical measures have a usable definition, unit, geography, observation period, publication date and direct source.
- [ ] Verify catalog search, measure deep links, unavailable states, historical publication points and downloads.
- [ ] Add a failing regression test for each missing contract; make a separate source-data PR if a catalog entry cannot be proved.
- [ ] Run the three affected test files, lint and the application build.

## PR 3: Comparison studio

**Files:** `app/compare/page.tsx`, comparison UI/library files, `tests/unit/international-comparison-ui.test.ts` and related comparison UI tests.

- [ ] Verify a shared URL restores the exact selected measures and countries.
- [ ] Verify CSV/JSON exports preserve units, years, denominators, unavailable values and source URLs.
- [ ] Verify keyboard and mobile operation and that no synthetic average or combined score appears.
- [ ] Fix only failed studio behavior; keep live country-source repair in PR 9.
- [ ] Run the affected UI tests, lint and application build.

## PR 4: Dated briefing, stories and RSS

**Files:** `app/briefing/page.tsx`, `app/components/BriefingEdition.tsx`, `app/feed.xml/route.ts`, `tests/unit/briefing.test.tsx` and any feed tests added for a failed contract.

- [ ] Verify a dated briefing links each claim to its primary source and shows observation/publication dates and revisions.
- [ ] Verify RSS validates, exposes stable item identifiers and links to the matching story and retained edition.
- [ ] Verify archive details work on the normal Worker and bounded Pages export paths.
- [ ] Add a regression test and one focused fix PR per failed behavior; run affected tests and build.

## PR 5: Release calendar and watchlist

**Files:** `app/calendar/page.tsx`, `app/components/ReleaseCalendar.tsx`, `app/lib/releaseCalendar.ts`, `tests/unit/ReleaseCalendar.test.tsx`, `tests/unit/releaseCalendar.test.ts`.

- [ ] Verify source-published dates, timezone handling and calendar export against the source release calendar.
- [ ] Verify watchlist add/remove and persistence across reloads without collecting personal data.
- [ ] Verify mobile, keyboard and empty/error states.
- [ ] Add tests for any failure and run both calendar tests, lint and build.

## PR 6: Cost-of-living lens

**Files:** `app/cost-of-living/page.tsx`, `app/components/CostOfLivingLens.tsx`, `tests/unit/CostOfLivingLens.test.tsx`, and the responsible source collector tests.

- [ ] Verify private rent and house-price observations are separately identified with units, geographies and like-for-like periods.
- [ ] Verify missing rent or stale house-price data stays unavailable and is not backfilled from another measure.
- [ ] Verify source links, revision caveats, downloads and mobile layout.
- [ ] If the production rent source is missing or stale, open a collector-only PR after proving the primary source and reconciliation rules.
- [ ] Run the lens and affected collector tests, lint and build.

## PR 7: Polling lab

**Files:** `app/components/ElectionPolling.tsx`, `app/components/PollingPublicationChart.tsx`, polling library and worker source files, `tests/unit/ElectionPolling.test.tsx`, `tests/unit/PollingPublicationChart.test.tsx`, `tests/unit/pollingLab.test.ts`, and `tests/worker/more-in-common-polling.test.ts`.

- [ ] Verify every displayed poll has a primary publication link, pollster, fieldwork dates, publication date, sample/geography where supplied and attribution.
- [ ] Recheck each unavailable archive against the publisher; add only verified publications and retain missingness for unavailable files.
- [ ] Verify pollsters remain separate and no synthetic polling average is shown.
- [ ] Run affected unit/worker tests, lint and build; keep each pollster/source repair in a separate PR.

## PR 8: Public-money dossiers

**Files:** `app/components/GovernmentContracts.tsx`, contract publication/chart modules and their `tests/unit/government-contract*` tests.

- [ ] Verify notice, buyer and supplier views reconcile to the same contract identifiers and source publication.
- [ ] Verify amendment, cancellation, amount and date changes remain traceable to notices.
- [ ] Verify downloads preserve source identifiers and do not label spending as waste, fraud or savings without direct evidence.
- [ ] Run affected contract tests, lint and build; split source retrieval fixes from UI fixes.

## PR 9: Country comparisons

**Files:** `app/components/InternationalComparison.tsx`, `app/lib/internationalComparison.ts`, `app/lib/serverInternationalComparison.ts`, `worker/international-comparison-sources.js`, `worker/international-comparison-publication.js`, `tests/unit/international-comparison*.test.ts`, and `tests/worker/international-comparison*.test.ts`.

- [ ] After PR 0 reports the production comparison terminal, use its safe status and source identifiers to choose the smallest source-specific investigation.
- [ ] Verify each of the seven measures uses its declared source, observation year, value status and comparable-country denominator.
- [ ] Verify the production route updates with the expected edition and clearly reports unavailable measures; source failure must remain isolated from national readiness.
- [ ] Fix each failing source contract in a separate PR; run the affected worker tests, lint, worker build and exact public route check.

## PR 10: Source, revision and archive ledger

**Files:** `app/sources/`, `app/editions/`, `app/lib/serverEditionArchive.ts`, archive components and `tests/unit/editionArchiveRoute.test.ts`, `tests/unit/serverEditionArchive.test.ts`, `tests/worker/edition-archive.test.ts`.

- [ ] Trace one public claim from registry/source through measure, revision and retained edition.
- [ ] Verify a withdrawn or expired source no longer appears current and its retained edition remains attributable.
- [ ] Verify archive detail and export behavior through the production routes and Pages fallback.
- [ ] Add regression coverage for a failed link in the chain; run affected tests and build.

## Final delivery: CI and release time

**Files:** `.github/workflows/pr-validation.yml`, `.github/workflows/deploy.yml`, and `docs/operations/deployment-ci-frugality.md` only if workflow behavior changes.

- [ ] Record current PR, deployment and protected recovery runtimes from GitHub runs.
- [ ] Remove duplicate work only where a measured gate repeats a completed check; preserve source/architecture guards, lint, repository tests, one application build, protected deployment, exact-head and public-route checks.
- [ ] Test a docs-only PR, a normal PR and a protected recovery dispatch before claiming the gate is faster.

## Completion gate

- [ ] All ten priority journeys have current evidence or an honest unavailable state and pass their listed checks.
- [ ] Every changed PR passes its smallest falsifying test, affected unit/worker tests, lint and relevant production build.
- [ ] Check the exact deployed SHA and observe each affected public journey before calling it live.
- [ ] Report remaining unavailable source families explicitly; do not equate a green CI run with complete public evidence.
