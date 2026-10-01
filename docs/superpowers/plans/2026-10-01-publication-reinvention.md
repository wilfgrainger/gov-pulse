# Public-data.org Reinvention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair every existing evidence/chart journey and deliver exactly ten capabilities in a vibrant UK public-data publication.

**Architecture:** Reuse source collectors and Cloudflare ingestion, with one canonical measure catalog and prepared edition artifacts consumed by every page/chart/export. Retain Next/OpenNext initially, measure Free feasibility early, and change the production renderer only if its verified resource constraints require it. Interactions/watchlists run in the browser.

**Tech Stack:** Pinned Node 24.17.0/npm 11.13.0, Next.js/React/TypeScript, existing Recharts/SVG, Vitest/Playwright, Cloudflare Workers/Queues/KV/static assets. No required paid product or API.

**Spec:** `docs/superpowers/specs/2026-10-01-publication-reinvention-design.md`

**Review:** `docs/superpowers/specs/2026-10-01-publication-reinvention-review.md`

## Global Constraints

- Hard constraint: deployed hosting/runtime uses Cloudflare Free only.
- Missing inputs must remain honestly unavailable.
- Previously verified historical editions may be read as history, with explicit as-of dates, without being promoted to current headlines.
- No auto-upgrade or paid billing fallback.
- Interactive filtering/comparison/export runs in the browser.
- No accounts/tracking.
- No fabricated history, synthetic average or seat forecast.
- Bar magnitude scales start at zero; fitted line scales disclose their bounds.
- No decorative smoothing or invented interpolation.
- Do not label award values as paid spending or size as waste.
- Production remains untouched until explicitly authorized. User authorization permits rearchitecture and amendment/removal of conflicting Markdown.
- Use the existing cloud checkout. Do not create a worktree unless the user explicitly requests one. Preserve unrelated user work.
- Fixtures used for browser tests are explicitly test evidence and never enter production publications.
- Keep at least 20% measured headroom against each enforced limit in the agreed workload; respect hard per-request/per-key limits.
- Initial Worker workbook limits are 8 MiB expanded per retained entry, 24 MiB total expanded retained content, 25,000 rows per worksheet and 250,000 parsed cells per workbook.

## Review Focus

1. A release expires while a page stays open or an intermediary serves cached JSON: current cards/charts/downloads must stop showing it. Tasks 5, 7, 8, 19.
2. A notice revises an award down below a daily truncation threshold: later revision must win across the complete window. Tasks 3, 16.
3. A poll is weighted/nonprobability or omits methodological fields: total n must not become publisher-reported uncertainty. Tasks 6, 15.
4. Old/new Workers deploy in different order or rollback: supported schemas remain readable and private operations never become public. Tasks 7, 19.
5. A copied chart or historical edition is read outside its original context: source, date, unit, caveat and as-of status must travel with it. Tasks 8, 11, 18.

## Execution structure

This is a programme plan, split into independently testable delivery tranches. The first two tasks establish the exact current inventory and feasibility. Continue independent work when a source is blocked, but never mark a source-dependent feature complete without its stated acceptance evidence. Do not silently shrink the ten features.

Recommended long-running execution: one coordinator maintains this checklist and the approved spec; focused implementers and independent reviewers work by tranche. Parallel work is appropriate after contracts land, for non-overlapping topic features. Canonical contracts, currentness and deployment changes remain sequential. Make a focused commit after each passing/reviewed task; keep PRs within existing reviewable limits where possible. A focused PR sequence is preferable to disabling complexity gates globally.

Before each task: read current status/HEAD, inspect relevant code/tests, write and run the falsifying test, then implement. After each: run affected tests, resolve review findings, inspect diff/status and commit only owned paths. A failing live source is diagnosed separately from a parser test. Keep a concise task log with commands and outcomes; no volatile production snapshots in repository guidance.

Activate tools in each terminal:

```bash
export PATH=/workspace/toolchains/gov-pulse/node_modules/.bin:$PATH
export npm_config_cache=/workspace/.npm-cache
cd /workspace/gov-pulse
npm run toolchain:check
```

## File boundaries and shared interfaces

Keep source parsing in `worker/`; evidence schemas in `contracts/`; presentation selectors in `app/lib/`; charts in `app/components/charts/`. Avoid creating a generic connector framework. Existing topic components may become thin compositions. All records validate before publication.

Task 7 creates `contracts/measure-record.js` (runtime validation/comparability), `contracts/measure-record.d.ts` (consumer declarations), `worker/measure-catalog.js` (normalisation), and `app/lib/measureCatalog.ts` (shared delivery/selectors). Declaration/runtime consistency is tested.

```ts
type EvidenceClass = 'official-statistics' | 'administrative-data' | 'polling' | 'market-signal';
type Availability = 'current' | 'historical' | 'unavailable';
type MeasurePoint = {
  period: string; observedAt: string; value: number | null;
  valueStatus: 'observed' | 'estimate' | 'projection'; revisionId: string;
};
type MeasureRecord = {
  id: string; label: string; evidenceClass: EvidenceClass;
  comparisonKey: string; cadence: string; unit: string; basis: string;
  geography: { code: string; label: string };
  sourceId: string; sourceUrl: string; sourceEditionId: string;
  observationPeriod: { start: string; end: string; label: string };
  publishedAt: string; fetchedAt: string; validUntil: string | null;
  availability: Availability; value: number | null;
  revisionId: string; points: MeasurePoint[]; caveats: string[];
};
type MeasureCatalog = {
  schemaVersion: 2; editionId: string; generatedAt: string;
  validUntil: string | null; measures: Record<string, MeasureRecord>;
};
type DateWindow = { start: string; end: string };
type EditionSummary = {
  id: string; publishedAt: string; sourceEditionIds: string[];
  changes: { measureId: string; kind: 'new-observation' | 'revision' | 'method-change';
    observedAt: string | null; period: string | null;
    previousSourceEditionId: string | null; nextSourceEditionId: string;
    previousRevisionId: string | null; nextRevisionId: string;
    previous: number | null; next: number | null }[];
};
```

All wire timestamps are validated and normalized ISO 8601 UTC strings; date-only
period labels remain separate. `comparisonKey` includes semantic measure family/definition, not merely `%`; geography, unit, basis, evidence class and cadence must also match to permit overlay. Unknown validity permits explicit history, never an unproved current card. Poll rows and procurement notices remain their source-specific contracts; a catalog may expose scalar observations from them without flattening their disclosures.

Task 7 exports `validateMeasureRecord(input: unknown): MeasureRecord`, `compareEligibility(a: MeasureRecord, b: MeasureRecord): 'overlay' | 'panels'`, `selectMeasure(catalog: MeasureCatalog, id: string, now: Date): MeasureRecord | null`, and `buildMeasureCatalog(snapshot: unknown, now: Date): MeasureCatalog`.

Task 8 exports `EvidenceFigure({measure, title, description, window, variant})`, with `variant: 'line' | 'step' | 'bar' | 'dot'`, and `clipPoints(points: MeasurePoint[], window: DateWindow): MeasurePoint[]`. `ExportPackage` contains title, measures, dateWindow and caveats; export helpers consume it, not a bare title string.

Task 12 exports `buildEditionSummary(previous: MeasureCatalog | null, next: MeasureCatalog): EditionSummary`. Task 13 exports `ReleaseEvent` with measureId, publisherUrl, date, certainty (`published`/`estimated`) and timezone, plus `buildCalendar(events: ReleaseEvent[]): string`. Task 18 consumes the same `EditionSummary`; no competing change detector.

## Task 1: Reconcile inventory and remove obsolete programme vetoes

**Files:** Modify `AGENTS.md`, `north_star.md`, `roadmap.md`, `tasks.md`, both delivery READMEs, existing architecture/operations guidance; create `docs/architecture/decisions/0002-publication-reinvention.md`, `contracts/public-surfaces.json`, `contracts/measure-coverage.json`; update `scripts/check-static-architecture.mjs`, `scripts/check-hosting-boundary.mjs`, `tests/unit/visualSystem.test.ts`. Change complexity tooling only if a necessary reviewed tranche exceeds its limits.

**Interfaces:** `public-surfaces.json` declares exact public route patterns and denies internal collection/run routes. `measure-coverage.json` maps each active topic/component/displayed measure to its canonical id or an explicit withdrawal. Both are consumed by later coverage tests. Export `publicRouteAllowed(path: string): boolean` from the guard's shared `scripts/lib/public-surfaces.mjs` implementation; use the same manifest in tests and route guards.

Planning already added supersession notices and an authorized-reinvention
section to `AGENTS.md`; inspect these before editing. The task still owns full
replacement guidance, inventories and executable guard/test alignment.

- [ ] Write `tests/unit/publication-programme.test.ts` asserting every current topic is covered, new bounded route patterns accepted, private collectors rejected, and historical scope docs are not active authority.
- [ ] Run `npx vitest run tests/unit/publication-programme.test.ts`; verify it fails against current fixed-route/preferences.
- [ ] Apply the review's amendment table. Preserve audits/withdrawal reasons; mark old scope contracts historical. Correct NHS/real-wage membership, used Framer Motion, bootstrap and budget descriptions against actual code.
- [ ] Verify `expect(unmappedDisplayedMeasures).toEqual([])` and `expect(publicRouteAllowed('/internal/collect')).toBe(false)`; run source/hosting/governance guards.
- [ ] Review and commit the governance/inventory tranche. No unrelated document deletion.

## Task 2: Prove source and Cloudflare Free feasibility

**Files:** Create `scripts/audit-free-budget.mjs`, `tests/unit/freeBudget.test.ts`, `docs/operations/free-resource-budget.md`, and source feasibility notes under `docs/evidence-audit/`; modify `worker/xlsx-workbook.js`, add `tests/worker/workbook-limits.test.ts`; adjust job budget constants in `worker/queued-publication-entry.js` only after calculation.

**Interfaces:** `deriveScheduledWork(registry, crons): { messagesPerDay: number; operationsPerDay: number }`; explicit scenario inputs cover retries, traffic, cache misses and storage. Publish no credential values.

Workbook decoding accepts a validated limits object with `maxEntryBytes`,
`maxTotalBytes`, `maxWorksheetRows`, `maxWorkbookCells`. Worker defaults are
8*1024*1024, 24*1024*1024, 25000 and 250000 respectively. The limits are consumed
by stream-counted inflate and worksheet parsing; do not first allocate the
unbounded decoded result and reject it afterwards.

- [ ] Test the current healthy schedule: `expect(work.messagesPerDay).toBe(29)` and `expect(work.operationsPerDay).toBe(87)` before retries. Test registry additions change the budget and failed jobs consume retry operations.
- [ ] Run `npx vitest run tests/unit/freeBudget.test.ts`; verify current hardcoded maximum fails.
- [ ] Write/run failing workbook tests: highly compressed entry expands to 8 MiB + 1 and is rejected before accumulation; aggregate entries exceed 24 MiB; stored entries obey the same cap; worksheet row and total cell caps reject over-bound inputs; forged ZIP size fields do not bypass byte counts. Named real publication fixtures below caps still reconcile.
- [ ] Implement expansion/row/cell bounds and account for string/XML allocations; run `npx vitest run tests/worker/workbook-limits.test.ts` and affected XLSX/NHS tests.
- [ ] Confirm current official limits and account Free settings when network permits. Measure representative OpenNext routes and largest accepted workbook/PDF jobs. Document low/expected/peak traffic and at least 20% target headroom; test per-key/per-request hard limits.
- [ ] Prove named primary-source routes for rent history, a second pollster, MOJ and Early Years. Reuse NHS trusted importer; check existing credential names/presence and actual authorized operation before requesting secure bindings.
- [ ] If renderer measurement fails, invoke the design's thin-Worker contingency and write a focused replacement spec/plan before cutover. If a source is blocked, record exact destination/operation and continue independent tasks.
- [ ] If valid ingestion exceeds Free CPU/memory, prove independently bounded module/sheet decomposition or reuse the approved free trusted-ingest pattern with identical validation. If neither works within a verified free allowance, mark the source blocked; do not raise limits blindly or substitute unverifiable data.
- [ ] Review and commit verified tooling/methodology. This task cannot be declared passed using repository-stated quotas alone.

## Task 3: Repair procurement versions and geographic truth

**Files:** Modify `worker/government-contracts-cloudflare.js`, `contracts/government-contracts.js`, `tests/unit/government-contracts-publication.test.ts`, `tests/unit/government-contracts-contract.test.ts`; add `tests/fixtures/contracts/downward-amendment.json`.

**Interfaces:** Existing `rankDailyAwards`/`buildContractsFromShards` retain caller compatibility or use explicitly versioned shard migration. Preserve full bounded revision identity before top-N.

- [ ] Add downward-amendment fixture: £1m award becomes £1 amid 100 £2k awards; assert no £1m version remains. Add cancellation, duplicate/latest notice and incomplete-window cases.
- [ ] Add geographic assertions: SY1/TD15 border areas require exact official lookup; Jersey/garbage cannot become England. Proven input codes classify correctly; missing lookup returns unknown.
- [ ] Run focused contract/publication tests and confirm regressions fail.
- [ ] Resolve complete-window versions before truncation, preserving bounded payloads. Use official identifiers or a reproducible static join; remove heuristic geography claims.
- [ ] Run affected procurement/Worker tests, budget checks, review and commit.

## Task 4: Repair independent international measure lifecycle

**Files:** Modify `worker/international-comparison-publication.js`, `worker/international-comparison.js`, `tests/worker/international-comparison-publication.test.ts`, `tests/worker/international-comparison-route.test.ts`.

**Interfaces:** Retain isolated comparison route; add per-measure source edition, validity, last-success and retry metadata without breaking current fields.

- [ ] Assert a transient healthcare-source failure retains a still-valid denominator of 13 and retries independently; genuine source missingness remains missing. Expired data cannot be retained.
- [ ] Assert old generated timestamps cannot masquerade as current validity; historic observation years remain explicitly valid historical evidence under their source policy.
- [ ] Run focused tests red, implement per-measure merge/expiry/due handling, then rerun green.
- [ ] Verify failed comparison never downgrades national readiness; review/commit.

## Task 5: Finish currentness, cache and server/browser parity

**Files:** Modify `worker/section-builders.js`, `worker/publication-currentness.js`, `worker/public-data-entry.js`, `app/lib/useMetrics.ts`, `app/components/NHSStats.tsx`, `scripts/trusted-nhs-rtt-ingest.mjs`; tests in `tests/worker/publication-currentness.test.ts`, `tests/worker/cloudflare-public-api.test.ts`, `tests/unit/NHSStats.test.tsx` and a trusted-ingest regression.

**Interfaces:** Reuse explicit-expiry and partial-finalisation APIs. Add `cacheLifetime(validUntil: string, now: Date): number` clamped to nonnegative seconds; no stale allowance across deadline.

- [ ] Fixed-clock test: valid evidence survives failed retrieval; expires exactly at `validUntil`; indicator measures expire independently; unchanged fetch does not renew validity.
- [ ] Assert cache reuse ends before expiry, including an intermediary/foreground-open page. Assert browser current values are removed at expiry even if refresh fails.
- [ ] Assert a current NHS fixture is visible in server HTML and matches hydration/no-JS. Assert trusted ingest finalisation publishes the exact accepted fragment, with bounded KV readback retry.
- [ ] Run affected suites red; implement shared clock/currentness decisions and accepted-to-public lifecycle; rerun green.
- [ ] Review API/privacy boundaries and commit.

## Task 6: Source-parser and editorial correctness pass

**Files:** Modify `worker/real-wages.js`, `worker/live-polling-collector.js`, `worker/live-crime-collector.js`, `app/components/EarlyYearsStats.tsx`, `app/components/RealWages.tsx`, `app/components/MigrationStats.tsx`, `app/lib/nationalEvidence.ts`; create `worker/moj-court-source.js`, `worker/early-years-source.js`, `app/lib/changeLanguage.ts` and relevant source tests/fixtures.

**Interfaces:** `describeChange(value: number | null): 'rose' | 'fell' | 'was unchanged' | 'unavailable'`; source collectors return existing validated module contracts with edition identity, not synthetic replacement data.

- [ ] Signed/zero/Unicode-minus wage fixtures must parse and reconcile. `expect(describeChange(0)).toBe('was unchanged')`; null is unavailable; negative descriptions use absolute magnitude, not “fell -x”.
- [ ] Poll metadata must match exact primary tables; absent or contradictory fields fail the claimed disclosure. SRS sample-size calculation cannot be described as publisher uncertainty.
- [ ] MOJ source discovery validates module identity/period; stale checked-in fallback cannot look freshly collected. Early Years dated records validate all numbers, source identities/dates and change wording.
- [ ] Run parser/component regressions red, implement supported extraction/validation, then rerun all affected tests.
- [ ] Record authoritative fixture provenance and source limitations; review/commit. Do not claim live collection from fixture success.

## Task 7: Canonical catalog and additive publication migration

**Files:** Create the four contract/catalog files specified above; modify `worker/feed-registry.js`, `worker/publication-entry.js`, `worker/queued-publication-entry.js`, `app/lib/metricsSnapshot.ts`, `app/lib/nationalEvidence.ts`, `app/lib/dataExplorer.ts`, `app/lib/evidenceSearch.ts`, `app/lib/sections.ts`; create `tests/unit/measureCatalog.test.ts`, `tests/worker/measure-catalog.test.ts`.

**Interfaces:** Produce the shared types/functions in the interface section. Current endpoints remain readable during migration. Catalog cache/input expiry is validated, never inferred from `generatedAt`.

- [ ] Inventory coverage: `expect(unmappedDisplayedMeasures).toEqual([])`; all consumers select identical value/period/source/status at a fixed clock. Test missing, future, expired and method-break records.
- [ ] `expect(compareEligibility(debtRatio, unemployment)).toBe('panels')` despite both units being `%`; compatible same-definition records permit overlay.
- [ ] Old snapshot/new consumer and new additive snapshot/old consumer contract tests fail before implementation.
- [ ] Implement normalisation and registry-generated search/counts; avoid flattening source-specific poll/procurement disclosure.
- [ ] Run catalog/currentness/components/Worker suites; review migration and commit.

## Task 8: Repair and standardize every existing evidence figure

**Files:** Create `app/components/charts/EvidenceFigure.tsx`, `app/components/charts/ObservationTable.tsx`, `app/lib/chartModel.ts`; modify shared financial/poll/sparkline charts, `ChartExportButtons.tsx`, `chartExport.ts`, and all chart-owning topic components; create `tests/unit/EvidenceFigure.test.tsx`, extend export tests and add `tests/e2e/evidence-figures.spec.ts`.

**Interfaces:** Produce `EvidenceFigure`, `clipPoints` and `ExportPackage` defined above. Reuse Recharts/SVG unless measurement shows a reason to replace them.

- [ ] `expect(clipPoints(points, window).every(p => p.observedAt >= window.start && p.observedAt <= window.end)).toBe(true)`; gaps/method breaks never join silently.
- [ ] Assert zero-baseline bars, explicit fitted axes, distinguishable dashed legends, exact latest-point/headline equality and same period/unit on the table.
- [ ] SSR/history table exists without JS; first hydration markup matches; PNG capability appears only after mount. Assert exported sources/periods/caveats and footer position at multiple rendered SVG sizes.
- [ ] Run regressions red; implement common figure and migrate all 16 shared-chart uses plus poll, sparkline and procurement bars.
- [ ] Run populated mobile/keyboard/no-JS tests and export checks, then review/commit.

## Task 9: Feature 1 — complete vibrant editorial identity

**Files:** Modify `app/globals.css`, `app/layout.tsx`, `BrandLogo.tsx`, `SectionNav.tsx`, `PageHeader.tsx`, `HomepageIntro.tsx`, `NationalEvidenceEdition.tsx`, `SiteFooter.tsx`, source/trust/topic/explorer layouts and social-card generation; update `tests/unit/visualSystem.test.ts`; add `tests/e2e/publication-design.spec.ts`.

**Interfaces:** Semantic colour/type/spacing/status tokens from the spec; shared masthead/page frame; each page uses canonical figures instead of local theme copies.

- [ ] Write route-wide visual/accessibility checks: all 19 topic routes plus library/trust/new routes use the system, every route has skip navigation, controls stay within bounds at 320px/200% zoom.
- [ ] Test contrast and focus behaviour rather than pinning obsolete navy/Georgia bans. No typography below legible chart sizes through SVG scaling.
- [ ] Implement new identity, chart-led homepage and compact useful unavailable states. Preserve reduced motion and source distinctions.
- [ ] Run desktop/mobile screenshot review on populated, partial, unavailable and historical fixtures; inspect every route; review/commit.

## Task 10: Feature 2 — complete measure atlas

**Files:** Create `app/measure/[id]/page.tsx`, `app/components/MeasureLibrary.tsx`; extend `app/explore/page.tsx`, search, sitemap/discovery and section links; add `tests/unit/MeasureLibrary.test.tsx`, `tests/e2e/measure-atlas.spec.ts`.

**Interfaces:** Consumes `MeasureCatalog`/`selectMeasure`; produces canonical `/measure/{id}/` destinations for all registered current or explicitly historical measures. Unknown ids return 404.

- [ ] Test every inventory measure has a route, definition/source/date/history or truthful absence. Search reaches all active topics and new wage/rent measures. Counts equal registry length.
- [ ] Run red; implement pages and registry-driven discovery. Preserve existing section URLs.
- [ ] Verify fixture value equality across home/topic/atlas/export and expiry transitions; review/commit.

## Task 11: Feature 3 — comparison studio and portable packages

**Files:** Create `app/compare/page.tsx`, `app/components/ComparisonStudio.tsx`, `app/lib/comparisonWorkspace.ts`; replace unsafe explorer overlay usage; add `tests/unit/comparisonWorkspace.test.ts`, `tests/e2e/comparison-studio.spec.ts`.

**Interfaces:** `Workspace = { version: 1; measureIds: string[]; window: DateWindow; mode: 'panels' | 'overlay' }`, maximum four unique ids. `parseWorkspace(search: string, catalog: MeasureCatalog): Workspace`; consumes comparability/figure/export APIs.

- [ ] Reject malformed/duplicate/unknown/fifth id and invalid date windows. Incompatible overlay selection becomes labelled panels; no nearest-date point is presented as a simultaneous observation.
- [ ] Assert URL reload reproduces the workspace; keyboard/touch selection and exported package retain all identities/source notes.
- [ ] Run red; implement synchronized panels/window controls and portable package generation; verify mobile/downloads; review/commit.

## Task 12: Feature 4 — dated briefing and chart-led stories

**Files:** Create `worker/edition-summary.js`, `app/briefing/page.tsx`, `app/stories/[slug]/page.tsx`, `app/components/BriefingEdition.tsx`, authored story modules under `app/content/stories/`; integrate homepage/RSS; add `tests/unit/editionSummary.test.ts`, `tests/e2e/briefing.spec.ts`.

**Interfaces:** Produce `buildEditionSummary`/`EditionSummary` for Task 18. Stories declare referenced measure ids/source editions and editorial owner, not arbitrary unvalidated numeric prose.

- [ ] Same fetched value/edition produces no change; a new observation and a revised old observation have different kinds; a method change is never an ordinary growth comparison.
- [ ] An older history point changes while the headline is identical: emit its period, observation date, old/new values and source/revision ids. Null value changes remain distinct from unchanged/missing inputs; method-only changes have no invented numeric delta.
- [ ] Missing/expired measures cannot generate current headlines; every numerical story statement maps to a validated record.
- [ ] Run red; build bounded summary in publication jobs, render dated briefing and authored guided stories; verify RSS/citations; review/commit.

## Task 13: Feature 5 — release calendar and on-device board

**Files:** Create `app/calendar/page.tsx`, `app/components/ReleaseCalendar.tsx`, `app/components/WatchlistBoard.tsx`, `app/lib/releaseCalendar.ts`, `app/lib/watchlist.ts`; extend validated release metadata; add `tests/unit/releaseCalendar.test.ts`, `tests/unit/watchlist.test.ts`, `tests/e2e/watchlist.spec.ts`.

**Interfaces:** Produce `ReleaseEvent`/`buildCalendar`; `Watchlist = { version: 1; measureIds: string[] }`, maximum 50 ids; `parseWatchlist(input: unknown, catalog: MeasureCatalog): Watchlist`.

- [ ] Publisher date differs from next collector check; unknown date yields no invented event. Test UK daylight-saving boundaries, deterministic ICS escaping and source URLs.
- [ ] Storage denied/corrupt/old-version state degrades gracefully; followed values expire correctly; config import contains only validated ids, never cached current numbers.
- [ ] Run red; implement calendar/ICS and browser-only following; assert no preferences network upload; review/commit.

## Task 14: Feature 6 — sourced cost-of-living lens

**Files:** Create `worker/private-rent-source.js`, `app/section/cost-of-living/page.tsx`, `app/components/CostOfLivingLens.tsx`; extend registry/catalog/coverage; add `tests/worker/private-rent-source.test.ts`, `tests/unit/CostOfLivingLens.test.tsx` and primary-source fixtures.

**Interfaces:** Rent collector publishes `MeasureRecord` for a named official ONS rent-price series with direct series/edition identity. View consumes existing CPI, real pay and Bank Rate without deriving fictional household costs.

- [ ] Named release/series fixture reconciles headline/history, geography and unit; missing/mismatched source fails closed. Source must pass Task 2 feasibility.
- [ ] Different periods/geographies remain visible; a failed rent source cannot erase valid pay. No synthetic inflation basket or mortgage projection.
- [ ] Run red; implement collector and guided separate panels; verify one real named source retrieval when authorized network permits; review/commit.

## Task 15: Feature 7 — primary-publication polling lab

**Files:** Extend `worker/election-polls.js`, `worker/live-polling-collector.js`; create `worker/pollster-connectors.js`, `app/components/PollingLab.tsx`; update election-poll route; add `tests/worker/pollster-connectors.test.ts`, `tests/e2e/polling-lab.spec.ts` with at least two named publishers' exact table fixtures.

**Interfaces:** Existing validated poll rows retain primary sample/method/fieldwork/source fields; historical ingestion is bounded/deduplicated by publisher publication identity. Connectors share validation, not assumptions about table prose.

- [ ] Verify two publishers' editions, disjoint fieldwork dates, duplicate revisions, omitted/weighted method, rejected unsupported interval and parties absent from some publications.
- [ ] Filters operate on real historical publications; charts never invent intermediate polls, average pollsters or imply seats from vote share.
- [ ] Run red; implement bounded multi-publisher history and filters; real source checks required before calling multi-pollster complete; review/commit.

## Task 16: Feature 8 — public-money dossiers and fiscal lens

**Files:** Create `app/money/page.tsx`, `app/components/PublicMoneyExplorer.tsx`, `app/lib/publicMoney.ts`; extend existing contracts/topic components and versioned disclosure metadata; add `tests/unit/publicMoney.test.ts`, `tests/e2e/public-money.spec.ts`.

**Interfaces:** Consumes corrected procurement window from Task 3 plus canonical fiscal measures; `buildDossier(awards, entityId)` returns identity, disclosed total, notices, revision links, exact filtered denominator and coverage caveats. Same names do not establish entity identity.

- [ ] Downward revision/cancellation propagates to dossiers; supplier name collisions do not merge unproved identities. Filter count and concentration match visible universe; small bars retain true proportions.
- [ ] A disclosed award is never labelled expenditure; same-month receipts comparisons declare nominal/accounting basis; unsupported spend/interest dimensions remain unavailable.
- [ ] Run red; implement linked buyer/supplier records and explicit fiscal panels, bounded client filtering; review/commit.

## Task 17: Feature 9 — interactive country comparison figures

**Files:** Replace composition in `app/components/InternationalComparison.tsx`; create `app/lib/countryComparison.ts`; update UK-context page and canonical comparison adapters; add `tests/unit/countryComparison.test.ts`, `tests/e2e/country-comparison.spec.ts`.

**Interfaces:** Existing seven-measure/13-country contract is retained; plot selector returns rows plus included/excluded denominator, common-year/currency/basis explanation and status. Missing country is never zero.

- [ ] Currency/year/basis mismatches cannot share a ranking axis; ties have stable declared treatment; changing filters changes denominator correctly; historical/estimate/projection labels persist.
- [ ] Assert UK highlight plus non-colour labels, mobile dot plots and useful no-JS tables, independent source failures from Task 4.
- [ ] Run red; implement figures and filters using shared chart/table system; review/commit.

## Task 18: Feature 10 — source, revision and correction ledger

**Files:** Create `worker/edition-archive.js`, `app/editions/[id]/page.tsx`, `app/sources/[id]/page.tsx`, `app/components/RevisionLedger.tsx`; extend `app/(publication)/[trust]/page.tsx` corrections page and bounded manifest routes; add `tests/worker/edition-archive.test.ts`, `tests/e2e/revision-ledger.spec.ts`.

**Interfaces:** `archiveEdition(env, catalog, summary): Promise<void>` is idempotent on edition id; `readEdition(env, id): Promise<MeasureCatalog | null>` validates archive identifiers and records. Reuse Task 12 changes, default 60-edition summary retention and content-addressed records.

- [ ] Repeated publication cannot duplicate/rewrite an edition; malformed ids cannot access arbitrary KV; retention does not delete a current record or leave broken archive references.
- [ ] Old edition is labelled as-of, never current; source dossier has direct release/validation/method/correction identity; later retrieval alone is not a revision.
- [ ] Run red; implement bounded archives and dated correction records; verify storage/write scenarios, escaping/privacy and citation packages; review/commit.

## Task 19: Whole-platform verification and authorized rollout

**Files:** Update `tests/e2e/smoke.spec.ts`, `tests/e2e/live-mobile.spec.ts`, add `tests/e2e/populated-publication.spec.ts`, adapt production verification scripts and `.github/workflows/deploy.yml`/`pr-validation.yml` only to approved release architecture; update operations guide and checklist outcomes.

**Interfaces:** Public manifest/schema compatibility and precise deployed revision checks; no live collector endpoint exposed. One production renderer/data contract, with rollback compatible across old/new Worker order.

- [ ] Run focused suites for the last change, then `npm run lint`, `npm run test`, `npm run build:prepare && npm run build`, all required source/hosting/architecture guards and the affected OpenNext build. Do not build concurrently with dev service using `.next`.
- [ ] Run populated, partial, expired, unavailable and historical browser fixtures across every registered route at desktop/320/360px, 200% zoom, keyboard/no-JS/reduced motion. Check actual element bounds/readability, all export types and absence of hydration/console/chart warnings.
- [ ] Browser fixtures must contain populated source-specific examples; zero-chart or unseeded journeys are not chart readiness evidence. Every chart-owning component in coverage manifest must be exercised.
- [ ] Recompute Free workload and measure renderer/ingestion limits with final bundles. Verify roll-forward/rollback mixed-schema fixtures and source acceptance-to-publication latency. No unexplained required failure is waived.
- [ ] Prepare reviewed PR tranche(s); attach any created PR to the task. Deployment requires explicit authorization. After authorization, deploy in compatible order, read exact active revisions, and verify real production HTML/JSON/source/expired-boundary journeys.
- [ ] Finish with ten feature acceptance results, baseline repair results, measured limits, verified sources, honest unavailable/blocker records and rollback instructions. Do not claim complete for missing feeds or empty feature shells.

## Proposed milestones

1. **Trusted foundation:** Tasks 1–8. Existing site is consistent and chart-correct; new model/resources proved.
2. **New publication experience:** Tasks 9–13. Full identity, atlas, studio, briefing and calendar/watchlists.
3. **Specialist depth and accountability:** Tasks 14–18. Household costs, primary polling, money dossiers, country charts and revision ledger.
4. **Verified release:** Task 19, including production only when authorized.

No calendar-duration promise is made before source feasibility and renderer measurements. The long-running task should persist through source/format failures, update this checklist and continue independent work; only concrete external prerequisites justify pausing an affected item.

## Plan self-review

- All ten spec capabilities map to Tasks 9–18; baseline defects map to Tasks 3–8.
- Inventory/docs, source feasibility, Free budget and renderer contingency precede feature expansion.
- All five Review Focus cases have explicit owning task tests.
- Catalog/figure/edition interfaces are defined once and consumed consistently.
- No task requires paid services, deployment without authorization, invented data or globally disabled tests.
- Remaining uncertainty is explicit: current official Cloudflare limits/account settings, actual production/source responses, and new-source feasibility could not be observed through the review environment's restricted proxy. Task 2 owns these prerequisites.
