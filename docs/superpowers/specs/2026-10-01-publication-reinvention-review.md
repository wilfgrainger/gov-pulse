# Public-data.org: website, evidence and architecture review

> **Historical review.** Its route counts, dated state, task assumptions and Cloudflare-Free-only requirement are not current constraints. Round-two scope and execution are in [the current plan](../plans/2026-10-02-publication-reinvention-round-2.md).

Review date: 1 October 2026. Source revision: `ac110e2873bbb2b861aceda307ad6256db5202c2`.

## Scope and evidence

The user requested a deep review, ten new features, a vibrant classic FiveThirtyEight-inspired redesign of the whole website, comprehensive repair of existing data and charts, and Cloudflare Free only. This is planning work, not authorization to deploy.

Three independent read-only reviews covered frontend, data integrity, and architecture/documentation. Their findings were checked against source. Data findings identified as reproduced below were exercised with pure in-memory inputs, without live collection or KV writes.

Local Chromium visited 27 current public journeys: home, explorer, all 19 topic pages (14 active and five withdrawn), sources and five trust pages. All returned HTTP 200 with their expected headings. Five representative journeys were checked at 360px; document width equalled viewport width. This does **not** prove individual controls are unclipped or charts readable. The unseeded local edition has unavailable live evidence, so it cannot validate populated national charts. The dated Early Years chart rendered after hydration. Local screenshots were captured in `/tmp`.

Chromium observed a hydration mismatch on Early Years: `ChartExportButtons` renders an additional PNG button in the browser because `canRasterizeToPng()` returns a different value from SSR. See `app/components/ChartExportButtons.tsx:37,78`.

The retained onboarding server initially hung after its original output connection closed, with `write EPIPE` in its log. Restarting the known server with output redirected to a local log restored requests. This was an environment/process-lifetime problem, not evidence of a production failure.

Requests to the production website, all three public JSON endpoints, and current official Cloudflare limits pages were denied by the environment proxy at CONNECT with HTTP 403. This does not establish that the website is unavailable. Production revision, live data freshness, source reachability and current published Free limits remain unverified. The earlier onboarding pass reported 573 unit/Worker tests, lint and a Next build passing; those results do not validate live sources or populated browser journeys.

## What already exists

There are 19 registered topic routes: 14 active and five explicit withdrawals. The homepage has seven national signals. Explorer defines eight measures, despite copy advertising seven. Sixteen shared `FinancialTimeSeriesChart` instances cover the active evidence pages.

| Journey | Existing capabilities |
| --- | --- |
| Home | Automatically selected lead, seven signals, sparklines and topic links |
| Explorer | Eight measures, filters, history windows, overlays, endpoint changes, tables, CSV, image exports, shareable URL and keyboard scrubbing |
| Economy | GDP growth/index; CPI, Bank Rate and unemployment; labour-force rates/vacancies; debt stock/ratio; receipts; real pay |
| Society | Migration; five NHS history figures plus specialties; separate survey/recorded/justice crime modules; dated Early Years spotlight |
| Politics | Latest primary poll, individual-poll scatter/error bars and disclosure; three betting markets |
| Public money | Top-100 disclosed awards with filters/concentration; seven international measures across 13 countries |
| Sources/trust | Publisher directory, gap register, policy pages, section downloads, RSS and discovery metadata |
| Withdrawals | Approval, polarisation, government satisfaction, regional comparisons and policy relationships remain explanatory pages |

Basic search, filters, downloads, export buttons, chart event markers, sharing, freshness badges, a seven-measure international table and procurement search are already implemented. The proposed ten features must extend these meaningfully rather than count them again.

## Data findings

| Priority | Finding and evidence | Required outcome |
| --- | --- | --- |
| P0 | Procurement truncates daily awards before cross-day version resolution: `worker/government-contracts-cloudflare.js:244-251,313-335`. Reproduced £1m award amended to £1, omitted from next day's top 100, still ranked first at £1m. | Resolve complete bounded-window revisions before ranking; preserve cancellations and correction identity. |
| P0 | Postcode-area heuristic is published as nation: `contracts/government-contracts.js:64-70,104-114`. Reproduced Shrewsbury SY as Wales, Berwick TD as Scotland, Jersey as England, garbage as England. | Official geographic identifiers/join, otherwise unknown. Never infer delivery location from buyer/supplier address. |
| P0 | International partial refresh replaces failed measures and delays retry seven days: `worker/international-comparison-publication.js:313-339`. Reproduced healthcare denominator 13 to 0 after an upstream failure. | Per-measure verified retention, independent retry, explicit edition validity and truthful denominators. |
| P0 | International reads validate shape but not currentness: same file `:298-306`; a 2020 generated timestamp was accepted. | Separate observation-year validity from collection age; explicitly label historical evidence and enforce current-edition policy. |
| P0 | Fixed JSON cache freshness 300s plus stale revalidation 3600s can outlive evidence: `worker/public-data-entry.js:23-26,249-260`. | Clamp cache lifetimes to the earliest relevant validity deadline; recheck client-visible values after expiry. |
| P1 | Indicator section lacks explicit expiry and is dropped after 36-hour retrieval age: `worker/section-builders.js:258-269`, `feed-registry.js:28`. Reproduced removal of valid observations. | Independent CPI, Bank Rate and labour validity; failed refresh changes collector state, not statistical age. |
| P1 | Real wage parser only accepts unsigned growth: `worker/real-wages.js:276`. Positive sample parsed, otherwise identical negative sample failed. | Signed, zero and Unicode-minus fixtures; reconcile accepted figures to history. |
| P1 | Poll collector asserts metadata through hardcoded/fallback fields: `worker/live-polling-collector.js:287-315`. | Verify question, fieldwork, sample, commissioner, method and uncertainty against the exact primary tables. |
| P1 | Crime's justice module clones checked-in Q1 2026 values: `data/crime/moj-court-publication.js:1-8`, `live-crime-collector.js:368`. | Independent MOJ rolling publication discovery; do not pretend ONS refresh updates courts. |
| P1 | NHS trusted ingest exists, but writes fragment without promoting an edition: `scripts/trusted-nhs-rtt-ingest.mjs:104-139`. | Reuse importer, then bounded finalisation/readback proving accepted-to-public delivery. |
| P1 | Public health reports publication readiness, not refresh condition: `worker/public-data-entry.js:279-320`. | Reader-facing evidence condition and operational collection condition stay distinct. |

Existing reliability fixes must be reused: explicit expiry already overrides retrieval age; previous verified sections survive partial refresh; run deadlines, terminal states, idempotent finalisation and isolated comparison publication already exist. Crime already discovers rolling ONS releases. Do not execute the September plan wholesale or recreate the existing NHS workflow.

## Chart and product findings

| Priority | Finding and evidence | Required outcome |
| --- | --- | --- |
| P0 | Explorer independently rescales arbitrary different-unit measures and permits all history-bearing peers: `DataExplorer.tsx:61-105,230-237`. | Comparability contract; shared axes only for compatible definitions; aligned separate panels otherwise. |
| P0 | NHS SSR clock is zero and rendering requires positive clock: `NHSStats.tsx:129-131,271`. | Server HTML, hydration and no-JS clients receive the same evidence decision. |
| P1 | Comparison dates have no upper bound and can escape the primary chart: `DataExplorer.tsx:61-64,100-103`. | Clip both dates to the same window; retain gaps and distinct cadence. |
| P1 | Export omits citations/context: `FinancialTimeSeriesChart.tsx:330`, `PollingUncertaintyChart.tsx:281`, `DataExplorer.tsx:108,428`; export footer mixes rendered pixels/viewBox units: `chartExport.ts:47-55,77-92`. | Portable title, units, periods, sources, release dates and caveats; consistent SVG coordinate model. |
| P1 | Early Years says MMR "fell" despite zero delta and 88.9 to 88.9: `EarlyYearsStats.tsx:14-23,55`. Other wage/migration summaries mishandle negative or zero changes. | Shared signed change-language rules; source-bound dates; validated dated publications. |
| P1 | Supplier bars announce full count but show 20, and minimum 2% width exaggerates small shares: `GovernmentContracts.tsx:332-342`. | Honest display limits and magnitude scales. |
| P1 | Search misses six active topics: `evidenceSearch.ts:13-114`; homepage advertises seven explorer measures, registry has eight. | One generated inventory for navigation, search, counts and data pages. |
| P1 | Existing E2E expects six signals/obsolete heading: `tests/e2e/smoke.spec.ts:48,52`, `live-mobile.spec.ts:41-42`. | Repair tests to assert the approved user journeys and registry-derived inventory. |
| P1 | Shared no-JS figures render loading skeleton/latest-only text, not full history: `ClientOnlyChart.tsx:47-70`, `FinancialTimeSeriesChart.tsx:289-298`. | Useful server-rendered figure/table with progressive interactive enhancement. |
| P1 | PNG feature detection causes observed Early Years hydration mismatch. | Identical first render; capability detection after mount. |

Statistical review: total sample size does not prove uncertainty for weighted/nonprobability polls. The chart calls an illustrative SRS calculation the poll's own margin while later qualifying it. Use publisher-reported intervals; remove or separately label illustrative calculations. Shared labour-rate scales compress unemployment beneath employment; use small multiples. Automatically fitted axes need visible scale declarations. MMR target/immunity statements need precise primary-source wording.

Mobile/accessibility review must cover populated states. Fixed-viewBox explorer labels shrink sharply; polling and comparison tables are wide; nav/freshness controls need 320px checks; `overflow-x:hidden` masks clipping. Check individual element bounds, readable labels, 44px targets, keyboard focus, tables, reduced motion, contrast and no-JS journeys, not merely document width. Keep the existing good semantic/focus foundations.

## Markdown and executable constraints

The user's redesign authorization supersedes old aesthetic and architectural preferences. Preserve source truth, accessibility, privacy/security and explicit approval before paid spend. The earlier free-only preference was withdrawn in round two.

| File | Conflict | Planned treatment |
| --- | --- | --- |
| `AGENTS.md` | Calm/restrained style, frozen delivery descriptions, obsolete required membership | Replace preferences with approved visual/architecture brief; derive membership from registry. |
| `north_star.md` | Excludes dashboard/analytics, permanently forbids expansion | Rewrite around engaging evidence journalism and bounded interactive tools. |
| `roadmap.md`, `tasks.md` | Old scope/constraints and incorrect stale-state claims | Supersede with this programme and execution milestones. |
| `docs/delivery/public-data-v3/README.md` | Forbids new feeds, backend redesign, framework/chart replacement | Mark historical; new delivery contract permits the approved redesign. |
| `docs/delivery/data-insights/README.md` | Fixed contracts/no migration | Supersede migration limitations; preserve reproducibility. |
| Old architecture/free-tier/operations docs | Static Pages/two-route descriptions, incorrect budgets/bootstrap claims | Replace current guidance with one ADR and measured resource ledger; date historical decisions. |
| `tests/unit/visualSystem.test.ts` | Pins old hex colours, Georgia, radius/shadows and banned font names | Test approved tokens, contrast/focus and reduced motion; remove aesthetic vetoes. |
| `scripts/check-static-architecture.mjs` | Exactly three routes and blanket App Router API ban | Approved public-contract manifest; keep collector/secret exposure prohibited. |
| `scripts/lib/change-complexity.mjs` | Arbitrary file, concern, source-line and lockfile-size limits blocked cohesive work | Remove the blocking gate and duplicate helper. PR validation still reports changed files; architecture, lockfile integrity, source ownership, lint, tests and builds remain enforced. |
| Former `scripts/check-hosting-boundary.mjs` | Its provider bans duplicated deployment assumptions in prose and CI. | Removed in round two; exact-head public release smoke checks retain canonical-domain verification without locking the provider. |

Do not delete evidence audits or withdrawal reasons to escape a constraint. Add supersession notes where appropriate. `framer-motion` is currently used by `Reveal`; an old roadmap claim that it is unused must not drive blind removal.

## 2 October 2026 implementation note

The superseded roadmaps, delivery briefs, duplicate Cloudflare architecture documents and volatile scratch ledger were removed. The CI change-size gate was removed; the PR lane summary still reports the changed-file list. Code and evidence checks remain required. The active workload model is 30 scheduled deliveries/day, 90 modeled operations/day and 120 deliveries/day under three retries; the older 29/116 figures are retired.

At the time of this review, `AGENTS.md` had been updated to recognize the user's
reinvention authority and correct current architecture. The implementation note
below records the later removal of superseded duplicate guidance.

## Historical platform review, retired 2 October 2026

The Free-only scenario and renderer contingency in this review are superseded;
they do not choose or constrain the current host. Earlier request and schedule
estimates are dated evidence, not account-quota proof. Use the current round-two
plan for workload measurement, source-access comparisons, reliability and full
operating cost. Cloudflare remains the current implementation while that
comparison is completed; paid spend requires approval of a concrete estimate.

## Recommendation

Repair canonical data, publication/cache boundaries and reusable figures first. Then ship ten differentiated capabilities in independently verified tranches. Release criteria must include real source edition fixtures and authorized production journeys; a passing mock suite or attractive empty dashboard is insufficient.
