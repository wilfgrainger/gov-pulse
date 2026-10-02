# Public-data.org reinvention: design brief

Status: approved for local implementation by the user on 2 October 2026. This approval does not authorize production deployment; deployment remains a separate decision.

## Intent and success

Reinvent public-data.org as an engaging UK public-data publication: explain what changed, why it matters and how to verify it through distinctive editorial presentation and genuinely useful interactive tools. Classic FiveThirtyEight is the reference for energy, chart-first storytelling and statistical clarity, not a brand to copy.

The user explicitly authorizes rearchitecture and amendment/removal of constraining Markdown. Hard constraint: deployed hosting/runtime uses Cloudflare Free only. Working assumption: curious UK readers are the primary audience, with journalist/researcher depth available. Existing free GitHub CI/builds and the source-specific trusted NHS importer are permitted upstream tooling; they are not a second paid runtime. If “Cloudflare only” excludes even this existing ingest exception, replace it only with a proven official source reachable from Cloudflare and report any remaining NHS blockage.

Success means every existing public value and chart has a source-owned, tested contract; all pages share the new identity; all ten features meet their acceptance criteria; and resource usage is measured within verified Free limits. Missing inputs must remain honestly unavailable. Previously verified historical editions may be read as history, with explicit as-of dates, without being promoted to current headlines.

Companion review: [website and evidence review](2026-10-01-publication-reinvention-review.md). Implementation plan: [phased plan](../plans/2026-10-01-publication-reinvention.md).

## Three approaches

| Approach | Advantages | Costs and risks |
| --- | --- | --- |
| **Recommended: canonical evidence plus modular publication redesign** | Reuses Next, source collectors, Cloudflare jobs and existing contracts; fixes causes across every consumer; allows a full visual replacement | Requires disciplined data migration and measured OpenNext request budgets |
| Visual overhaul on current components | Fast initial appearance change | Preserves contradictory availability, chart/export defects and duplicate registries; unsuitable for the requested repair |
| Full framework/storage rewrite | Maximum freedom; a thin renderer may reduce CPU | Rebuilds already-working source logic, expands migration risk and delays meaningful features; reserve renderer replacement for a measured Free-limit failure |

The first approach permits replacing entire components and selected boundaries. It is not a mandate to preserve current names, visuals or page composition. Framework changes require a demonstrated product or Free-resource benefit.

## Exactly ten new capabilities

Baseline repairs are mandatory work beneath these features; they do not count as additional features.

| # | Capability | Reader experience and scope | Acceptance |
| --- | --- | --- | --- |
| 1 | **Vibrant editorial design across the platform** | New masthead, typography, topic identity, chart-led homepage, page layouts, mobile navigation, tables, exports, source/trust pages and all unavailable/withdrawn/error states | Every public route and all 16 existing shared-chart uses migrate; no legacy palette islands; usable at 320px and 200% zoom, keyboard/no-JS/reduced motion supported |
| 2 | **Complete measure atlas** | Dedicated `/measure/[id]/` pages and a registry-driven library for every supported displayed measure, not just today's eight explorer items; discover definitions, availability, source, history and related questions | Inventory coverage test accounts for every current displayed measure; search includes every active topic/measure; consistent figures/dates across home, atlas, topics and downloads |
| 3 | **Chart and comparison studio** | A saved, shareable workspace with up to four synchronized panels, exact period selection, comparable overlays, chart/table views, and citation-complete image/data packages | Incompatible measures cannot share a numerical axis; dates clipped on both ends; no invented points; portable exports include all displayed sources/units/periods/caveats |
| 4 | **The UK data briefing** | A dated editorial edition with “what changed since the last release”, concise sourced explanations and authored chart-led stories | Distinguishes new observations, revised observations and method changes; no story generated from unavailable evidence; no claim that refresh time is publication time |
| 5 | **Release calendar and local watchlists** | Source-published upcoming releases, “follow this measure”, an on-device board and calendar-file download | Published release date and estimated cadence visually distinct; unknown dates remain unknown; no accounts/tracking; expired values disappear from local boards on revalidation |
| 6 | **Cost-of-living lens** | Guided exploration of prices, real earnings, Bank Rate and official housing costs; initial new source contract is ONS private-rent price history; separate panels explain distinct clocks/geographies | Reuses existing CPI/earnings; verifies one new official rent series, units and revisions; no personal inflation estimate or inferred mortgage costs; missing rent data does not hide valid earnings |
| 7 | **Polling lab** | Multi-pollster publication history, filters by pollster/fieldwork/method, direct-label party trends and full primary-table disclosures | At least two independently verified primary publishers before calling it multi-pollster; no fabricated history, synthetic average or seat forecast; publisher uncertainty retained, unsupported calculated intervals removed/separated |
| 8 | **Public-money explorer** | Buyer/supplier dossiers, disclosed award amendments, procurement coverage/exclusions, and aligned fiscal views for receipts/debt/interest where sourced | Resolve revisions before ranking, proven geography only, filter denominators exact; do not label award values as paid spending or size as waste; no lifecycle inference from absent notices |
| 9 | **Interactive UK-in-context charts** | Horizontal dot plots and aligned country panels for the existing seven measures, country/year/basis filters, explicit missingness and UK highlighting | Same-definition/currency/year policy required for a shared axis; display country denominator and status; recover each measure independently after source failures; no combined national score |
| 10 | **Evidence, revision and correction ledger** | Source dossiers linking figure to exact release and validation, dated corrections, and edition comparison showing what was revised | Historical editions clearly labelled as-of; version identity immutable; revision cannot be inferred from a later fetch alone; operational secrets/internal KV keys remain private |

Simple search, downloads, URL sharing, error bars, badges and procurement filters already exist; features 2/3/7/8 must deliver the extensions above to count as complete.

## Visual and information design

Use a warm-white canvas (`#FFFDF8`), dark ink (`#18202A`), a vivid orange identity (`#FF6B35`) and coordinated teal (`#008575`) and purple (`#6654C0`) accents. These are candidate design tokens, subject to actual contrast checks. Use dark text on vivid orange; never assume white-on-orange is accessible. Each topic has a stable accent, but semantic status and political-party colours remain distinct systems.

Large bold sans-serif headlines replace the current serif-heavy identity. Retain local Inter initially; use tabular figures and modest monospace only for numerical annotations. Any new font must be self-hosted, licensed and justified. Avoid expensive new animation dependencies. Bright identity comes from composition, typography and colour, with subtle interaction; figures remain readable without motion.

Homepage hierarchy: compact masthead and topic navigation; one strong sourced lead chart and headline; today's briefing/next releases; a dense but readable measure grid; editorial stories and topic entrances. The unavailable edition provides useful source/release/history navigation in normal-height modules, not repeated oversized empty cards. No global “live” treatment that implies all evidence shares a clock.

Every evidence figure has a reader question, source-bound answer, unit/geography/period, plot, readable annotation, publication/source line, uncertainty/revision caveat, and table toggle. On phones, use fewer ticks, direct labels, readable type and vertical small multiples rather than shrinking a desktop SVG. Bar magnitude scales start at zero; fitted line scales disclose their bounds. Use missing-value gaps, observed dates and explicit methodology breaks. No decorative smoothing or invented interpolation. Sampled history means published observations, not invented measurements between releases.

Existing GDP, rates, labour, debt, receipts, wages, migration, NHS, polling, procurement, comparison, Early Years and homepage charts all migrate to this figure contract. Labour rates become coordinated small multiples. Polling uses discrete publications and disclosed uncertainty. Country tables gain dot plots. Market prices remain raw reciprocal percentages, not calibrated probabilities. Withdrawal pages are redesigned and retained unless a reproducible source contract replaces the withdrawn product.

Shared navigation adds a skip link on every route and works at 320px without clipping. Focus must survive filters/dialogs and Escape closes/restores correctly. Use 44px primary touch controls, visible focus, non-colour distinctions, honest tables and progressive enhancement. WCAG AA text and meaningful graphics contrast are measured rather than encoded as immutable old colours.

## Evidence model and publication

One canonical catalog owns measure identity, definitions, sources and comparability. Each record carries independent observation period, release date, retrieval/check time, source-owned validity, source edition identity, revision status, geography, unit, statistical/accounting basis, evidence class and comparable-history identity. A source failure updates collection condition separately. Retain last verified evidence only while valid for the current edition.

Collector parsers remain source-specific. Normalisation/reconciliation is shared through tested contracts; frontend components do not parse upstream data. Early Years moves from loose embedded fallback to a validated, explicitly dated source publication, with rolling collection only after source feasibility is proved. MOJ gets its own edition discovery. Indicator measures no longer inherit one all-or-nothing section clock. Existing explicit-expiry and partial-publication implementation is reused.

Procurement resolves all amendments/cancellations in a bounded complete window before top-100 truncation. Unknown/ambiguous geography stays unknown unless official identifiers prove it. International validity is measure/edition-specific; a source timeout must not erase a still-valid previous measure or declare genuine missingness. NHS importer acceptance is followed by idempotent finalisation and bounded identity readback.

Use additive schema migration: retain current endpoints/fields while adding catalog/edition metadata; consumers tolerate both during rollout. Existing links and withdrawal explanations stay reachable. Do not couple comparison health to national readiness.

## Cloudflare Free architecture

Retain Next.js for authoring/app development and the current OpenNext renderer initially, a source-isolated ingestion Worker with Queue jobs, KV publication artifacts, and static assets. Prepare measure catalog, briefings, revision summaries and release metadata once in background jobs. Interactive filtering/comparison/export runs in the browser. The initial features require no D1, R2, Durable Objects, Workers AI, paid APIs, backend accounts, server subscriptions or per-reader jobs.

Replace repeated origin self-fetches with a shared delivery adapter and optional service binding after measurement. Trust/static routes do not require a national snapshot read. Cache immutable edition artifacts by identity. For current artifacts, TTL is no longer than the earliest served validity boundary; no stale revalidation may promote expired evidence. Reader-specific watchlists are never edge-cache inputs.

The bounded public-contract manifest is the source of truth for the exact public routes, including the current edition archive contracts. Archive edition identifiers are strictly validated. Internal collector/KV/run interfaces remain private. New public routes are permitted by the user's brief and approved manifest, not an open wildcard data API.

Keep 60 dated edition summaries by default, with content-addressed bounded change records and shared history rather than duplicating large national datasets per visit. Retention and artifact sizes must be tested against verified storage/write budgets. Historical records have an as-of label and cannot seed a current number without current validity validation.

Resource release gate: verify official Free limits, inspect the actual account configuration without printing credentials, derive schedule/message/retry/write/read counts from registry, and measure representative OpenNext HTTP requests plus large XLSX/PDF jobs. Include public traffic and cache misses in low/expected/peak scenarios. Keep at least 20% measured headroom against each enforced limit in the agreed workload; respect hard per-request/per-key limits. This is a project target, not an assertion about Cloudflare quotas. No auto-upgrade or paid billing fallback.

Bound ingestion before measuring it. Initial Worker workbook limits are 8 MiB
expanded per retained entry, 24 MiB total expanded retained content, 25,000 rows
per worksheet and 250,000 parsed cells per workbook. Count actual decompressed
stream bytes and stop before accumulating over the cap; ZIP header declarations
alone are insufficient. Stored/uncompressed entries and decoded/shared-string
allocations must also be accounted for. Test compressed-small/expanded-large
inputs and real accepted publication fixtures. These are conservative project
limits, not Cloudflare quota claims; they do not by themselves prove Free CPU
or memory feasibility.

If a valid official workbook exceeds the Worker budget, decompose by genuinely
independent source module/sheet without dropping reconciliation. If that cannot
fit, use the existing approved free trusted-ingest pattern with the same
validation and publication contracts, after proving a free executor allowance.
Otherwise report that source as blocked. Do not lift resource limits blindly,
bypass integrity checks or upgrade to paid. Renderer replacement cannot solve
an oversized ingestion job.

**Renderer contingency:** if OpenNext cannot fit verified Free CPU/bundle constraints after bounded simplification, replace production delivery with a thin Cloudflare Worker serving pre-rendered editorial templates/static assets and injecting a validated compact edition. Reuse canonical contracts and browser islands. Prove escaping, hydration strategy, source/currentness parity, routing, metadata and no-JS tables before cutover. Do not retain two competing production renderers. This is a gated architectural decision, not two implementations to build in parallel.

CI remains free repository tooling. Reuse the existing trusted NHS workflow rather than adding another scheduled workflow; prove it is within the available free CI allowance and does not require a paid executor. If no free compliant retrieval route exists, record the source as blocked rather than substitute unverifiable figures.

## Documentation authority

Keep `AGENTS.md`, the public-contract manifest and accepted architecture decisions authoritative. Retire superseded living roadmaps and duplicate architecture summaries; preserve dated evidence audits and methodological withdrawal records. Replace aesthetic veto tests with approved design/accessibility checks. Do not impose fixed file-count, concern-count or line-count CI limits: CI reports the changed-file list, while architecture guards, lint, tests and builds remain blocking.

## Execution and acceptance

Sequence: governance/inventory and Free/source feasibility; highest-risk data repairs; canonical model and all existing chart repair; full visual system; atlas/studio; briefing/calendar/ledger; specialist lenses; full populated and production verification. Integrate each tranche with narrow tests and a reviewed commit before proceeding. Do not stop with a beautiful empty edition.

Required checks include source publication fixtures, signed/zero/missing values, revision handling, expiry/cache boundary clocks, SSR/hydration/no-JS parity, cross-page equality, all source failures independently, mobile/keyboard/export journeys and resource usage. Fixtures used for browser tests are explicitly test evidence and never enter production publications. Later source/currentness checks need authorized network access. Publishing is a separate authorized action; a local build does not prove production data.

Completion requires all ten capabilities plus baseline repairs, no unexplained required failures, accounted unavailable sources, and passing real deployed journeys after deployment authorization. External source failures must be reported precisely; they cannot be marked complete by creating an empty feature shell.
