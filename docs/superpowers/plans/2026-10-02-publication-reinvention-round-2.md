# Publication reinvention, round two: execution plan

**Status:** In progress. Execution began on 2 October 2026. No production-readiness claim is made until each affected live journey is verified.

**Goal:** Turn all ten first-round capabilities into a distinctive, useful, populated public-evidence publication, while removing process and delivery work that does not protect readers or improve the product.

**Execution:** Complete the user's whole requested outcome in priority order. Cave Pony applies to response-token economy only. No file, line, route, feature, architecture, or validation ceiling may shrink the product. Do not run a full PR gate or request another approval for every checkbox; use focused checks during work and the required quality gate at meaningful integration points. Keep each step reviewable and update the plan when live evidence changes an assumption.

**Scope:** The user's ten priorities below govern product order. Foundational repairs support those priorities; they do not require every upstream source to recover before design work proceeds. The prior Cloudflare-Free-only requirement is removed: keep Cloudflare as the current implementation while comparing any platform needed to deliver the full product. Do not incur paid spend without the user's approval of the cost. Source truth, privacy, security, accessibility, and compatibility remain product protections, not scope ceilings. Checkboxes record demonstrated completion, not intention.

## 1. The product we are building

A reader should arrive, understand an important change, see the evidence immediately, investigate it, compare it correctly, save or share the result, and return when new evidence appears. The site should feel like an ambitious data-journalism publication, with bold editorial typography, a purposeful colour system, generous but useful space, and well-composed charts. Avoid another collection of identical cards beneath enormous generic headings.

| User priority | Round-two outcome | Completion evidence |
| --- | --- | --- |
| 1. Vibrant redesign | A coherent publication front page, topic pages, tools and stories; charts and useful findings appear early; clear mobile navigation. | Real populated desktop/mobile journeys, keyboard and reduced-motion checks, no clipped charts or repeated boilerplate consuming the lead. |
| 2. Measure library and atlas | Searchable coverage of every supported public measure, clear unavailable entries, rich measure pages and geographically valid views. | Source-to-catalog reconciliation; every supported measure has a working deep link, definition, dates, history and export or a precise availability explanation. |
| 3. Comparison studio | Useful initial comparisons, compatible overlays, separate panels for different concepts, stable shared URLs, saved browser-local workspaces and cited downloads. | URL round-trip, compatibility, missingness, one-point plots, exported values and metadata verified. |
| 4. Briefing, stories, RSS | A dated edition led by meaningful changes, original data-bound explainers and reliable syndication. | New observations and revisions distinguished; historical editions stable; RSS links, identifiers and dates verified. |
| 5. Calendar and watchlist | Discover real upcoming releases, follow measures locally, see changes since last visit and export dates. | Confirmed source schedules, unknown dates explicit, local persistence and calendar import verified. |
| 6. Cost of living | A useful household-evidence journey across prices, pay, housing and rates, including verified private rents. | Rent source-to-screen history verified; units and geography preserved; no invented personalised bills or incompatible totals. |
| 7. Polling lab | Multiple primary pollsters, useful publication history, fieldwork context, party comparisons and transparent methods. | At least two independently verified pollster streams and bounded historical records; source tables reconcile; no synthetic polling average. |
| 8. Public-money dossiers | Searchable notices and credible buyer/supplier dossiers with clear identifiers, amendments and coverage. | Duplicate/amended awards and ambiguous names handled; displayed totals reconcile to the declared retrieved universe. |
| 9. Country comparisons | Reader-selected peers and years with useful separate measures and intelligible missingness. | Comparable denominators, mixed-year disclosure, tie handling and primary-source exports verified. |
| 10. Source, revision and archive ledger | Readers can trace a claim to its publication, inspect a changed value and open the historical edition that contained it. | Production list-to-detail reads, immutable versions, meaningful diffs, retention and source links verified. |

Numbers inherited from round one—eight measures, four comparison panels, thirteen countries, seven country measures, fifty watchlist entries, sixty archive editions—are defaults or resource decisions, not permanent ambition limits. Change them when a reader need and measured capacity justify it. The plan does not require filling arbitrary quotas with weak evidence.

## 2. Findings that change the plan

These are diagnostic observations from the planning inspection, not a permanent operational status report. Reproduce them before implementing their fixes. Derive current PR/deployment status from GitHub and `scripts/report-github-current-state.mjs`.

| Finding | Evidence in the inspected implementation or public journey | Consequence and owner |
| --- | --- | --- |
| The shared ticker presents constants as live evidence. | `BritishDatelineTicker.tsx` contains fixed GDP, inflation, rates, NHS and contract numbers beneath “LIVE UK EVIDENCE”; contract awards are described as spending. | Immediate public-claim repair in Task 3. Remove unsupported numbers until validated replacements exist. |
| The catalog was much less populated than the section snapshot. | An earlier live snapshot exposed only two measures; a later refresh added rent measures. | Task 3 re-fetches the current publication, reconciles every eligible record against source fields and explains each omission. Never treat an earlier count as current proof. |
| Catalog omission is silent. | `worker/measure-catalog.js` returns null for missing edition identity, date, URL, history or reconciliation. Several collector shapes do not satisfy those assumptions. | Preserve validation; normalise the actual source contracts and report why an entry is unavailable. |
| A valid listed archive edition cannot be opened publicly. | `/data/editions.json` returned an ID; `/data/edition.json?edition=<that ID>` returned HTTP 404 with HTML. | Task 4 diagnoses deployed routing and storage separately; a working index is insufficient proof. |
| The comparison overlay has a single-date positioning bug. | Its x-scale multiplies the single-date fallback `340` by `680`; a one-point SVG path also lacks a visible point marker. | Task 5 proves one-point charts and replaces duplicated faulty scale logic. |
| Deployment waits for upstream evidence after deploying code. | `deploy.yml` forces bootstrap on every push, allows 420 seconds, and runs reader-route smoke tests afterwards. | Task 1 separates code release from explicit recovery and ensures reader checks run. |
| Normal PRs build the app twice. | Full-quality and the nonblocking Lighthouse job independently install, prepare and build. | Task 1 keeps one normal PR build; Lighthouse becomes explicit diagnostics. |
| Documentation can bypass meaningful checks. | The lane classifier treats all of `docs/` and `.agents/` as documentation, including executable JSON/scripts. | Task 1 fixes the classifier; source-ownership JSON must not silently use the docs lane. |
| Markdown prose still gates code. | `check-source-repair-backlog.mjs` requires an issue, PR, exact SHA, Actions URL and date for a “RESOLVED” section. | Task 0 removes the prose gate and keeps behavioral evidence tests. |
| Development can regenerate agent instructions. | The installed Next version supports `agentRules`; this project does not disable generated rules. | Task 0 sets the supported opt-out and proves a dev start does not rewrite `AGENTS.md`. |
| Moving NHS retrieval to GitHub is not a proven fix. | A trusted-ingest run received an upstream access-challenge page instead of the annual RTT page. | Task 2 verifies permitted official retrieval and rejects challenge HTML. Do not treat this as an ordinary missing-anchor parser bug. |
| Existing features retain substantive gaps. | Calendar covers few source families; current catalog now has private-rent level and change measures but the full lens still needs verification; public-money identity is name-based; polling breadth/history need proof. | Dedicated feature tasks below, with real data acceptance. |

A ready national health response does not prove every optional source or product tool is complete. NHS is currently optional in the live implementation; assess its actual importer path rather than inferring failure from a missing national queue terminal. Do not silently redefine required sources to make health green.

## 3. Rules: keep, change, retire

### Keep because they protect the product

- Primary-source identity, observation and publication dates, geography, units, revision caveats, explicit missingness and honest currentness.
- Separate statistics, administrative records, polling and market signals. Never invent a combined crime total, national score, polling forecast or accusation about spending.
- Semantic HTML, keyboard operation, visible focus, legible contrast, text alternatives and reduced motion. Colourful design is compatible with these requirements.
- Bounded untrusted parsing, allow-listed publishers, timeouts, secret protection, generic public errors, private operational routes, safe publication and recovery.
- No provider or free-tier ceiling. Measure the current workload and compare suitable platforms, reliability and full operating cost. Obtain the user's approval before committing paid spend.
- Deterministic dependency locks, meaningful lint/tests/builds, source ownership and public-contract checks. Keep data failures distinct from broken code releases.
- Preserve user files and require task authority for external actions. A plan is not a deployment.

### Change because they encode old implementation or process

- “Calm/restrained” must not prohibit bold editorial design. Preserve chart honesty and accessibility, not one historical palette or layout.
- Platform and hosting documents describe the current deployment; they do not prohibit another architecture that better serves the product. Keep one canonical production route and preserve the public/private trust boundary.
- Fixed route counts, blanket bans on application APIs, unchanged frameworks and no-migration preferences become descriptions of the current system. Change architecture when a specific task needs it; retain explicit public/private ownership.
- Replace multiple vision/backlog/execution authorities with a short root guide, current architecture/contracts, and this implementation sequence. Historical research remains evidence, not an instruction override.
- Remove prose-format checks, mandatory persona/subagent sequences and repeated approval rituals from active project guidance. Review actual behavior and risk.
- Keep sensible bounded defaults, but make caps traceable to capacity or usability rather than treating them as sacred product limits.
- Distinguish normal code release, optional diagnostics, source collection, source recovery and Pages fallback. A failing upstream publisher is not evidence that a successfully deployed UI revision failed.

### Already removed: do not spend round two removing them again

The former `north_star.md`, `roadmap.md`, `tasks.md` and change-complexity gates are absent from the inspected tracked tree. Their old limits must not be reintroduced under new names. The repository Cave Pony skill and `AGENTS.md` now explicitly preserve full scope; Cave Pony controls response length only. No nested repository `AGENTS.md` was found.

### GitHub settings are a separate audit surface

Task 1 verifies the live `main` ruleset, required checks, workflow permissions and environment approvals through GitHub before relying on them. Retain protections that prevent accidental destructive updates and require meaningful release validation; do not add mandatory human review rituals without a specific need.

## 4. Delivery sequence and dependencies

| Increment | Tasks | Result that can be reviewed and released |
| --- | --- | --- |
| A. Unlock scope and deliver priority 1 | 0–6 | Remove stale steering/host assumptions, speed useful feedback, repair false claims and data delivery, then carry the visual system through real pages and reliable charts. |
| B. Deliver priorities 2–3 | 7–8 | Full supported measure atlas and a reliable, shareable comparison studio. |
| C. Deliver priorities 4–6 | 9–11 | Dated briefings/stories/RSS, release calendar/watchlist and a complete cost-of-living lens with verified rent series. |
| D. Deliver priorities 7–10 and finish | 12–16 | Multi-pollster lab, public-money dossiers, country comparisons, source/revision/archive ledger, and production proof for all ten outcomes. |

Task 0 and Task 1 can complete independently of publisher availability. Visual work starts immediately and does not wait for source recovery; Tasks 3 and 5 supply truthful populated states. Task 4 feeds Tasks 9 and 15. Source recovery in Task 2 continues only where a concrete next diagnostic exists; blocked NHS access must not freeze other capabilities. The four increments are coherent review/release points, not one-PR-per-feature rules.

## 5. Executable tasks

### Task 0 — Remove conflicting steering and prose gates

**Files:** `AGENTS.md`, `.agents/skills/cave-pony/SKILL.md`, `README.md`, `next.config.ts`, `.github/pull_request_template.md`, `.github/workflows/pr-validation.yml`, `scripts/check-source-repair-backlog.mjs`, `scripts/lib/pr-description-policy.mjs`, `scripts/check-hosting-boundary.mjs`, `docs/architecture/decisions/0002-publication-reinvention.md`, `docs/operations/deployment-ci-frugality.md`, `docs/operations/free-resource-budget.md`, and the Markdown inventory in section 7.

- [x] Make `AGENTS.md` a concise active guide: mission, source/claim rules, architecture ownership, practical validation and the user's authorised scope. Link this plan as the execution reference; remove contradictory current-authority references.
- [x] Mark old specifications, audits and plans as historical where needed; retain source evidence and useful decisions. Remove obsolete workflow/persona requirements and duplicate current-status instructions. Avoid rewriting research solely for cosmetic consistency.
- [x] Remove the source-backlog prose check from CI and delete its script if no callers remain. Remove unused PR-body parser helpers only after checking imports. A short substantive PR explanation remains useful; prescribed headings/path punctuation and exact-SHA prose do not become gates.
- [x] Set the installed Next configuration's supported `agentRules: false` option. Start and stop the dev server once and verify the root guide is unchanged; its SHA-256 remained `7925016A…5E5ABA`.
- [x] Make repository Cave Pony response-token-only and state in `AGENTS.md` that simplicity cannot reduce requested scope, ambition, architecture choices, or useful verification.
- [x] Remove Cloudflare-Free-only and GitHub-Pages-prohibited instructions from active prose. Treat Cloudflare as the current host, not a permanent choice. Remove the redundant provider-ban script; public release checks retain canonical-domain/revision verification, with runtime checks owned by the selected deployment. Mark prior Free-only vision documents superseded.
- [x] Update the release/runbook documents alongside Task 1 so docs describe the resulting executable pipeline. Do not create a second governance framework.

**Proof:** `node scripts/check-text-policy.mjs --changed`, `git diff --check`, `npx vitest run tests/unit/publicationProgramme.test.ts`, and a repository search for removed gate references. Confirm a normal developer command no longer rewrites agent guidance.

**Done when:** No active repository Markdown, generated agent rules, vision file, or executable host/code gate limits authorized product scope or locks the platform by default. Evidence, privacy, security, accessibility and spend approval remain explicit protections.

### Task 1 — Make CI and deployment fast, trustworthy and independent of source recovery

**Files:** `.github/workflows/pr-validation.yml`, `.github/workflows/deploy.yml`, `scripts/lib/pr-validation-lane.mjs`, `scripts/check-static-architecture.mjs`, `scripts/release-smoke.mjs`, `scripts/bootstrap-cloudflare-publication.mjs`, `docs/operations/deployment-ci-frugality.md`, `docs/manual-rollout-checklist.md`; existing release/bootstrap tests.

- [x] Keep the cheap docs lane for actual documentation. Route `docs/architecture/source-ownership.json`, executable files under `.agents/`, workflow changes and relevant config changes through their meaningful checks. Add classifier cases for these paths and a genuine Markdown-only change.
- [x] Remove routine Lighthouse's second installation/build. Retain an explicit diagnostic path for performance changes and release investigation; use an existing artifact only if this remains simpler than one manual diagnostic run.
- [x] Keep one required quality result aggregating source/security boundary guards, lint, unit/Worker tests and one Next application build. Remove prose gates and misleading lockfile-step wording. Do not replace the full suite with an unproved changed-test heuristic.
- [x] Replace arbitrary architecture guard assumptions with ownership/contract assertions where needed: public route manifest consistency, private collector isolation, expected bindings and supported deployment outputs. A declared application API should not fail solely because it lives under `app/api`.
- [x] Stop forcing fresh collection on normal push deployments. Keep explicit `refresh_evidence` recovery and Pages-seed recovery. Run bounded revision, route and health-contract verification after code deployment; accept a valid degraded publication but fail broken routes or malformed contracts.
- [x] Separate recovery outcome from code-release outcome so an upstream failure remains visible without skipping reader smoke checks. Cover complete, degraded, unavailable-with-valid-contract, malformed response, wrong revision and missing route cases. Define precisely which unavailable responses are supported; do not turn every error green. In forced refresh, inspect the active run before replacing its ID with a scheduled retry; a finalised run at the retry boundary must not be lost.
- [x] Avoid repeating full release lint/tests only when validation can be tied to the actual release tree, relevant base and workflow. Preserve fallback validation for direct main pushes or missing proof. Compile OpenNext once per deployment; a PR Next build is not itself the deployable Worker artifact.
- [x] Verify effective main branch targeting, required check and workflow permissions: `main` is protected by PR + `quality`, deletion and force-push prevention remain, no approval count is required, and workflows use read-only repository permissions.
- [x] Compare runner minutes and critical-path duration using equivalent before/after runs: aggregate job runtime fell from 235s to 122s (48.1% less); wall time stayed 135s. The latest full-quality job took 114s, with 51s in unit/Worker tests, 16s in build, and 13s in lint.
- [x] Reduce remaining feedback delay without reducing proof: after one dependency install and `build:prepare`, overlap lint, unit/Worker tests and the single app build; preserve every exit code and log. The merged PR run completed in 118s overall with a 100s full-quality job, versus the recorded 135s overall / 114s full-quality comparison. It retains one install and one application build.
- [ ] Evaluate Cloudflare and suitable alternatives early against request-time rendering, source access, ingestion, durable history, reliability, operational work and current official pricing. Recommend a platform from measured reader needs; show any paid option's concrete cost before asking the user to approve spend.

**Proof:** Extend `tests/unit/deploy-degraded-release.test.ts`, `tests/unit/release-smoke.test.ts` and the bootstrap tests for actual behavior, not exact YAML prose. Add classifier tests beside the existing script tests. Run targeted tests, lint and the affected build path. Demonstrate one docs PR, one code PR and one valid degraded release without forced collection; verify no secrets or collector routes become public.

**Done when:** Code feedback has no scope/size heuristic, prose gate, redundant build, provider veto or forced source-refresh wait. The complete quality result remains fast and evidence-based; the selected production host and reader routes are verified once per meaningful release.

### Task 2 — Establish source diagnostics and recover the actual failing paths

**Files:** `worker/feed-registry.js`, source collectors, `worker/nhs-rtt-source-discovery.js`, `worker/live-nhs-publication-collector.js`, `scripts/trusted-nhs-rtt-ingest.mjs`, `.github/workflows/nhs-ingest.yml`, existing publication diagnostics and source tests.

- [ ] Trace each active source from retrieval through parser, contract, finalisation, current publication and public page. Report source-specific rejection categories privately; public availability copy should be useful without exposing operations.
- [x] Reproduce current polling and NHS failures with bounded retrieval. Treat access-challenge HTML as an upstream access failure, not empty statistical data or a legitimate annual page. NHS challenge markup now has a distinct private error category.
- [x] Reproduce the explicit-recovery race: a refresh job reported failure, then a ready 19-record publication was observed. Trace cache headers, prepared-artifact visibility, health/readiness polling and the deadline before changing retry or timeout values. The retry boundary replaced the ID for a run that had just finalised; a focused test now proves the completed first attempt is accepted before a retry is sent.
- [x] For NHS, verify permitted direct official download/discovery endpoints and reconcile the press notice, workbook headline, missing trusts and historical series. Use an approved retrieval method if required; do not bypass access controls or invent data. If blocked, record the actual external dependency and continue independent tasks. Direct official collection succeeds in the current session for the July 2026 edition; the GitHub runner still receives NHS England's AWS WAF challenge, and no approved automated alternative has been verified. Keep NHS unavailable in production until a permitted route is confirmed.
- [x] For polling, repair the existing publisher's newest-edition discovery and result-table reconciliation before adding more publishers in Task 12. The live article now parses its visible publication byline, current sample-size format and commissioner wording; collector output matches the linked results table.
- [ ] Verify that a successfully ingested optional source reaches the prepared artifact and reader after finalisation; retry and replay remain bounded and idempotent. Required/optional classification changes need an explicit product rationale, not a desire for green status.
- [ ] Keep operational source health, public national readiness and product-feature completeness separate. A feature needs its own source-to-screen acceptance even when national health is ready.

**Proof:** Existing NHS source-discovery/parser/RTT/trusted-ingest tests, polling-entry tests, publication-currentness tests and one permitted live source-to-screen trace per recovered source. Include challenged HTML, changed schema, partial workbook and stale prior values.

**Done when:** Each current failure has a verified repair or a precise external blocker; successful ingestion is observed in the public product. A blocked source does not certify its feature complete.

### Task 3 — Populate the canonical evidence model and remove false live claims

**Files:** `worker/measure-catalog.js`, `contracts/measure-record.js`, `contracts/measure-record.d.ts`, `contracts/measure-coverage.json`, `contracts/public-surfaces.json`, `app/lib/measureDefinitions.ts`, `app/lib/measureCatalog.ts`, affected source normalisers, `app/components/visuals/BritishDatelineTicker.tsx`, `app/components/SectionNav.tsx`.

- [x] Delete the hard-coded ticker numbers and “100 Active Awards” claim immediately. Feed the ribbon verified current measures with period/source context, or render a useful nonnumeric publication status. Label procurement awards accurately.
- [ ] Reconcile each existing catalog definition against real source-owned fields: GDP and employment editions, debt headline/history, receipts, per-series sentiment provenance and validity. Verify geography and statistical basis against the primary publication rather than copying a guessed label.
- [ ] Preserve `MeasureRecord` identity, unit, geography, source edition, observation window, publication/retrieval clocks, validity, revision identity and explicit-null points. Define deterministic publication identity from verified publisher identifiers where a publisher supplies no explicit ID; never invent an observation or use retrieval time as publication time.
- [x] Use one authoritative measure-definition inventory. Derive UI options and coverage assertions from it instead of maintaining competing eight-item lists. Keep unsupported/unavailable definitions discoverable with an availability reason, separate from validated observations.
- [ ] Add private diagnostics for catalog exclusions. Distinguish no source, invalid metadata, expired value, empty history and headline/history mismatch. Keep per-measure freshness when several measures share one section.
- [ ] Expand adapters to supported economic, fiscal, housing, health, migration and separate crime measures. Preserve distinct record grains: poll publications, award notices and country observations must not be forced into a misleading generic scalar series.

**Interface:** Keep validated `MeasureRecord`/`MeasureCatalog` as the chart/export contract. Extend definition/availability metadata separately if an unavailable source cannot truthfully supply required observation metadata. Consumers must never infer zero from absence.

**Proof:** `tests/worker/measure-catalog.test.ts`, `tests/unit/measureCatalog.test.ts`, affected collector tests and a ticker regression test. Use representative actual source-shaped fixtures, not only idealised catalog objects. Reconcile live eligible measures against emitted records and display reasons for omissions.

**Done when:** Every supported eligible live measure enters the catalog, every omission is explainable, no stale value is presented as current and no static numeric claim masquerades as live evidence.

### Task 4 — Make historical editions retrievable and stable

**Files:** `worker/edition-archive.js`, `worker/edition-summary.js`, `worker/public-data-entry.js`, `worker/wrangler.toml`, `contracts/public-surfaces.json`, `app/lib/serverEditionArchive.ts`, archive route tests and deployment verification.

- [x] Reproduce list-to-detail failure with the actual listed ID, capturing status, content type and serving Worker. Compare manifest, deployed route matching including query strings, Worker dispatch and KV content; identify the responsible boundary before changing routing.
- [x] Fix that boundary while preserving an explicit allow-listed public route and strict edition-ID/query validation. Reject unknown IDs consistently; never fall through to a misleading HTML success page.
- [ ] Validate archive payloads at server consumption, including schema, matching IDs and historical status. Publish durable content before advertising it in the index; prove interrupted writes cannot create permanently dangling entries.
- [ ] Keep editions immutable and retrieval-only refreshes from manufacturing new revisions. Test replay, concurrent finalisation, corrected observations and expired current evidence with valid historical reads.
- [ ] Measure edition size and write/read frequency. Specify a retention policy that preserves public history truthfully; changing the current sixty-edition default requires measured capacity, not an assumed entitlement to unlimited KV.

**Proof:** `tests/worker/edition-archive.test.ts`, `tests/worker/edition-summary.test.ts`, public-route tests, then public index → JSON detail → rendered edition → referenced source. Test one real ID, an unknown ID, malformed and duplicate parameters, and a missing stored record.

**Done when:** Every retained listed edition can be read through its advertised public path and the displayed historical values remain stable across new releases.

### Task 5 — Make chart rendering and export reliable with real data shapes

**Files:** `app/lib/chartModel.ts`, `app/lib/chartExport.ts`, `app/components/charts/EvidenceFigure.tsx`, `app/components/charts/ObservationTable.tsx`, `app/components/FinancialTimeSeriesChart.tsx`, `app/components/PollingPublicationChart.tsx`, `app/components/ComparisonStudio.tsx`.

- [x] Correct the overlay single-date scale and render visible points for isolated observations. Reuse shared scale/rendering logic where it removes real duplication.
- [ ] Check zero, one, two and many observations; negative and constant values; irregular publication intervals; null gaps; revisions; very long labels and narrow screens. Nulls must remain visible gaps, not bridged or interpolated estimates.
- [x] Fix duplicate date/tick keys and distinguish genuinely separate publications on the same date. Avoid smoothing and decorative curves that imply unsupported observations.
- [ ] Standardise title, units, observation window, source/revision context, text alternative and table access. Use colour plus labels or shape; support keyboard interaction without trapping focus.
- [ ] Ensure CSV/JSON/SVG exports reproduce the selected observations, transformations, dates and citations. Neutralise spreadsheet formula injection in exported text cells. Make a one-point export as intelligible as the rendered chart.

**Proof:** `EvidenceFigure`, `FinancialTimeSeriesChart`, `chartExport` and comparison tests; browser inspection of populated 0/1/2/many-point cases at narrow and desktop widths. Assert geometry stays within the plot and compare downloaded values to the selected record.

**Done when:** A chart is accepted by inspecting the populated plot and its data/export, not because its heading and fallback table exist.

### Task 6 — Deliver the ambitious visual redesign across the site

**Files:** `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/components/SectionNav.tsx`, `app/components/PageHeader.tsx`, shared evidence/chart components and route templates.

- [ ] Build the visual direction directly in representative working pages: front page, polling topic, one measure and comparison studio. Use actual validated data or clearly test-only fixtures while an upstream dependency is blocked.
- [ ] Establish an editorial type hierarchy, colour tokens, chart palette, spacing and consistent buttons/filters. Use strong topic colour and compact evidence annotations; keep detailed methods available at the claim without repeating a large generic standards box everywhere.
- [ ] Recompose the front page around a leading evidence story/chart, a concise dated briefing, a varied topic grid and useful paths into the tools. Put charts or meaningful results in the first useful viewport rather than a giant title and download banner.
- [ ] Give each template an appropriate structure: editorial story, measure detail, exploration tool and source/history page. Replace generic repeated panel stacks. Choose frameworks and architecture for the result; the current stack gets no permanent preference.
- [ ] Make primary navigation understandable and mobile topic/tool discovery obvious. Preserve deep links, accessible search, active-route indication and keyboard menu behavior.
- [ ] Apply the chosen visual system to all active routes as their feature tasks land. Check empty/degraded states as deliberately as populated ones, without letting unavailable evidence dominate unrelated content.

**Proof:** Representative screenshots at 390px, 768px and 1440px; 320px overflow and 200% zoom checks; keyboard, focus, contrast and reduced-motion inspection. Check the actual first viewport, chart text and navigation, not just screenshot existence. Run affected component tests and the Next build.

**Done when:** The site visibly reads as one designed publication across desktop and mobile, with useful charts and clear editorial hierarchy. This is a full composition change, not another heading-size patch.

### Task 7 — Expand the measure library and atlas (priority 2)

**Files:** `app/components/MeasureLibrary.tsx`, `app/components/DataExplorer.tsx`, `app/lib/dataExplorer.ts`, `app/measure/page.tsx`, `app/measure/[id]/page.tsx`, `app/explore/page.tsx`, Task 3's definition inventory.

- [ ] Add search and shareable filters for topic, publisher, geography, frequency, unit and availability. Show coverage and missingness clearly; do not hide all unavailable definitions.
- [ ] Give each measure a complete page: current or historical value, change on a valid basis, readable trend, period, definition, revision caveat, publication date, source, download and comparison/watchlist actions.
- [ ] Cover all supported source-owned measures, extending beyond the original eight only where provenance and normalization are proved. Keep distinct crime and health concepts separately named.
- [ ] For geography, expose comparable geographies actually supplied by each dataset. Add a map only when boundaries, denominators and observations support it; use ranked lists/small multiples when clearer. A national-only measure should say so.
- [ ] Preserve stable measure URLs and redirects for any renamed IDs. Unknown IDs return a useful unavailable/not-found result rather than silently selecting another measure.

**Proof:** Search/filter URL round-trip, stable deep links, unavailable entries, source detail and export reconciliation. Exercise at least one populated measure from each supported family, plus missing and expired examples.

**Done when:** Readers can discover and investigate the supported evidence without knowing internal section names, and the atlas no longer relies on an arbitrary eight-item allow-list.

### Task 8 — Turn comparison into a useful studio (priority 3)

**Files:** `app/lib/comparisonWorkspace.ts`, `app/components/ComparisonStudio.tsx`, `app/compare/page.tsx`, shared chart/export functions.

- [ ] Add clear starting comparisons based on available compatible evidence, searchable measure selection and removable selections. Let observed reader needs and measured layout/URL payload capacity guide how many panels the studio offers; no inherited count is a ceiling.
- [ ] Keep shared-axis overlays limited to compatible definitions, units, cadence, geography and evidence class. Use separate panels for different concepts; explain incompatibility in reader language. Do not unlock misleading overlays merely to make a control usable.
- [ ] Make date windows, display choices and selections survive sharing, reload and browser navigation. Validate malformed, obsolete, oversized and repeated URL parameters; preserve a versioned workspace format.
- [ ] Add browser-local named workspaces with rename/delete/export/import, using the existing local-storage approach. Handle unavailable storage and newly unavailable measures explicitly.
- [ ] Make exports capture the exact selected window, mode, sources and transformations. Include a readable standalone chart and machine-readable observations.

**Proof:** `tests/unit/comparisonWorkspace.test.ts`, chart/export tests and a browser journey from atlas → compare → share → reload → download. Include one-point, no-overlap and mixed-unit selections.

**Done when:** A reader can build, understand, save and reproduce a useful comparison without false comparability or silent state loss.

### Task 9 — Publish useful briefings, explainers and RSS (priority 4)

**Files:** `worker/edition-summary.js`, `app/components/BriefingEdition.tsx`, `app/briefing/page.tsx`, `app/content/stories/household-budgets.ts`, `app/content/stories/public-finances.ts`, `app/stories/[slug]/page.tsx`, `app/feed.xml/route.ts`.

- [ ] Lead the dated briefing with meaningful new observations and material revisions, linked to the affected measure and edition. A re-fetch alone must not become a news event.
- [ ] Distinguish a changed observation from a corrected earlier value; calculate change only on a like-for-like basis. Show source coverage limits and missing prior editions without pretending a baseline exists.
- [ ] Complete the household-budget and public-finance explainers with data-bound figures, readable narrative and specific methodological caveats. Add a polling-methods explainer if needed by Task 12; do not generate unsupported causal claims.
- [ ] Keep numerical claims tied to explicit measure/edition references. A historical story must retain its original data context instead of silently updating every sentence to today's values.
- [ ] Make RSS valid and useful: stable item IDs, correct publication/update dates, canonical links, escaped content and clear distinction between editions and authored stories.

**Proof:** Edition-summary tests for new/revised/unchanged/first-edition cases; story rendering with unavailable data; RSS parser validation and opening every emitted item type. Verify one archived briefing remains consistent after a newer edition.

**Done when:** The briefing explains what changed and why a reader should inspect it, while its figures and history remain reproducible.

### Task 10 — Make the calendar and watchlist worth returning to (priority 5)

**Files:** `app/lib/releaseCalendar.ts`, `app/lib/watchlist.ts`, `app/components/ReleaseCalendar.tsx`, `app/calendar/page.tsx`, source adapters and measure action components.

- [ ] Discover publisher-announced release dates for active source families beyond inflation, unemployment and crime. Store provenance and confirmation time separately from the latest measurement's validity.
- [ ] Keep a verified future release visible even if the current measurement is unavailable. Distinguish confirmed, postponed, cancelled and unknown dates; never infer a promised release solely from cadence.
- [ ] Add useful upcoming/recent views and source/topic filters. Connect each event to its measure, methodology and source announcement.
- [ ] Finish watchlist controls, persistence, import/export and changed-since-last-visit indicators. Assess in-product, browser and external notifications against reader value, privacy, reliability and cost; do not rule out a useful delivery channel in advance. Any paid spend needs an approved estimate.
- [ ] Export valid ICS with stable identifiers, escaping, all-day semantics and correct UK daylight-saving handling. Rescheduling updates an event rather than creating duplicate calendar entries.

**Proof:** `releaseCalendar` and `watchlist` tests covering independent schedule evidence, rescheduling, missing storage, corrupt import, expiry and DST; import a produced ICS into a calendar-compatible parser and check dates.

**Done when:** Readers can follow a real upcoming release and return to the relevant evidence without invented scheduling or silent local-data loss.

### Task 11 — Add private rents and complete the cost-of-living lens (priority 6)

**Files:** `app/components/CostOfLivingLens.tsx`, `app/cost-of-living/page.tsx`, `worker/feed-registry.js`, Task 3's measure definitions, source-ownership contract; proposed source-specific rent collector/normaliser beside the existing ONS collectors.

- [ ] Reconcile the ONS private-rent measures (`privateRentAnnualChange`, `privateRentAverage`) in the live catalog to their publication, licensing, geography, price/growth definitions, publication clock and methodological breaks. Ensure any currently missing measure is repaired; do not treat catalog presence as proof the cost-of-living reader journey is complete.
- [ ] Register source ownership and implement bounded retrieval, strict normalization, history/headline reconciliation and currentness. Capture real publisher fixtures and failed/changed-shape fixtures; do not promote a placeholder to a source.
- [ ] Verify rent definitions and geography in the canonical catalog and source pages. Keep levels, indices and annual growth as separate measures, with geography-specific availability; repair missing or incorrect records without duplicating valid records.
- [ ] Recompose the lens into understandable prices, earnings, renting, buying and interest-rate sections. Explain who each measure describes; avoid implying that a national CPI rate is a household's own inflation or that Bank Rate equals their mortgage rate.
- [ ] Offer carefully labeled comparisons using compatible bases. Any rebasing or derived change must declare its formula, base period and unavailable conditions; do not sum unlike units into a household burden score.

**Proof:** Collector contract tests, `tests/unit/CostOfLivingLens.test.tsx`, real rent source-to-screen reconciliation, populated rent history/chart/export and missing/geography-break cases.

**Done when:** Private rent is backed by live primary evidence and the lens answers practical questions using correctly separated measures. A remaining rent placeholder is incomplete work.

**Implementation note (2 October 2026):** The existing ONS house-price collector already retrieves Figure 1, which contains separate PIPR and UK HPI columns. Round two extends that source-owned route to parse and reconcile both series, preserves the latest blank HPI as an explicit gap, and adds separate rent-change and average-rent catalog records. Consumer tests are being added; current production data remains unchanged until a compatible deployment is verified.

### Task 12 — Build a multi-pollster publication lab (priority 7)

**Files:** `worker/live-polling-collector.js`, `worker/election-polls.js`, `app/lib/pollingLab.ts`, `app/components/ElectionPolling.tsx`, `app/components/PollingPublicationChart.tsx`, registry/contracts and source-specific parser tests.

- [ ] Use the repaired existing stream from Task 2. Assess additional primary pollster publications for stable original tables, permitted retrieval, sample/fieldwork/method detail and machine-reconcilable results; choose on verified access rather than brand familiarity.
- [ ] Add at least one independently verified additional pollster adapter. Give each poll a stable publisher/publication identity, fieldwork window, sample universe, mode, weighting/base notes, geography and original table link. Unknown methodological details stay unknown.
- [ ] Store bounded historical poll publications and explicit corrections separately from the short currentness window. Deduplicate repeated retrieval and syndicated copies; historical data must never be represented as fresh because it was fetched today.
- [ ] Build filters for pollster, fieldwork/publication dates and parties; present individual observations with readable party labels and tables. Distinguish publication time from fieldwork time in charts and exports.
- [ ] Explain differences in question/base/method before inviting comparison. Do not invent margins of error for non-probability panels, produce a seat forecast or add a synthetic average as a shortcut to a richer chart.

**Proof:** `polling-entry`, `ElectionPolling`, `pollingLab` and publisher parser tests. Reconcile historical and current results to original tables for both publishers, including a same-day publication and a corrected poll. Inspect the populated chart for duplicate ticks and hidden points.

**Done when:** At least two primary pollster streams and a verified historical sequence are usable in the lab. A second logo or an unverified scraped historical dataset does not count.

### Task 13 — Make public-money dossiers accurate and investigative (priority 8)

**Files:** `worker/government-contracts-cloudflare.js`, procurement contracts, `app/lib/publicMoney.ts`, `app/components/PublicMoneyExplorer.tsx`, `app/money/page.tsx`; dossier routes only if stable links need them.

- [ ] Preserve publisher notice/award/entity identifiers, publication dates, currencies, amendment links and procurement stages. Separate notices from awards, award value from spending, and cancellations/corrections from new money.
- [ ] Replace exact-name aggregation with publisher-provided legal/entity identifiers where available. Name-only matches remain explicitly provisional and must not assert that unrelated suppliers are one company.
- [ ] Define the retrieved universe, time window, pagination/completeness and exclusions before showing totals or rankings. A top-100 fetch is not a national market; show that limit or complete the bounded requested universe.
- [ ] Handle repeated notices, amended values, cancelled awards and multi-supplier awards without double-counting. Do not allocate a whole multi-supplier award to each supplier as if it were their attributed revenue.
- [ ] Build shareable buyer/supplier dossiers and useful search/filter views. Show source documents, awarded-value timelines, notice history and evidence-linked comparisons; avoid unsupported waste/fraud narratives or supplier identity claims.
- [ ] Export the exact filtered records with identifiers, coverage and currency notes. Preserve usable pagination and mobile tables.

**Proof:** `tests/unit/publicMoney.test.ts`, `tests/unit/PublicMoneyExplorer.test.tsx` and collector tests for identical names/different IDs, renamed same entity, amended/cancelled notice, multiple currencies and multiple suppliers. Reconcile a real dossier to its source notices and declared denominator.

**Done when:** Dossiers support useful investigation without misleading entity joins, double-counted money or national claims based on an incomplete sample.

### Task 14 — Make country comparisons explorable and comparable (priority 9)

**Files:** `worker/international-comparison.js`, `worker/international-comparison-publication.js`, `app/lib/countryComparison.ts`, `app/components/CountryComparisonFigures.tsx`, `app/components/InternationalComparison.tsx`, comparison contracts.

- [ ] Verify the seven existing measures against their primary publications, units, historical/estimate/projection status and country universe. Keep their refresh/readiness isolated from national publication.
- [ ] Add reader selection of meaningful peer groups and individual countries, with shareable state. Expand beyond the existing universe only where source coverage and intended comparison justify it.
- [ ] Offer common-year comparisons when available and a distinctly labeled latest-available mode otherwise. Never disguise mixed years as a single-year league table.
- [ ] Show included/excluded countries, reasons, missingness and the actual ranking denominator. Handle ties explicitly; do not silently rank missing values as zero.
- [ ] Provide readable bars/dots/tables, accessible labels and cited downloads. Explain each measure separately; no overall country score or ranking assembled from unrelated indicators.

**Proof:** Existing country/international source, publication, route and UI tests. Check common-year/no-common-year, missing country, equal values and projected observations; inspect one live populated comparison and export per measure.

**Done when:** Readers can choose peers and understand exactly what the comparison can and cannot support.

### Task 15 — Finish the public source, revision and archive ledger (priority 10)

**Files:** `app/components/RevisionLedger.tsx`, `app/sources/page.tsx`, `app/sources/[id]/page.tsx`, `app/editions/page.tsx`, `app/editions/[id]/page.tsx`, archive/summary contracts from Task 4.

- [ ] Give each source a useful public page: publisher, evidence class, linked measures, direct publication links, latest successful edition and intelligible availability. Keep queue keys, account details and private error logs out of it.
- [ ] Link every claim/chart to its source edition and any retained historical snapshot. Make archival dates distinct from source publication and observation dates.
- [ ] Show revisions as old value → new value for the same observation/definition, with source-backed explanation where available. Distinguish new periods, revised values, withdrawals and metadata-only changes.
- [ ] Make archive browsing and edition comparison discoverable from briefings and measure pages. Preserve honest gaps when a prior version was not retained; do not reconstruct a fictional past.
- [ ] Publish the retention policy and usable unavailable/expired-edition states. Corrected source links and withdrawn evidence retain appropriate historical explanation without treating old values as current.

**Proof:** Source → measure → edition → revision → original-publication journey in the browser and without JavaScript; archival identity and diff tests; real public list/detail traversal from Task 4 after deployment.

**Done when:** A reader can trace and reproduce a published figure and understand changes to it across retained editions.

### Task 16 — Verify the whole product, release and report remaining limitations honestly

**Files:** Existing unit/Worker suites, affected `tests/e2e/` journeys, `scripts/release-smoke.mjs`, production verification utilities and operations runbooks. Add a focused `tests/e2e/publication-round-two.spec.ts` only if existing journeys cannot reasonably hold this coverage.

- [ ] Use deterministic test-only fixtures for populated, sparse, degraded and unavailable states. Inject the same contract into server and client tests; never ship invented fixture values as production fallback data.
- [ ] Walk all ten acceptance journeys in section 1. Check desktop/mobile, keyboard, reduced motion, no-JavaScript/initial HTML, client revalidation, URL sharing and actual downloads. Verify that freshness changes do not leave a stale headline beside an updated chart.
- [ ] Run affected tests during each task; run the full required lint/test/build checks for the release candidate. Build OpenNext when deployment behavior changes and the static seed when its path changes. Browser and exhaustive diagnostics remain explicit release/change checks, not compulsory work on every Markdown edit.
- [ ] Measure the current deployment's bundle/runtime/CPU/subrequest/KV/Queue/storage use and source cadence. Compare suitable hosting/runtime options on reader performance, reliability, operational burden, and current published pricing. Cloudflare remains the default only if it best meets the evidence; do not commit paid spend until the user approves a concrete cost.
- [ ] Review backwards compatibility of old URLs, browser-local saved state, archived schemas and prepared artifacts. Use additive readers/migrations where needed; deploy compatible code/data changes in an order that preserves live reads.
- [ ] Release through the lean workflow, verify exact deployed revision and the affected public journeys, and prove collection recovery separately. Preserve a recoverable prior Worker/artifact; rehearse rollback in a safe environment without overwriting good live evidence.
- [ ] Report each capability as locally verified, production verified, or blocked by a named source/dependency. Resolve or update related existing issues based on proof; derive PR/deployment state live rather than adding a permanent status snapshot to Markdown.

**Done when:** All ten outcomes have the stated acceptance evidence on the deployed revision. Any external-source blocker is explicit and its feature remains incomplete; neither green CI nor an attractive empty layout earns a false ten-out-of-ten claim.

## 6. Verification commands and practical checkpoints

Use the pinned Node/npm toolchain already declared by the repository. Install only when dependencies or the environment require it. For a changed task, start with its named tests, for example:

```powershell
npx vitest run tests/worker/measure-catalog.test.ts tests/unit/measureCatalog.test.ts
npx vitest run tests/worker/edition-archive.test.ts tests/worker/edition-summary.test.ts
npx vitest run tests/unit/comparisonWorkspace.test.ts tests/unit/chartExport.test.ts
npx vitest run tests/unit/deploy-degraded-release.test.ts tests/unit/release-smoke.test.ts
```

For a code release candidate, use the actual repository commands:

```powershell
npm run lint
npm test
npm run build:prepare
npm run build
```

Run the existing OpenNext/deployment and static-export commands from their checked-in workflows when those modes are affected. Run selected Playwright journeys using the repository's configured server/fixtures; do not guess that every fixture-injection method covers SSR. `npm run test:release -- https://public-data.org/ <deployed-sha>` verifies the release contract, not all ten feature outcomes. Follow it with the affected live journeys. Never substitute a local screenshot for a live-data claim.

Five failure classes receive explicit ownership: sparse chart geometry (Task 5), source-shape/catalog mismatch (Task 3), expired evidence during revalidation (Tasks 2/16), incomplete archive writes/routing (Task 4), and incompatible denominators/entity joins (Tasks 13/14). These are behavioral checks, not reasons to add general review ceremonies.

## 7. Complete tracked Markdown steering inventory and disposition

The repository has 42 tracked Markdown files, including this plan. This list distinguishes active guidance from historical evidence; it does not make every old audit an active requirement. Re-scan at execution for newly added files and instruction overrides. The repository has one tracked `AGENTS.md`; no nested agent guide was found outside excluded dependency/build directories.

| File | Relevant influence | Round-two disposition |
| --- | --- | --- |
| `docs/superpowers/plans/2026-10-02-publication-reinvention-round-2.md` | Current step order, acceptance evidence and verified progress. | Active execution reference for round two; retire as current guidance when this work is complete. It sets no arbitrary scope ceiling. |
| `.agents/skills/cave-pony/SKILL.md` | Previously imposed build-footprint minimization as well as concise communication. | Updated: response-token economy only. It cannot limit implementation scope, design, architecture, or meaningful verification. |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Bug-report structure. | Keep useful reproduction fields; no mandatory workflow from template prose. |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Feature-request structure. | Keep concise; user priorities govern this work. |
| `.github/pull_request_template.md` | Exact-SHA/Actions and formatting prescriptions beyond the actual body check. | Simplify to problem, change, validation and material limitations. |
| `AGENTS.md` | Active mission, source/security/accessibility rules, architecture and delivery instructions. | Keep concise; update scope and current workflow; architecture is descriptive and revisable. |
| `README.md` | Onboarding and commands. | Match the actual product and release path; link authoritative docs. |
| `design-plans/improve-contrast-national-debt.md` | Historical contrast plan and restrained styling assumptions. | Historical; retain accessible contrast findings, retire palette vetoes. |
| `design-plans/improve-contrast-sentiment-pulse.md` | Historical contrast plan and styling assumptions. | Same treatment; no independent design authority. |
| `design-plans/improve-ui-report.md` | Older UI/palette recommendations. | Historical research; reuse supported findings only. |
| `design-plans/ux-and-data-feeds-deep-dive-2026-08-01.md` | Dated UX/source audit. | Historical input, not current availability proof or execution order. |
| `docs/architecture/decisions/0001-cloudflare-first-data-plane.md` | Superseded early routes/publication design. | Preserve decision history and clear supersession; obsolete route counts are not guards. |
| `docs/architecture/decisions/0002-publication-reinvention.md` | Current publication contracts, route manifest, archive defaults, and a previous Free-only requirement. | Keep/update evidence and contracts; remove the provider lock and mark the old platform decision superseded. |
| `docs/architecture/source-contract-schema.md` | Evidence schema and normalization rules. | Keep aligned with executable contracts; extend for real new source grains. |
| `docs/architecture/trusted-government-lens.md` | Provenance, evidence classes and older product framing. | Keep evidence distinctions; remove obsolete presentation limits as active rules. |
| `docs/cloudflare-worker-backend.md` | Runtime/hosting operational guidance. | Reconcile with actual Workers, importer ownership and recovery path. |
| `docs/evidence-audit/betting-markets-2026-07-14.md` | Market-source boundaries and dated evidence. | Keep source rationale; reverify current access; no forecast implication. |
| `docs/evidence-audit/core-editorial-contract-2026-07-15.md` | Claim/provenance expectations. | Keep substantive truth requirements; avoid duplicated operational rules. |
| `docs/evidence-audit/derived-regional-evidence-2026-07-14.md` | Regional derivation/comparability risks. | Keep rationale; verified new geography can supersede withdrawal decisions. |
| `docs/evidence-audit/economy-2026-07-14.md` | Economic source definitions and historical gaps. | Historical source evidence; current tests/contracts determine behavior. |
| `docs/evidence-audit/election-polling-2026-07-14.md` | Polling source/method restrictions and historic coverage. | Keep methodology; add verified publishers without treating old one-publisher coverage as a cap. |
| `docs/evidence-audit/international-comparison-2026-08-19.md` | Comparison source years, universes and caveats. | Keep rationale; reverify observations and permit justified universe expansion. |
| `docs/evidence-audit/migration-2026-07-14.md` | Migration definitions/revisions. | Keep primary evidence and caveats; dated status is historical. |
| `docs/evidence-audit/national-debt-2026-07-14.md` | Fiscal stocks/flows and source basis. | Keep; align catalog fields to actual normalized contract. |
| `docs/evidence-audit/nhs-rtt-2026-07-14.md` | RTT pathways, missing trusts and source requirements. | Keep statistical reconciliation; update access assumptions from observed importer behavior. |
| `docs/evidence-audit/series-level-provenance-2026-07-15.md` | Per-series provenance and clocks. | Keep; enforce in catalog adapters rather than duplicative prose tests. |
| `docs/evidence-audit/source-and-runtime-feasibility.md` | Dated network, workflow and quota assumptions. | Reverify; correct stale importer path and access claims; measure current capacity. |
| `docs/evidence-audit/withdrawn-static-sections-2026-07-14.md` | Reasons old evidence was withdrawn. | Preserve rationale; restoration requires new verified evidence, not a permanent feature ban. |
| `docs/hardening-ledger.md` | Old ten-agent pass and outdated deployment description. | Historical audit; retire persona/process authority and false current-state wording. |
| `docs/manual-rollout-checklist.md` | Release/recovery steps. | Rewrite around lean code release and explicit source/Pages recovery. |
| `docs/metric-integrity-audit-2026-07-11.md` | Dated measure integrity findings. | Historical evidence; avoid treating all old findings as still open or automatically solved. |
| `docs/navigation-market-research.md` | Navigation research/recommendations. | Useful design input, not fixed menu/route constraints. |
| `docs/operations/deployment-ci-frugality.md` | Runner/resource guidance and current duplicated work. | Update with Task 1's simpler workflow and measured results; no new arbitrary caps. |
| `docs/operations/free-resource-budget.md` | Cloudflare workload model written under a Free-only assumption. | Keep measured workload as a baseline; remove Free-only language and compare provider limits/costs against real needs. |
| `docs/source-repair-backlog.md` | Source priorities plus prose evidence requirements. | Remove CI dependency; consolidate active priority ownership here; preserve useful source facts. |
| `docs/superpowers/plans/2026-09-09-data-reliability-repair.md` | Historical execution sequence/rituals. | Superseded execution; retain technical history only. |
| `docs/superpowers/plans/2026-10-01-publication-reinvention.md` | Round-one tasks and mandatory skill/review sequencing. | Superseded by this sequence when executed; no inherited ceremony or completion claims. |
| `docs/superpowers/specs/2026-08-18-data-resurrection-international-comparisons-design.md` | Old source restoration/comparison architecture. | Historical design; source truth remains, outdated architecture can change. |
| `docs/superpowers/specs/2026-09-09-data-reliability-repair-design.md` | Old reliability design and requirements. | Preserve applicable invariants; label superseded implementation choices. |
| `docs/superpowers/specs/2026-10-01-publication-reinvention-design.md` | Ten-feature round-one vision and bounded defaults. | Baseline history; this plan develops the ten priorities without treating old defaults as ceilings. |
| `docs/superpowers/specs/2026-10-01-publication-reinvention-review.md` | Round-one review and decisions. | Historical rationale; not proof of current production completion. |
| `docs/test-suite-audit-cave-pony-2026.md` | Test deletion/retention advice, partly stale. | Reconcile contradictory references to deleted prose tests; retain behavioral coverage guidance. |

Also inspect executable steering outside Markdown: the workflows; `scripts/check-static-architecture.mjs`, `scripts/check-source-ownership.mjs`, text/lockfile/PR/lane checks; `contracts/public-surfaces.json`, `contracts/measure-coverage.json`, `docs/architecture/source-ownership.json`; Next/OpenNext/Wrangler configs; lockfiles; GitHub branch rules and environment settings. Remove feature-size and provider vetoes. Keep source, privacy, security, accessibility, single-canonical-host and public-contract checks.

## 8. Execution handoff

Execute in this order:

1. Finish Task 0: remove scope/build-budget language from repository guidance; mark old vision and Free-only decisions historical; delete the hard-coded provider ban. Keep canonical-domain release smoke and checks for whichever runtime is selected.
2. Finish Task 1: retain the single required quality result, profile its actual critical path, and overlap independent lint/tests/build work only when a measured run proves faster without dropping checks. Run focused tests during implementation and full CI only at coherent integration/release points, not per checkbox.
3. Complete Tasks 2–3: fetch the live catalog, repair source mappings and the ticker, explain every omitted measure, and diagnose the public-data bootstrap failure. Recheck source status when implementing; do not block visual/product work on a missing publisher.
4. Deliver priority 1 through Tasks 5–6: finish the in-progress homepage work, establish the visual system on home/polling/measure/comparison pages, then carry it across every active route with populated, sparse, degraded and unavailable states.
5. Complete Task 4's archive foundation, then priorities 2–3 (Tasks 7–8), priorities 4–6 (Tasks 9–11), and priorities 7–10 (Tasks 12–15). Keep source adapters independent so a blocked publisher does not stall other features.
6. Run Task 16 against all ten acceptance journeys, finalize the platform choice from Task 1's evidence and approved costs, merge through the required quality gate, deploy, and verify exact-head live journeys and source recovery separately.

Commit coherent local increments. Avoid CI runs, PRs, or repetitive process per checklist item. Do not claim a feature complete until its acceptance evidence is observed on the deployed reader journey.

At each increment report: what readers can now do, proof actually obtained, remaining source dependencies and the next task. Do not add recurring status documents, additional approval gates or a new standing agent programme. The final result must be demonstrably useful with populated evidence and honestly incomplete wherever an external source remains unverified.
