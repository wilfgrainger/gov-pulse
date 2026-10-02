# Gov Pulse reinvention execution ledger

Plan: `docs/superpowers/plans/2026-10-01-publication-reinvention.md`
Spec: `docs/superpowers/specs/2026-10-01-publication-reinvention-design.md`
Branch: `work`; production/deployment remains unauthorized.

## Completed

- Task 1: review authority, public route manifest, topic/measure coverage inventory, and visual guardrail update. Targeted tests, lint, hosting, architecture, ownership and diff checks passed.
- Task 2 (partial): XLSX expanded-entry, aggregate, shared-string, worksheet row/cell resource guards implemented and focused tests passing. Cloudflare Free quota verification blocked by proxy CONNECT 403; no account quota evidence available.

## In progress

- Task 2: derive scheduled work/retry/storage/cache budget from current registry and schedules; record source feasibility and exact Cloudflare verification blocker.
- Task 3: preserve later procurement revisions before ranking; stop assigning UK nation from straddling/ambiguous postcode areas.

## Remaining

Tasks 4–19 in the approved implementation plan. Continue in order; update this ledger and plan checkboxes after each reviewed tranche. Do not deploy or publish.

## Verification notes

- `npx vitest run tests/unit/publicationProgramme.test.ts tests/worker/workbook-limits.test.ts`: 10 passed.
- `npm run lint`, `npm run hosting:check`, `node scripts/check-static-architecture.mjs`, `node scripts/check-source-ownership.mjs`, `git diff --check`: passed.
- Prior baseline full suite: 577 tests across 113 files passed before workbook-guard implementation.

## Task 3 update

- Preserved all valid award revisions per UTC day before top-100 ranking; resolved later releases (release ID breaks equal-date ties) across seven shards.
- Added cancellation tombstones, incomplete-window rejection coverage, and a per-shard bound of 2,500 candidate records / 4 MiB serialized.
- Nation labels now require an exact publisher `countryName` matching a UK nation. Postcode-only inference is disabled; the public-money UI explains why unknown remains unknown.
- Replaced the hosting boundary check's stale Pages-primary claim; it now enforces OpenNext + data Worker deployment and permits Pages only under the explicit manual fallback gate.
- Verification: `npm test` passed 594 tests / 115 files; `npm run lint`, architecture/source ownership/hosting guards passed; `npm run build` passed.

## Current next step

Task 6: source-parser and editorial correctness pass. Task 5 is complete; Task 2's account/quota and source feasibility checks remain externally blocked/open and do not block independent implementation.

## Task 4 update

- International comparison rows now carry a source-edition fingerprint, successful check, `validUntil`, status and per-measure retry time; observation year remains separate and historical editions are labeled as historical.
- Source failures are tracked independently. A still-valid previous measure is retained; genuine successful missingness is published as missing; expired or metadata-free legacy values are dropped. A due healthcare retry requests only its dependent source and does not overwrite other measures.
- Reused the existing direct daily international-comparison scheduler and added per-measure source selection for retries; no Queue message was added. After adding the house-price section, the schedule model reports 30 healthy deliveries / 90 project operations, with 120 / 360 configured retry upper bound.
- Updated the comparison UI to show source-specific validity instead of implying `generatedAt` is observation currentness.
- Verification: `npm test` passed 601 tests / 115 files; `npm run lint`, architecture/source/hosting checks, budget audit and `npm run build` passed.

## Current next step

Task 5: make expiry consistent across publication, response caching, browser refresh and server-rendered NHS evidence.

Task 4 final verification after daily retry scheduling: `npm test` passed 601 tests / 115 files; `npm run lint`, `npm run build`, budget audit and `git diff --check` passed.

## Task 5 update

- Shared publication currentness now allows still-valid explicit evidence to survive stale retrieval health, expires the three economic indicators independently, and records each indicator's source-owned deadline. Identical international source editions keep their original `validUntil` on later successful checks.
- Public JSON cache headers cap browser/CDN freshness plus stale-while-revalidate at the evidence deadline; at expiry the route returns `no-store`. Open browser views schedule exact deadline reevaluation and redact only expired indicator values while retaining other current indicators and history.
- NHS evidence renders in request-time server HTML and hydrates against the same publication clock; the browser rechecks actual time after hydration. Trusted NHS ingestion verifies the exact accepted KV record with bounded retries for eventual consistency.
- Updated snapshot fixtures to carry valid per-measure metadata, including bootstrap/degraded publication cases.
- Verification: `npm test` passed 616 tests / 115 files; focused currentness, cache, NHS, comparison and ingest suites passed; `npm run lint`, hosting/architecture/source ownership guards, Free budget audit and `git diff --check` passed. `npm run build:prepare && npm run build` passed. A direct repository-wide `npx tsc --noEmit` remains unsuitable because it includes existing unrelated test/e2e typing errors; the production Next build type check passed.
- Cloudflare Free quotas/account settings remain unverified due the previously recorded network restriction; the workload derivation currently reports 30 scheduled deliveries/day and 90 project operations/day, with maximum configured retry deliveries 90. This is not billing or headroom evidence.

## Current next step

Task 7: canonical catalog and additive publication migration. Task 2 Free-account/resource verification and Task 6 live source collection remain externally blocked; continue independent work without treating those sources or limits as verified.

## Task 6 update

- Wage parsers accept signed and Unicode-minus bulletin values; shared editorial wording avoids phrases such as “fell -0.6%”. Poll ingestion now requires exact labelled metadata and supported primary-source method evidence; sample counts are disclosed without deriving unsupported numeric uncertainty. Crime modules no longer present an old checked-in court release as a newly collected edition. Early Years and court data fail closed until exact current publisher records can be collected.
- Verification: focused wage, polling, migration wording, crime and Early Years regressions passed; full suite passed 623 tests / 118 files after a stale MoJ expectation update. Source discovery/live retrieval remains blocked by the proxy CONNECT 403.

## Task 7 update

- Added a versioned common measure record/catalog contract, runtime validation and comparability checks. Worker publication assembly adds a catalog as optional metadata while preserving the old snapshot shape for existing readers. Current values require a source-owned deadline after retrieval; historic editions may retain an earlier expiry without being promoted to current.
- The catalog registers eight core measures with source edition, source URL, publication/fetch/validity dates, observation periods, geography, units, basis, revision identity and caveats. The explorer and national evidence consume the same current record; seven shared headlines now match on value, period, source URL and state at a fixed clock. Catalog expiry, key mismatches, impossible/future timestamps and corrupted envelopes fail closed.
- Measure search and topic route counts derive from the measure definitions, with duplicate topic destinations collapsed to the best matching search result. Existing snapshots without a catalog continue to use the compatibility path; source-specific polling and procurement payloads remain distinct.
- Verification: `npm test` passed 646 tests / 118 files; `npm run lint`, source ownership, static architecture, hosting boundary, budget audit and `git diff --check` passed. `npm run build:prepare && npm run build` completed with Next production type checking and all 54 generated pages. Worktree also includes a TypeScript declaration fix for the polling sample-size disclosure exposed by that build.

## Current next step

Task 8: repair and standardize every existing evidence figure, beginning with common clipping/observation table/export contracts. Continue to carry Task 2 Free-quota/account/source limitations and Task 6 live source collection explicitly; neither has been verified externally.

## Continuation through Tasks 8–19 (implementation remains in progress)

- Added a common publication-point figure for validated catalog measures, date-window clipping, gap/revision segmentation, an exact observation table, disclosed axis bounds, and portable source packages. The existing financial and polling charts now show accessible observation tables; polling dots remain disconnected and contracting bars retain zero-based proportions. Legacy chart owners still need source-complete export packages and populated browser fixtures, so Task 8 is not closed.
- Applied the coral/teal/ochre editorial system, updated the masthead, chart-led home and feature navigation. Desktop and mobile screenshots were inspected for home and comparison; the full browser sweep walks the active topic pages, but populated source states and every route's screenshot review remain outstanding.
- Added the measure library and measure detail routes (records come only from the validated catalog), comparison workspace with URL state, dated briefing/RSS edition notes and cited guide stories, publisher-announced release calendar with ICS, and an on-device watchlist with bounded import/export. These pages use honest empty states when the local build has no publication snapshot.
- Added a cost-of-living lens with separate CPI, real-pay and Bank Rate figures. Private rent remains unavailable pending a verifiable named ONS release and live source access.
- Added publication/date filters to the polling lab. The currently verified collector still returns only one recent YouGov publication; a second named pollster and bounded real historical collection could not be validated through the blocked source proxy.
- Added corrected-award search/dossiers, interactive country dot figures with denominator/status disclosures, dated source records, revision summaries and a content-addressed 60-edition archive. Archive routes are now attached as two exact read-only Cloudflare Worker routes and are contract-tested. The public-site lookup is code-reviewed locally; production-origin archive reads remain unobserved because no deployment was performed.
- Updated the free workload model to include an archive upper bound of 32 KV operations/day under the modeled daily finaliser retry bound. It remains a model; account entitlements, actual cache-miss traffic and 20% quota headroom are not verified.

### Latest verification

- `npm test`: 706 tests across 131 files passed after the legacy chart export metadata change.
- `npm run lint`: passed.
- `npm run build:prepare && npm run build`: passed; Next generated 60 routes, including all new routes.
- `npm run test:e2e` with the system Chromium binary: 21 passed, 3 skipped (the deployment-only live mobile audit and project-specific mobile checks); desktop and mobile route sweeps, active sections, 320/360px layouts and the no-JavaScript measure-library response passed.
- `npm run hosting:check`, static architecture, source ownership, free-budget audit and `git diff --check`: passed. Static architecture recognizes five exact public data routes.
- Playwright's bundled Chromium download failed with HTTP 403 from the environment proxy; E2E was run with `/usr/bin/chromium` via the explicit local executable setting.
- Added a route-wide 640px viewport audit as a 200% zoom-equivalent, with reduced motion enabled. The new check passed across all 18 topic routes plus the principal atlas, comparison, briefing, calendar, cost, money, edition and source routes. This still exercises the unseeded local edition; component fixtures cover populated page data but not every chart in the browser.

### Continuation: legacy time-series export provenance

- Added source-citation watermarks to every `FinancialTimeSeriesChart` export, including publisher/source URL, publication date, observation period and chart-specific caveat where the owning payload provides those fields. Bank Rate now uses its own series source fields rather than a generic snapshot citation.
- The shared chart appends the actual plotted observation range and description to the supplied source line and embeds a versioned JSON metadata block in each SVG/PNG source image with citation, first/last observations, series labels and caveats. Regression tests cover both the visible footer and metadata.
- Full verification after this change: `npm test` passed 706 tests across 131 files; lint and `npm run build:prepare && npm run build` passed (60 routes). Task 8 remains open for populated/expired/historical browser coverage and chart owners outside this financial-series component.
- A new route-wide 200% zoom-equivalent/reduced-motion Playwright audit passed across all topic routes and principal feature/source routes. The unseeded full browser sweep passed 21 tests / 3 skips before this added check; the new desktop check also passed by itself (its mobile-project counterpart is intentionally skipped).

### Review follow-up: comparison exports and public-money dossiers

- Data Explorer comparison images now carry both source URLs, publication dates, and each measure's plotted period in the visible export citation and versioned SVG metadata. The metadata includes both series labels and explicitly records their independent scales and non-interpolated lines.
- Public-money dossiers now offer single-notice, exact-buyer-string, and exact-supplier-string views over the visible filtered award universe. Totals and notice links are bounded to that universe; the UI warns that name matches do not establish entity identity, multi-supplier values are not allocated, and the publication window is not a complete revision history.
- Focused regressions for Data Explorer exports and grouped notice dossiers passed (39 tests, then 21 additional page/data tests). Full verification after these changes passed 708 tests across 132 files, lint, `npm run build:prepare && npm run build` (60 routes), and Playwright (22 passed, 4 skipped).
- Remaining review gaps: the measure atlas covers only the eight canonical records currently registered; the polling lab still lacks a second live primary publisher; populated browser chart fixtures and complete export migration for non-financial chart owners remain open.

### Continuation: portable country exports and truthful procurement count

- Country-comparison SVG exports now carry the selected country/value/year/evidence/rank rows, source URLs and publication dates, visible denominator, and exclusion/measure caveats in their versioned metadata. The rendered chart remains paired with the exact selected-observations table.
- Procurement concentration now says it draws the first 20 of the filtered suppliers and gives the full-publication count; the ranked chart does not imply that all suppliers are drawn.
- Fixed PNG capability detection to use an SSR-stable external-store snapshot. The server and hydration markup both omit PNG until the browser checks canvas support, removing the previously observed server/browser mismatch.
- Regression tests covered selected chart-export content, server-rendered export controls and the procurement display cap. Verification: `npm test` passed 710 tests across 132 files; lint, changed-text policy, architecture, source ownership, hosting boundary, Free budget audit and `git diff --check` passed. `npm run build:prepare && npm run build` passed and generated 60 routes. Playwright passed 22 tests with 4 deployment-only/mobile skips; this still uses an unseeded publication and does not prove populated chart journeys.

### Continuation: supplier ranking export and live-source retry

- Replaced the procurement supplier concentration strips with one zero-based SVG figure using the current nation filter. Its SVG/PNG exports retain every plotted supplier name, disclosed value, award count, nation, full-publication denominator, source API link, complete update window and allocation caveats. The graphic continues to show at most 20 ranks and explicitly reports the filtered and full counts.
- Added tests for export metadata and the populated component export action, including the unavailable-publication path.
- Retried read-only access to Ipsos, Opinium, ONS private-rent and Cloudflare limits pages on 2 October 2026. Every connection failed at the environment proxy with CONNECT 403; no additional source or account-limit claims could be validated.
- Added an exact semantic observation table for the plotted supplier rows, plus a filtered CSV download in Public Money. The CSV contains only the current visible awards, is correctly quoted, and includes each official notice and procurement-history link; click tests confirm buyer filtering is reflected in the file.
- Verification after these changes: `npm test` passed 713 tests across 133 files; lint and changed-text policy passed; `npm run build:prepare && npm run build` passed and generated 60 routes. The populated procurement chart and filtered CSV are exercised by unit fixtures. No new browser pass was run because the local E2E edition remains unseeded and would not exercise the populated chart state.

### Still open

- Task 2: verify Cloudflare account Free-plan quotas and required headroom from an authorized network; quantify public archive-cache misses and source egress.
- Task 6/14: obtain live MoJ, Early Years and ONS private-rent source records; the earlier proxy CONNECT 403 prevents live source validation.
- Task 8/19: complete populated, partial, expired and historical browser fixtures at 200% zoom, with reduced-motion, keyboard and export coverage. The latest E2E run uses an unseeded local publication and is not evidence that populated production charts render correctly. Small sparklines are contextual summaries; political-compass and individual procurement bars remain non-downloadable, with surrounding source/evidence or direct notice links.
- Task 15: verify a second primary polling publisher and a real historical release stream before describing the lab as multi-pollster.
- No Worker was deployed, and no production URL or active revision was checked.
