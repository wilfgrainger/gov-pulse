# Publication reinvention, round two: executable implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking. Keep the user's ten priorities in order; use this plan as the current execution reference.

**Goal:** Complete the ten user priorities as a distinctive, useful, populated public-evidence publication, with each claim and capability verified at the reader-facing journey.

**Architecture:** Keep the current request-time web app and isolated evidence publication path while they serve the product. Change hosting, routes, storage, contracts or ingestion when measured reader needs or verified source constraints justify it; update the public/private boundary and deployment together.

**Tech Stack:** Next.js, React, TypeScript, Cloudflare Workers/OpenNext, Workers KV/Queues, Vitest and the existing browser tooling. These identify the current codebase, not a permanent framework or provider ceiling.

**Spec:** `docs/superpowers/specs/2026-10-01-publication-reinvention-design.md`, the user's ten priorities, and the current repository contracts. This round-two plan supersedes round-one execution order and bounded defaults.

## Global Constraints

- Every public claim identifies the measured subject, observation period, geography, unit, publication date, primary source and material uncertainty.
- Missing, stale, incomplete, ambiguous or unreconciled values stay unavailable; never substitute zero, interpolation, forecast or synthetic replacement.
- Keep official statistics, administrative data, polling and market signals separate. Never publish a synthetic crime total, overall national score, or unsupported claim of waste, fraud or corruption.
- Preserve semantic HTML, keyboard access, visible focus, readable contrast, text alternatives, mobile reflow and reduced-motion behavior.
- Treat downloaded source content as untrusted. Use approved HTTPS publishers, bounded retrieval, strict parsing, reconciliation, generic public errors and private operational diagnostics.
- Keep secrets, personal data and paid spend behind the user's explicit authorization. Existing hosting and route architecture may change when the complete product requires it.
- No line-count, file-count, route-count, feature-count, design-style or arbitrary validation ceiling may reduce the requested outcome. Validation remains proportional to changed behavior and release risk.

## Review Focus

- A blocked or changed publisher must lead to an explicit unavailable/degraded value, never a parser-shaped zero (Task 2; collector challenge/shape tests).
- Headline, history, publication clock and per-measure freshness must reconcile before a catalog value is shown (Task 3; source/catalog tests).
- Sparse, irregular, revised and null chart points must preserve their true geometry and gaps in both plot and export (Task 5; chart model/export tests).
- A listed historical edition must be immutable and retrievable, while an interrupted write cannot advertise missing content (Task 4; archive publication tests).
- Mixed units, years, entities or country universes must not imply a valid ranking or overlay; missingness and denominator remain visible (Tasks 8, 13 and 14; comparison/dossier tests).

---

**Handoff policy:** Checkboxes record completed local proof. Branch, PR, CI and deployment state are live facts: query GitHub and the public endpoints immediately before integration and again after release. Do not use this plan as a current-state snapshot. Production completion is earned only through the reader-facing acceptance matrix below.

**Goal in priority order:** Deliver the ten reader outcomes below. Repair the foundation where necessary, but do not make one blocked publisher a reason to defer independent design or product work.

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

### Ten-priority acceptance matrix

| Priority and route | Primary evidence | Local proof already in this branch | Populated browser and production proof still required |
| --- | --- | --- | --- |
| 1. Redesign — `/`, `/section/[id]` | Request-time national publication assembled from the active registry; each topic retains its own source class. | `PageHeader`, `visualSystem`, chart/export, section-content and national-snapshot tests. | At 320/390/768/1440px follow homepage → populated topic; verify readable lead, no overflow, keyboard/focus, reduced motion, no-JS initial content, and same-edition chart/download metadata on the deployed SHA. |
| 2. Measure atlas — `/measure/`, `/measure/[id]` | Official publisher editions in `worker/feed-registry.js`, normalized through the measure catalog. | `MeasureLibrary`, `measureAvailability`, `measure-catalog`, `house-price-index`, and source ownership tests. | Search/filter a current and unavailable entry; open a deep link and source citation; reload/back through query state; reconcile value, period, unit, history and downloads to the live publication. |
| 3. Comparison studio — `/compare/` | Compatible records from the national measure catalog; dissimilar bases stay in separate panels. | `ComparisonStudio`, `comparisonWorkspace`, chart-model/export, saved-workspace and URL tests. | Load compatible/incompatible measures; verify shared link, browser history, local save/import/export and exact CSV/JSON dates, units, missingness and sources on the deployed current snapshot. |
| 4. Briefing, stories, RSS — `/briefing/`, `/stories/[slug]`, `/feed.xml`, `/editions/[id]` | Dated verified national editions, source revisions and authored evidence-linked stories. | `briefing`, `rssFeed`, `edition-summary`, `edition-archive`, and story-evidence tests. | Open the dated briefing, follow a cited story and RSS item, compare one retained revision with both publications/editions; verify stable IDs and dates after deployment. |
| 5. Calendar/watchlist — `/calendar/` | ONS and NHS official release pages/schedules; unknown dates remain unknown. | `ReleaseCalendar`, `releaseCalendar`, ONS/NHS release collector, `WatchlistBoard` and `watchlist` tests. | Follow a confirmed release, save/restore a measure locally, verify “changed since visit”, unknown dates, and an imported calendar file against source dates after deployment. |
| 6. Cost of living — `/cost-of-living/` | ONS Private rent and house prices bulletin (PIPR/UK HPI), CPI, pay and Bank Rate publishers. | `CostOfLivingLens`, `house-price-index`, catalog and measure-availability tests. | Follow actual rent level/change beside compatible price/pay/rate evidence; verify periods/geography/source notes and matching exports; confirm no synthetic household bill or combined total. |
| 7. Polling lab — `/section/election-polls/` | YouGov article/results PDF and More in Common published workbook streams; Ipsos correction notice is a separate historic record. | `ElectionPolling`, `PollingPublicationChart`, `pollingLab`, YouGov and More in Common collector tests. | Filter real dated pollsters/parties/fieldwork, inspect a correction separately, and reconcile individual rows plus CSV/JSON to primary tables; confirm no synthetic average. |
| 8. Public-money dossiers — `/money/`, `/section/government-contracts/`, source notice/history | Find a Tender OCDS award notices and source pagination, with publisher IDs and amendment/cancellation records. | `PublicMoneyExplorer`, `GovernmentContracts`, contract publication/history, chart and source-contract tests. | Follow one award notice through amendments/cancellation into buyer/supplier views; reconcile the displayed/exported subset and declared complete seven-day universe, GBP basis and exclusions. |
| 9. Country comparisons — `/section/uk-in-context/`, `/data/international-comparison.json` | IMF WEO; OECD tax/SOCX; SIPRI; WHO/World Bank health series. | country-comparison/UI, international source/contract/publication/route and export tests. | Use the refreshed 13-country publication for debt, defence years and latest-only measures; test mixed years, peer/status filters, exclusions, denominators, ties and identical CSV/JSON state. |
| 10. Source/revision/archive — `/sources/[id]`, `/editions/`, `/editions/[id]`, `/data/editions.json`, `/data/edition.json` | Registry-owned primary publisher editions and immutable run-scoped archive records. | `RevisionLedger`, server archive, `edition-summary` and archive list/detail contract tests. | Trace a live source → measure → revision → both retained editions → primary notice; verify production list/detail response, immutable IDs, dates, methods and material missingness. |

For every row, run the populated state and representative sparse, degraded and unavailable states using test-only publication contracts. Never deploy the synthetic test values as fallback evidence. A deployment check is complete only when the application revision and the edition/source response used by the journey are both identified.

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

A ready national health response does not prove every optional source or product tool is complete. NHS is required by the national contract. Its current trusted runner receives an NHS England AWS WAF challenge, so a current publication without NHS must be degraded until a permitted automated importer is available. Do not relabel the source optional to keep health green.

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

### What the inspected steering and CI actually constrain

- The repository has one active root `AGENTS.md`; no nested agent guide or generated Next agent rules. The `.agents/skills/cave-pony/SKILL.md` only governs response length. The root guide treats architecture as changeable and sets no file, line, route, measure or feature count.
- The 42 tracked Markdown files include dated research, old specs and plans. The root guide, response-only Cave Pony skill and this current plan are the active task steering. Older vision/review files are retained as history and cannot override the user's priorities.
- PR validation has a three-minute documentation-only lane and one required code-quality result. Code changes run route/source ownership checks, install each locked toolchain once, run the toolchain check, lint and the full test suite, then build the deployable OpenNext artifact once. Lint, tests and build overlap; Lighthouse is opt-in. The full-quality job's 20-minute timeout is a hang guard, not a product-size rule.
- The required `quality` status and `main` PR protection are the only merge gate recorded by the last settings audit. No changed-file, changed-line, complexity, framework, route-count or feature-count veto was found. New routes and source families can be added with their contracts and meaningful tests.
- Preserve the evidence, privacy, security, accessibility and public/private boundary checks: they constrain false or unsafe claims, not product ambition. If one blocks a valid design, update the implementation and its tests rather than weaken evidence.

## 4. Delivery sequence and dependencies

| Increment | Tasks | Result that can be reviewed and released |
| --- | --- | --- |
| A. Remove scope gates and repair the delivery lane | 0–1 plus the retired NHS shortcut in 2 | Keep meaningful quality checks, build the deployable artifact, remove prose and host vetoes, and remove the scheduled direct-to-KV ingest path. |
| B. Repair evidence and chart foundations | 2–5 | Make currentness fail closed, normalize source-owned measures, preserve retrievable editions, and make real-data charts/exports reliable. |
| C. Deliver priorities 1–3 | 6–8 | Apply the visual redesign, full supported measure atlas, and shareable comparison studio. |
| D. Deliver priorities 4–6 | 9–11 | Add dated briefings/stories/RSS, release calendar/watchlist, and cost-of-living with verified rent evidence. |
| E. Deliver priorities 7–10 and verify release | 12–16 | Complete polling, public-money dossiers, country comparisons and source/revision/archive journeys, then verify all ten on the deployed revision. |

Task 0 and Task 1 can complete independently of publisher availability. Visual work starts immediately and does not wait for source recovery; Tasks 3 and 5 supply truthful populated states. Task 4 feeds Tasks 9 and 15. Source recovery in Task 2 continues only where a concrete next diagnostic exists; blocked NHS access must not freeze other capabilities. The five PR increments are coherent review/release points, not one-PR-per-feature rules.

### Execution procedure for every unchecked task

1. Read the task's named files and existing tests; check the current source or rendered state before changing assumptions.
2. For behavior changes, add or sharpen the smallest failing test for the named gap and run that test once to see the failure.
3. Implement the complete reader outcome at the owning contract/component boundary. Do not add a workaround that creates guessed data, false compatibility or private-route exposure.
4. Run the task's focused tests from its **Proof** line. For source-owned data, reconcile against the primary publication; for UI/export tasks, inspect the populated browser journey and compare the download with the selected observations.
5. Review the diff and `git diff --check`; mark a checkbox only when its stated evidence exists. Run the shared integration suite at coherent increments, not after every checkbox.
6. Move to the next task in priority order. An external-source blocker pauses only the dependent evidence claim; continue independent design and feature work.

## 5. Executable tasks

### Task 0 — Remove conflicting steering and prose gates

**Files:** `AGENTS.md`, `.agents/skills/cave-pony/SKILL.md`, `README.md`, `next.config.ts`, `.github/pull_request_template.md`, `.github/workflows/pr-validation.yml`, `scripts/check-source-repair-backlog.mjs`, `scripts/lib/pr-description-policy.mjs`, `scripts/check-hosting-boundary.mjs`, `docs/architecture/decisions/0002-publication-reinvention.md`, `docs/operations/deployment-ci-frugality.md`, `docs/operations/free-resource-budget.md`, and the Markdown inventory in section 7.

- [x] Make `AGENTS.md` a concise active guide: mission, source/claim rules, architecture ownership, practical validation and the user's authorised scope. Link this plan as the execution reference; remove contradictory current-authority references.
- [x] Mark old specifications, audits and plans as historical where needed; retain source evidence and useful decisions. Remove obsolete workflow/persona requirements and duplicate current-status instructions. Avoid rewriting research solely for cosmetic consistency.
- [x] Remove the source-backlog prose check from CI and delete its script if no callers remain. Remove unused PR-body parser helpers only after checking imports. A short substantive PR explanation remains useful; prescribed headings/path punctuation and exact-SHA prose do not become gates.
- [x] Set the installed Next configuration's supported `agentRules: false` option. Start and stop the dev server once and verify the root guide is unchanged; its SHA-256 remained `7925016A…5E5ABA`.
- [x] Make repository Cave Pony response-token-only and state in `AGENTS.md` that simplicity cannot reduce requested scope, ambition, architecture choices, or useful verification.
- [x] Remove Cloudflare-Free-only and GitHub-Pages-prohibited instructions from active prose. Treat Cloudflare as the current host, not a permanent choice. Remove the redundant provider-ban script; public release checks retain canonical-domain/revision verification, with runtime checks owned by the selected deployment. Mark prior Free-only vision documents superseded.
- [x] Remove the universal changed-text encoding/newline gate, its package command and script. Git handles line-ending normalization; documentation-only changes need no dependency install, and prose content is not a code-quality proxy.
- [x] Update the release/runbook documents alongside Task 1 so docs describe the resulting executable pipeline. Do not create a second governance framework.

**Proof:** `git diff --check`, `npx vitest run tests/unit/publicationProgramme.test.ts`, the changed-lane tests and a repository search for removed gate references. Confirm a normal developer command no longer rewrites agent guidance.

**Done when:** No active repository Markdown, generated agent rules, vision file, or executable host/code gate limits authorized product scope or locks the platform by default. Evidence, privacy, security, accessibility and spend approval remain explicit protections.

### Task 1 — Make CI and deployment fast, trustworthy and independent of source recovery

**Files:** `.github/workflows/pr-validation.yml`, `.github/workflows/deploy.yml`, `scripts/lib/pr-validation-lane.mjs`, `scripts/check-static-architecture.mjs`, `scripts/release-smoke.mjs`, `scripts/bootstrap-cloudflare-publication.mjs`, `docs/operations/deployment-ci-frugality.md`, `docs/manual-rollout-checklist.md`; existing release/bootstrap tests.

- [x] Keep the cheap docs lane for actual documentation. Route `docs/architecture/source-ownership.json`, executable files under `.agents/`, workflow changes and relevant config changes through their meaningful checks. Add classifier cases for these paths and a genuine Markdown-only change.
- [x] Remove routine Lighthouse's second installation/build. Retain an explicit diagnostic path for performance changes and release investigation; use an existing artifact only if this remains simpler than one manual diagnostic run.
- [x] Keep one required quality result aggregating source/security boundary guards, lint, unit/Worker tests and one production OpenNext build (which compiles the Next application once). Remove prose gates and misleading lockfile-step wording. Do not replace the full suite with an unproved changed-test heuristic.
- [x] Replace architecture vetoes with source/public-contract checks: active feeds remain mapped to working collector, normalizer and entrypoint implementations; multiple implementation owners and runtime migrations are allowed; public data routes continue to be explicitly declared, and collector internals stay private. Application APIs are not rejected by location alone.
- [x] Stop forcing fresh collection on normal push deployments. Keep explicit `refresh_evidence` recovery and Pages-seed recovery. Run bounded revision, route and health-contract verification after code deployment; accept a valid degraded publication but fail broken routes or malformed contracts.
- [x] Separate recovery outcome from code-release outcome so an upstream failure remains visible without skipping reader smoke checks. Cover complete, degraded, unavailable-with-valid-contract, malformed response, wrong revision and missing route cases. Define precisely which unavailable responses are supported; do not turn every error green. In forced refresh, inspect the active run before replacing its ID with a scheduled retry; a finalised run at the retry boundary must not be lost.
- [x] Avoid repeating full release lint/tests only when validation can be tied to the actual release tree, relevant base and workflow. Preserve fallback validation for direct main pushes or missing proof. Build the actual OpenNext artifact in PR quality; compile it once per deployment.
- [x] Verify effective main branch targeting, required check and workflow permissions: `main` is protected by PR + `quality`, deletion and force-push prevention remain, no approval count is required, and workflows use read-only repository permissions.
- [x] Remove the deployment's hard-coded 24-hour Queue retention update. New Queues use the account's default and existing retention settings remain intact; Free-plan retention no longer acts as a repository policy.
- [x] Compare runner minutes and critical-path duration using equivalent before/after runs: aggregate job runtime fell from 235s to 122s (48.1% less); wall time stayed 135s. The latest full-quality job took 114s, with 51s in unit/Worker tests, 16s in build, and 13s in lint.
- [x] Reduce remaining feedback delay without reducing proof: after the root and locked OpenNext dependency installs and `build:prepare`, overlap lint, unit/Worker tests and the single OpenNext application build; preserve every exit code and log. The measured PR run completed in 118s overall with a 100s full-quality job, versus the recorded 135s overall / 114s full-quality comparison. The lane installs each lockfile once and builds the deployable application artifact once.
- [x] Evaluate Cloudflare and suitable alternatives early against request-time rendering, source access, ingestion, durable history, reliability, operational work and current official pricing. Provisional recommendation (2 October 2026): keep Cloudflare as the current implementation because its Workers/KV/Queues/cron stack already serves both request-time rendering and the isolated collection/publication plane; this avoids a high-risk full migration before measured workload shows a reader benefit. This is not a provider lock: AWS Lambda + CloudFront + DynamoDB + SQS remains a credible full-stack alternative with per-service regional pricing and more operational/IAM surfaces; Vercel Pro is the strongest direct Next.js host but would still need a separate durable source-ingestion/data plane. Cloudflare Workers Paid is $5/month minimum, including 10M Worker requests and 30M CPU-ms monthly; KV includes 10M reads, 1M writes and 1GB stored, while Queues includes 1M operations. Workers Free still has a 10ms per-invocation CPU allowance, so test actual SSR/collector CPU before choosing it for the finished product. The current code-derived Queue target is about 90 operations/day, far below the paid allowance, but public dynamic-request volume, KV traffic/storage and CPU are not yet measured; therefore $5/month is a concrete platform floor, not a defensible total bill or spend approval. Vercel Pro is $20/month with $20 usage credit and one deploying seat. AWS publishes Lambda at $0.20/million requests plus compute and a 1M-request/400,000-GB-s monthly free allowance; SQS and DynamoDB are separately metered. Final usage estimate and any paid-plan decision remain in Task 16. Sources: [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/), [AWS Lambda pricing](https://aws.amazon.com/lambda/pricing/), [AWS SQS pricing](https://aws.amazon.com/sqs/pricing/), [AWS DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/), [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan).

**Proof:** `tests/unit/source-ownership.test.ts` proves multiple owners and changed deployment contracts do not trigger a dated veto, while missing implementation paths still fail. `tests/unit/prValidationLane.test.ts`, release/bootstrap tests and the existing production workflow verify meaningful routing and release behavior. Run focused tests, lint and affected builds; keep live deployment proofs in Task 16.

**Workflow audit (2026-10-03):** `pr-validation.yml` gives actual Markdown-only changes a no-install lane; executable/config/workflow changes take the full source/route guards, install the root and locked OpenNext toolchains once each, run the complete lint/test suite, and build the deployable OpenNext artifact once (compiling Next within that build). Its 20-minute job timeout is an execution bound, not a feature or architecture ceiling. `deploy.yml` releases only from protected `main`, checks the deployed revision/routes, and keeps evidence refresh and Pages seed refresh manual. `lighthouse.yml` is dispatch-only. The separate scheduled NHS direct-KV shortcut was removed under Task 2 after its only observed run failed at the source WAF and its write bypassed the Queue finalizer. Query current PR and workflow status live at handoff; do not preserve a dated snapshot here.

**Done when:** Code feedback has no scope/size heuristic, prose gate, redundant build, provider veto or forced source-refresh wait. The complete quality result remains fast and evidence-based; the selected production host and reader routes are verified once per meaningful release.

### Task 2 — Establish source diagnostics and recover the actual failing paths

**Files:** `worker/feed-registry.js`, source collectors, `worker/nhs-rtt-source-discovery.js`, `worker/live-nhs-publication-collector.js`, existing publication diagnostics and source tests.

- [x] Trace all 12 active feed sections from registry/upstream through their generic or specialized collector, section validation/provenance, Queue fragment, currentness filter, finalizer and public topic component. The live route/section mapping is contract-tested; source-specific errors stay in private Queue diagnostics/logs while public diagnostics use the approved generic reason codes.
- [x] Reproduce current polling and NHS failures with bounded retrieval. Treat access-challenge HTML as an upstream access failure, not empty statistical data or a legitimate annual page. NHS challenge markup now has a distinct private error category.
- [x] Reproduce the explicit-recovery race: a refresh job reported failure, then a ready 19-record publication was observed. Trace cache headers, prepared-artifact visibility, health/readiness polling and the deadline before changing retry or timeout values. The retry boundary replaced the ID for a run that had just finalised; a focused test now proves the completed first attempt is accepted before a retry is sent.
- [x] For NHS, verify permitted direct official download/discovery endpoints and reconcile the press notice, workbook headline, missing trusts and historical series. Use an approved retrieval method if required; do not bypass access controls or invent data. If blocked, record the actual external dependency and continue independent tasks. Direct official collection succeeds in the current session for the July 2026 edition; the GitHub runner still receives NHS England's AWS WAF challenge, and no approved automated alternative has been verified. Keep NHS unavailable in production until a permitted route is confirmed.
- [x] Remove the scheduled GitHub direct-KV ingest shortcut after its 2 October runner attempt received AWS WAF challenge HTML. It is not a release gate and cannot publish through the Queue finalizer; retain Cloudflare Cron/Queue as the only automatic collection path and leave NHS honestly unavailable until that path is verified.
- [x] For polling, repair the existing publisher's newest-edition discovery and result-table reconciliation before adding more publishers in Task 12. The live article now parses its visible publication byline, current sample-size format and commissioner wording; collector output matches the linked results table.
- [x] Verify that a successfully ingested optional source reaches the prepared artifact and reader after finalisation; retry and replay remain bounded and idempotent. Required/optional classification changes need an explicit product rationale, not a desire for green status. Crime and polling were present in the production snapshot and reader routes at revision `5e87da45c664759a1f91d2cce4b06fe7686ed05c`; publication/finaliser replay behavior is covered by the passing focused suite.
- [x] Keep operational source health, public national readiness and product-feature completeness separate. A feature needs its own source-to-screen acceptance even when national health is ready. Registry and degraded-publication tests prove NHS is required, crime remains optional, and degraded health is not ready; the deployed readiness observed at the old revision must not be attributed to the updated local contract.

**Proof:** Source map recorded in the ignored execution ledger; `tests/unit/publicationProgramme.test.ts` confirms each active registry feed maps to a public topic. The focused source/publication suite passed 20 files / 133 tests; programme and metadata tests passed 2 files / 15 tests. All 12 public topic routes returned HTTP 200 at deployed revision `5e87da45c664759a1f91d2cce4b06fe7686ed05c`. Live source-to-screen checks confirmed YouGov polling and separate crime systems; NHS displays unavailable. Current snapshot generated `2026-10-02T18:14:58.489Z` contains ten sections, omits required `nhsStats`, and reports ready under the older deployed contract; do not attribute that readiness to this worktree.

**Done when:** Each current failure has a verified repair or a precise external blocker; successful ingestion is observed in the public product. A blocked source does not certify its feature complete.

### Task 3 — Populate the canonical evidence model and remove false live claims

**Files:** `worker/measure-catalog.js`, `contracts/measure-record.js`, `contracts/measure-record.d.ts`, `contracts/measure-coverage.json`, `contracts/public-surfaces.json`, `app/lib/measureDefinitions.ts`, `app/lib/measureCatalog.ts`, affected source normalisers, `app/components/visuals/BritishDatelineTicker.tsx`, `app/components/SectionNav.tsx`.

- [x] Delete the hard-coded ticker numbers and “100 Active Awards” claim immediately. Feed the ribbon verified current measures with period/source context, or render a useful nonnumeric publication status. Label procurement awards accurately.
- [x] Reconcile each existing catalog definition against real source-owned fields: GDP and employment editions, debt headline/history, receipts, per-series sentiment provenance and validity. Verify geography and statistical basis against the primary publication rather than copying a guessed label.
- [x] Preserve `MeasureRecord` identity, unit, geography, source edition, observation window, publication/retrieval clocks, validity, revision identity and explicit-null points. Define deterministic publication identity from verified publisher identifiers where a publisher supplies no explicit ID; never invent an observation or use retrieval time as publication time.
- [x] Use one authoritative measure-definition inventory. Derive UI options and coverage assertions from it instead of maintaining competing eight-item lists. Keep unsupported/unavailable definitions discoverable with an availability reason, separate from validated observations.
- [x] Add private diagnostics for catalog exclusions. Distinguish no source, invalid metadata, expired value, empty history and headline/history mismatch. Keep per-measure freshness when several measures share one section.
- [x] Expand adapters to supported economic, fiscal, housing, health, migration and separate crime measures. Preserve distinct record grains: poll publications, award notices and country observations must not be forced into a misleading generic scalar series.

**Interface:** Keep validated `MeasureRecord`/`MeasureCatalog` as the chart/export contract. Extend definition/availability metadata separately if an unavailable source cannot truthfully supply required observation metadata. Consumers must never infer zero from absence.

**Proof:** `tests/worker/measure-catalog.test.ts`, `tests/unit/measureCatalog.test.ts`, affected collector tests and a ticker regression test. Use representative actual source-shaped fixtures, not only idealised catalog objects. Reconcile live eligible measures against emitted records and display reasons for omissions.

**Round-two verification (2026-10-02):** The production snapshot generated at `2026-10-02T18:14:58.489Z` was passed through the updated local adapter. The 37-definition inventory has 37 unique IDs; 36 live records validate, with only `waitingPathwaysEstimate` unavailable because the production snapshot has no NHS section. All emitted source hosts match that section's registered primary publishers. Bank Rate is now a separate Bank of England record with 25 event-dated points and its own retrieval-based validity deadline. Sixteen crime records are now available across CSEW, police-recorded crime and court timeliness; each has one publication point and explicit wording that no comparable history is carried, so no trend is implied. ONS's latest crime bulletin identifies the source classes and the YE March 2026 figures, while the Bank of England database identifies IUDBEDR as Official Bank Rate. See [ONS crime publication](https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/yearendingmarch2026) and [Bank of England Bank Rate history](https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp).

The catalog now carries publisher and reader-note metadata, deterministic source-edition IDs from the approved source URL/publication date/observation period, and content-derived revision IDs. Private omission/freshness diagnostics are retained on the internal publication, removed from every public snapshot builder and rejected by deployment, canary and production verification. Measure coverage manifests reference the canonical JSON inventory instead of repeating measure-ID lists. Focused worker/UI/publication/privacy checks and TypeScript/lint passed; the exact command results are recorded in the execution ledger.

**Done when:** Every supported eligible live measure enters the catalog, every omission is explainable, no stale value is presented as current and no static numeric claim masquerades as live evidence.

### Task 4 — Make historical editions retrievable and stable

**Files:** `worker/edition-archive.js`, `worker/edition-summary.js`, `worker/public-data-entry.js`, `worker/wrangler.toml`, `contracts/public-surfaces.json`, `app/lib/serverEditionArchive.ts`, archive route tests and deployment verification.

- [x] Reproduce list-to-detail failure with the actual listed ID, capturing status, content type and serving Worker. Compare manifest, deployed route matching including query strings, Worker dispatch and KV content; identify the responsible boundary before changing routing.
- [x] Fix that boundary while preserving an explicit allow-listed public route and strict edition-ID/query validation. Reject unknown IDs consistently; never fall through to a misleading HTML success page.
- [x] Validate archive payloads at server consumption, including schema, matching IDs and historical status. Publish durable content before advertising it in the index; prove interrupted writes cannot create permanently dangling entries.
- [x] Keep editions immutable and retrieval-only refreshes from manufacturing new revisions. Test replay, concurrent finalisation, corrected observations and expired current evidence with valid historical reads.
- [x] Measure edition size and write/read frequency. Retain a rolling 60-edition default pending longer live traffic and storage measurement; this is a revisable retention policy, not a feature-size ceiling or a claim of indefinite history.

**Proof:** `tests/worker/edition-archive.test.ts`, `tests/worker/edition-summary.test.ts`, public-route tests, then public index → JSON detail → rendered edition → referenced source. Test one real ID, an unknown ID, malformed and duplicate parameters, and a missing stored record.

**Round-two verification (2026-10-02):** Four focused files passed (43 tests). Coverage includes immutable/idempotent replay, concurrent duplicate finalisation through the serialized Queue writer, corrections as revisions, current-to-historical expiry, strict IDs/query parameters, content-before-index recovery after an interrupted write, and omission of a listing whose content is missing. The server archive reader validates schema, IDs, summary/source references and historical status before rendering. The live list returned two IDs; both detail URLs returned JSON 200 with matching archive/catalog IDs and historical status, and the rendered `/editions/catalog-cdaff3b92b3c2ac0` page returned HTML 200. Live detail sizes were 281,446 and 18,162 UTF-8 bytes; the list was 6,015 bytes. The updated local adapter produced a 347,998-byte catalog for 36 validated records. The endpoint currently retains two editions dated 15 and 22 September; two observations are not enough to promise a fixed history duration, so the explicit rolling-count policy remains 60 while Task 16 measures sustained cadence, list traffic and total namespace storage. With current list integrity checks, a cache miss reads one index plus two keys per listed edition (5 reads at the live count; 121 at the configured maximum); an edition detail reads two keys. A new archived edition writes content, summary and index before at most two retention deletes (up to 8 operations); a duplicate finalisation reads summary and index (2 operations). Public list caching is 60 seconds and immutable detail caching is one year. No traffic rate or whole-namespace usage is available from this session.

**Done when:** Every retained listed edition can be read through its advertised public path and the displayed historical values remain stable across new releases.

### Task 5 — Make chart rendering and export reliable with real data shapes

**Files:** `app/lib/chartModel.ts`, `app/lib/chartExport.ts`, `app/components/charts/EvidenceFigure.tsx`, `app/components/charts/ObservationTable.tsx`, `app/components/FinancialTimeSeriesChart.tsx`, `app/components/PollingPublicationChart.tsx`, `app/components/ComparisonStudio.tsx`.

- [x] Correct the overlay single-date scale and render visible points for isolated observations. Reuse shared scale/rendering logic where it removes real duplication.
- [x] Check zero, one, two and many observations; negative and constant values; irregular publication intervals; null gaps; revisions; very long labels and narrow screens. Nulls must remain visible gaps, not bridged or interpolated estimates.
- [x] Fix duplicate date/tick keys and distinguish genuinely separate publications on the same date. Avoid smoothing and decorative curves that imply unsupported observations.
- [x] Standardise title, units, observation window, source/revision context, text alternative and table access. Use colour plus labels or shape; support keyboard interaction without trapping focus.
- [x] Ensure CSV/JSON/SVG exports reproduce the selected observations, transformations, dates and citations. Neutralise spreadsheet formula injection in exported text cells. Make a one-point export as intelligible as the rendered chart.

**Proof:** `EvidenceFigure`, `FinancialTimeSeriesChart`, `chartExport` and comparison tests; browser inspection of populated 0/1/2/many-point cases at narrow and desktop widths. Assert geometry stays within the plot and compare downloaded values to the selected record.

**Round-two verification (2026-10-03):** Six focused files passed (51 tests); the full suite passed (144 files / 840 tests), `npm run build:prepare` and `npm run build` passed, and `git diff --check` passed. Unit coverage includes zero/one/two/many observations, negative and constant values, irregular dates, gaps, revisions, long labels, in-bounds geometry and safe exact-value CSV/JSON/SVG metadata. Browser verification used the populated 120-point GDP monthly series: 320, 390, 768 and 1440px all measured equal `body.scrollWidth` and viewport width; 0, 1, 2 and 120-point views rendered the expected markers and accessible table counts. Keyboard traversal reached the observation-table disclosure with a visible 2px focus outline; Space opened it. A downloaded full-range CSV had 121 lines (header plus 120 observations); full-range JSON had 120 observations. A two-point selected comparison exported exactly 2026-06-30 and 2026-07-31 plus its exact source edition, URL and caveat. The browser app did not run the data Worker, so its `/data/health.json` 404 is expected and is not a production-health check. The latest source-link regression test failed before implementation and passed after replacing the long printed URL with a direct, breakable “Primary publication” link; this removed a 553px body scroll width at a 320px viewport.

**Done when:** A chart is accepted by inspecting the populated plot and its data/export, not because its heading and fallback table exist.

### Task 6 — Deliver the ambitious visual redesign across the site

**Files:** `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/components/SectionNav.tsx`, `app/components/PageHeader.tsx`, shared evidence/chart components and route templates.

- [x] Build the visual direction directly in representative working pages: front page, polling topic, one measure and comparison studio. Use actual validated data or clearly test-only fixtures while an upstream dependency is blocked.
- [x] Establish an editorial type hierarchy, colour tokens, chart palette, spacing and consistent buttons/filters. Use strong topic colour and compact evidence annotations; keep detailed methods available at the claim without repeating a large generic standards box everywhere.
- [x] Recompose the front page around a leading evidence story/chart, a concise dated briefing, a varied topic grid and useful paths into the tools. Put charts or meaningful results in the first useful viewport rather than a giant title and download banner.
- [x] Give each template an appropriate structure: editorial story, measure detail, exploration tool and source/history page. Replace generic repeated panel stacks. Choose frameworks and architecture for the result; the current stack gets no permanent preference.
- [x] Make primary navigation understandable and mobile topic/tool discovery obvious. Preserve deep links, accessible search, active-route indication and keyboard menu behavior.
- [x] Apply the chosen visual system to all active routes as their feature tasks land. Check empty/degraded states as deliberately as populated ones, without letting unavailable evidence dominate unrelated content.

**Round-two verification (2026-10-03):** Added route-specific polling context to the shared page header, replaced the repeated full “Evidence & sources” box with a compact currentness line and keyboard-accessible source/method disclosure, and composed the missing-poll state as a distinct editorial panel. The unavailable state still fails closed and is shown because the local data Worker is not running; no old poll value is promoted. A measured contrast check found the existing dark-text/orange pair at 4.46:1; the vivid accent now uses `#ff6b35` and measures 5.62:1. Teal status text on its tint measures 4.81:1. RED/GREEN tests cover source disclosure, route-owned currentness, page-header context and the AA contrast floor. Browser inspection: home and measure pages used real snapshot evidence, including a populated GDP chart; comparison rendered the catalog-backed GDP panel; the story and source pages retained distinct editorial/reference layouts. Polling screenshots cover 390, 768 and 1440px, with a 320px width check and 720px CSS-viewport proxy for 200% zoom (both document and body widths equalled the viewport). Keyboard focus on the methods disclosure showed a solid 2px outline; Space opened it. The existing navigation tests cover the Topics panel and Escape/focus restoration; reduced-motion behavior remains asserted by `visualSystem.test.ts`. The full suite passed 145 files / 838 tests; build and TypeScript passed. `npm run lint` had no errors and one warning from the ignored Playwright helper in `.superpowers`.

**Proof:** Representative screenshots at 390px, 768px and 1440px; 320px overflow and 200% zoom checks; keyboard, focus, contrast and reduced-motion inspection. Check the actual first viewport, chart text and navigation, not just screenshot existence. Run affected component tests and the Next build.

**Done when:** The site visibly reads as one designed publication across desktop and mobile, with useful charts and clear editorial hierarchy. This is a full composition change, not another heading-size patch.

### Task 7 — Expand the measure library and atlas (priority 2)

**Files:** `app/components/MeasureLibrary.tsx`, `app/components/DataExplorer.tsx`, `app/lib/dataExplorer.ts`, `app/measure/page.tsx`, `app/measure/[id]/page.tsx`, `app/explore/page.tsx`, Task 3's definition inventory.

- [x] Add search and shareable filters for topic, publisher, geography, frequency, unit and availability. Show coverage and missingness clearly; do not hide all unavailable definitions.
- [x] Give each measure a complete page: current or historical value, change on a valid basis, readable trend, period, definition, revision caveat, publication date, source, download and comparison/watchlist actions.
- [x] Cover all supported source-owned measures, extending beyond the original eight only where provenance and normalization are proved. Keep distinct crime and health concepts separately named.
- [x] For geography, expose comparable geographies actually supplied by each dataset. Add a map only when boundaries, denominators and observations support it; use ranked lists/small multiples when clearer. A national-only measure should say so.
- [x] Preserve stable measure URLs and redirects for any renamed IDs. Unknown IDs return a useful unavailable/not-found result rather than silently selecting another measure.

**Round-two verification (2026-10-03):** `MeasureLibrary` exposes 37 canonical definitions, a shareable search/filter state across topic, publisher, geography, frequency, unit and availability, current/historical/unavailable distinctions and per-record geography. Added tests for all six filter dimensions, URL serialization and filter restoration from a shared URL. Six focused suites passed (64 tests): library, availability, catalog, explorer, rendered explorer and Worker catalog. Re-fetched the current public snapshot (`generatedAt` 2026-10-02 18:14:58Z): the deployed catalog has 19 records for 37 definitions, leaving 18 unavailable on the current production page. Applying this worktree's `buildMeasureCatalog` to that same verified snapshot validates 36 current source-owned records; only `waitingPathwaysEstimate` remains absent because required NHS evidence is unavailable. This confirms the reader's unavailable states and local adapter coverage; it does not claim the production catalog has received this branch. The measure detail for the missing NHS record was inspected and shows definition, England geography, unit/frequency and the exact source-unavailable reason, with no fabricated value. The observed measures are UK-/nation-level series as specified by their publishers, so a map would add no supported geographic observations. Deep links use the canonical measure ID; unknown IDs return not-found, and there are no renamed IDs requiring redirects.

**Proof:** Search/filter URL round-trip, stable deep links, unavailable entries, source detail and export reconciliation. Exercise at least one populated measure from each supported family, plus missing and expired examples.

**Done when:** Readers can discover and investigate the supported evidence without knowing internal section names, and the atlas no longer relies on an arbitrary eight-item allow-list.

### Task 8 — Turn comparison into a useful studio (priority 3)

**Files:** `app/lib/comparisonWorkspace.ts`, `app/components/ComparisonStudio.tsx`, `app/compare/page.tsx`, shared chart/export functions.

- [x] Add clear starting comparisons based on available compatible evidence, searchable measure selection and removable selections. Let observed reader needs and measured layout/URL payload capacity guide how many panels the studio offers; no inherited count is a ceiling.
- [x] Keep shared-axis overlays limited to compatible definitions, units, cadence, geography and evidence class. Use separate panels for different concepts; explain incompatibility in reader language. Do not unlock misleading overlays merely to make a control usable.
- [x] Make date windows, display choices and selections survive sharing, reload and browser navigation. Validate malformed, obsolete, oversized and repeated URL parameters; preserve a versioned workspace format.
- [x] Add browser-local named workspaces with rename/delete/export/import, using the existing local-storage approach. Handle unavailable storage and newly unavailable measures explicitly.
- [x] Make exports capture the exact selected window, mode, sources and transformations. Include a readable standalone chart and machine-readable observations.

**Proof:** `tests/unit/comparisonWorkspace.test.ts`, chart/export tests and a browser journey from atlas → compare → share → reload → download. Include one-point, no-overlap and mixed-unit selections.

**Done when:** A reader can build, understand, save and reproduce a useful comparison without false comparability or silent state loss.

### Task 9 — Publish useful briefings, explainers and RSS (priority 4)

**Files:** `worker/edition-summary.js`, `app/components/BriefingEdition.tsx`, `app/briefing/page.tsx`, `app/content/stories/household-budgets.ts`, `app/content/stories/public-finances.ts`, `app/stories/[slug]/page.tsx`, `app/feed.xml/route.ts`.

- [x] Lead the dated briefing with meaningful new observations and material revisions, linked to the affected measure and edition. A re-fetch alone must not become a news event.
- [x] Distinguish a changed observation from a corrected earlier value; calculate change only on a like-for-like basis. Show source coverage limits and missing prior editions without pretending a baseline exists.
- [x] Complete the household-budget and public-finance explainers with data-bound figures, readable narrative and specific methodological caveats. Add a polling-methods explainer if needed by Task 12; do not generate unsupported causal claims.
- [x] Keep numerical claims tied to explicit measure/edition references. A historical story must retain its original data context instead of silently updating every sentence to today's values.
- [x] Make RSS valid and useful: stable item IDs, correct publication/update dates, canonical links, escaped content and clear distinction between editions and authored stories.

**Proof:** Edition-summary tests for new/revised/unchanged/first-edition cases; story rendering with unavailable data; RSS parser validation and opening every emitted item type. Verify one archived briefing remains consistent after a newer edition.

**Done when:** The briefing explains what changed and why a reader should inspect it, while its figures and history remain reproducible.

### Task 10 — Make the calendar and watchlist worth returning to (priority 5)

**Files:** `app/lib/releaseCalendar.ts`, `app/lib/watchlist.ts`, `app/components/ReleaseCalendar.tsx`, `app/calendar/page.tsx`, source adapters and measure action components.

- [x] Discover publisher-announced release dates for active source families beyond inflation, unemployment and crime. ONS supplies dated GDP, labour, inflation, private-rent/house-price, public-finance and crime releases; NHS England supplies its independently published RTT schedule. Store source identity and check time separately from measurement validity.
- [x] Keep verified future releases visible even when current measurements are unavailable. Preserve confirmed, provisional, postponed, cancelled and unknown states; never infer a promised date solely from cadence.
- [x] Add upcoming/recent views and source/topic filters. Connect events to measures and direct methodology/source links; do not let the metric collector decide the calendar event's availability.
- [x] Finish watchlist controls, local persistence, import/export and changed-since-last-visit indicators. Assessment: in-product return indicators are useful now and store only measure IDs plus evidence/edition fingerprints. Browser notifications require an active page; background push needs subscription storage and delivery/retry infrastructure; email/SMS adds contact data and operating cost. No evidence of reader demand justifies those channels yet, so retain in-product updates and revisit if demand appears. No new paid spend is incurred.
- [x] Export valid ICS with stable identifiers, escaping, all-day semantics and UK daylight-saving-safe date handling. Rescheduling changes the same UID rather than duplicating an event.

**Proof:** On 3 October, live ONS collection returned eight mapped upcoming/cancelled releases and the NHS API exposed the current 2026/27 proposed plan; the real official PDF yielded six future provisional RTT dates. Focused calendar/watchlist checks passed (6 files / 40 tests). A generated ICS was imported with Mozilla's `ical.js` 2.2.1; its all-day date, stable UID, tentative status, source link and UTF-8 line folding parsed correctly. The temporary parser was not added as a dependency.

**Done when:** Readers can follow a real upcoming release and return to the relevant evidence without invented scheduling or silent local-data loss.

### Task 11 — Add private rents and complete the cost-of-living lens (priority 6)

**Files:** `app/components/CostOfLivingLens.tsx`, `app/cost-of-living/page.tsx`, `worker/feed-registry.js`, Task 3's measure definitions, source-ownership contract; proposed source-specific rent collector/normaliser beside the existing ONS collectors.

- [x] Reconcile `privateRentAnnualChange`, `privateRentAverage` and `housePriceAverage` against the live September 2026 ONS publication. The live catalog now has source, release date, geography, distinct GBP/month, GBP and percent units, observation periods and currentness; the HPI lag remains separate from newer rent observations.
- [x] Reuse the existing bounded ONS retrieval and extend strict parsing/reconciliation for PIPR and HPI history, headline values and explicit missing HPI months. Collector tests cover the real publication shape and changed/missing source shapes.
- [x] Keep rent level, rent annual growth, house-price level and HPI annual growth as separate canonical records; document provisional/revision and geography caveats in the definitions and source pages.
- [x] Recompose the lens into prices, earnings, renting, buying and policy-rate sections. Explain who each measure describes; CPI is not a household's personal inflation rate and Bank Rate is not an individual mortgage rate.
- [x] Compare CPI and PIPR only at an identical observation date and in matching annual-percent units. The reader sees their different definitions and that the figures are not added into a household score.
- [x] Render the live catalog through the populated cost-of-living page and inspect its rent/HPI charts and actual CSV/JSON downloads at desktop and 320px mobile width. Compare periods, values, source edition and caveats with visible observations.

**Proof so far:** Live `SECTION_BUILDERS.housePriceIndex` → `buildMeasureCatalog` produced current UK records from the September 2026 ONS edition: August rent £1,400/month and +3.8% (120 annual-change points), July UK HPI +1.4% and £273,000, with the newer rent/HPI gap preserved. Focused collector/catalog/UI tests passed (4 files / 33 tests). A failing regression test caught timezone-sensitive handling of “Aug 2026” as 31 July; strict month-name parsing now maps the full August and July observation windows correctly. Playwright inspection confirmed populated SSR for both levels and charts, 120-point CSV/JSON exports for each annual-change chart, matching latest non-null values/source edition/caveats, and no horizontal overflow at 320px. Browser exports and screenshots are local verification artifacts only; the original generated snapshot was restored and hash-verified byte-for-byte after the run.

**Done when:** Private rent is backed by live primary evidence and the lens answers practical questions using correctly separated measures. A remaining rent placeholder is incomplete work.

**Implementation note (2 October 2026):** The existing ONS house-price collector already retrieves Figure 1, which contains separate PIPR and UK HPI columns. Round two extends that source-owned route to parse and reconcile both series, preserves the latest blank HPI as an explicit gap, and adds separate rent-change and average-rent catalog records. Consumer tests are being added; current production data remains unchanged until a compatible deployment is verified.

### Task 12 — Build a multi-pollster publication lab (priority 7)

**Files:** `worker/live-polling-collector.js`, `worker/election-polls.js`, `app/lib/pollingLab.ts`, `app/components/ElectionPolling.tsx`, `app/components/PollingPublicationChart.tsx`, registry/contracts and source-specific parser tests.

- [x] Repair the existing YouGov stream first; its current primary article and result-table PDF reconcile. Select additional sources only after verifying original tables and source access.
- [x] Add More in Common as an independent adapter. Nine official workbooks across June–September 2026 reconcile to their own fieldwork/results; three inaccessible archive links remain disclosed. Missing publication date and mode remain unknown, not inferred.
- [x] Retain bounded historical poll publications and explicit corrections separately from short currentness. Repeated URLs/IDs are rejected, retrieval duplicates are tested, and the source-backed historical Ipsos correction has its own reader panel and downloads. It does not extend current polling freshness.
- [x] Add pollster, fieldwork-date, disclosed publication-date and party filters. Individual observations remain separate; party controls update the plot/table/export, and fieldwork versus publication clocks remain distinct. Undated releases are excluded only when a publication-date filter is active.
- [x] Explain source/method differences and show each publication individually; keep undisclosed method details unavailable. Do not invent margins of error, a seat forecast or a polling average.

**Proof so far:** Live YouGov and nine More in Common workbook publications reconcile to primary sources. More in Common's official public polling-table archive exposes historical voting-intention workbooks. YouGov's [2019 article](https://yougov.com/en-gb/articles/22804-what-do-public-think-about-no-deal-brexit) says the original 31 March–1 April tables omitted part of the questionnaire text and were corrected on 4 April; it does not report a voting-intention value change, so this is metadata-only evidence. Ipsos's [3 October 2013 correction notice](https://www.ipsos.com/en-uk/statement-voting-intention-figures-scottish-parliament-elections) reports a data-processing error and publishes the original and corrected values for its latest September Scottish Parliament poll (SNP 41%→39%, Labour 37%→35%, Conservative 13%→12%, Liberal Democrat 7%→7%). The notice says the three affected waves were republished; its linked September PDFs now return 404, so the notice itself is the primary before/after source. This proves one historical same-poll value revision without claiming the old PDFs remain retrievable. Five focused files passed (36 tests). The correction panel and actual JSON/CSV downloads were browser-checked at 390px and 1440px; both downloads reproduce the displayed values and notice URL, and neither viewport overflows. Production behavior remains in Task 16.

**Remaining execution steps:**

- [x] Re-check YouGov and More in Common's primary release/archive pages for a correction that explicitly changes an already-published result. Record the correction notice, affected poll identity, old edition and replacement edition. Treat the known YouGov questionnaire-text correction as metadata-only unless the publisher supplies old and new result values. Ipsos's primary correction notice supplies explicit before/after evidence for a September 2013 Scottish Parliament first-vote poll; the notice is the citation because its linked PDFs now return 404.
- [x] Specify correction identity from the named pollster, geography, observation period, measure and primary notice. Later fieldwork is a new poll; repeated retrieval is not a revision; only a publisher notice can establish correction lineage. Exact September 2013 fieldwork dates and the old PDFs are unavailable, so the record says September only and cites the notice for both values.
- [x] Keep this fixed historical correction in `app/lib/pollingLab.ts`, separate from the 14-day current poll payload. Current YouGov and More in Common collection and freshness remain unchanged; this is a dated, source-backed history item rather than current fallback data.
- [x] Add tests in `tests/unit/pollingLab.test.ts` and `tests/unit/ElectionPolling.test.tsx` for the publisher's exact old/new values, source URL, JSON/CSV content, formula injection and display while current polling is unavailable. Existing `tests/worker/election-polls.test.ts` covers current poll identity, freshness and duplicate-source behavior independently.
- [x] Render the correction record in `app/components/ElectionPolling.tsx` with the poll, geography, observation period, correction date, old/new values, explanation and primary correction notice. The separate panel does not join the 2013 record to current party shares or a trend line.
- [x] Verify the Ipsos correction notice in the populated browser reader and downloaded JSON/CSV at 390px and 1440px. The page labels historical Scottish Parliament first-vote evidence corrected in October 2013; both exports match the notice. It does not imply that its linked PDFs remain available or mix this record into recent YouGov/More in Common publications.

**Done when:** At least two primary pollster streams and a verified historical sequence are usable in the lab. A second logo or an unverified scraped historical dataset does not count.

### Task 13 — Make public-money dossiers accurate and investigative (priority 8)

**Files:** `worker/government-contracts-cloudflare.js`, procurement contracts, `app/lib/publicMoney.ts`, `app/components/PublicMoneyExplorer.tsx`, `app/money/page.tsx`; dossier routes only if stable links need them.

- [x] Preserve publisher notice/award/entity identifiers, publication dates, GBP currency, primary notice/procurement links and award-stage meaning. Latest corrections/cancellations are resolved within the complete declared source window; award value is not described as expenditure.
- [x] Fetch the publisher's per-OCID release history and expose a browsable dated notice/amendment sequence when it contains one. Keep notices, awards, corrections and cancellations distinct; do not imply a complete history when the publisher record package is unavailable.
- [x] Replace exact-name aggregation with publisher-provided entity identifiers where available in collector, contract aggregation and buyer/supplier dossiers. Name-only matches remain explicit exact-name fallbacks and do not claim legal identity.
- [x] Define the retrieved universe, time window, pagination/completeness and exclusions before showing totals or rankings. Find a Tender is read through every source cursor for the complete seven-day update window; the display selects up to 100 highest-valued awards from that full universe and names both counts. Verified the live API's actual `links.next` response by retrieving two different records; collector tests cover multi-page traversal, repeated cursors, changed-window links and a complete refresh with all seven days.
- [x] Handle repeated notices, amended values and cancellations by retaining latest revisions and cancellation tombstones. Split multi-supplier awards only as a clearly labelled equal-share comparison scenario; never call it attributed supplier revenue.
- [x] Build shareable buyer/supplier dossiers and search/filter views. Show publisher IDs, source notices and a dated award-value list. Exact-name fallbacks disclose their limits. Evidence-linked comparisons between dossiers and separate public measures remain open.
- [x] Export the exact filtered records with publisher IDs, source window, filtered count, full-window denominator, coverage percentage and GBP basis note. Paginate notice results and keep the record cards responsive.

**Proof so far:** `tests/unit/publicMoney.test.ts`, `tests/unit/PublicMoneyExplorer.test.tsx`, `tests/unit/GovernmentContracts.test.tsx`, `tests/unit/government-contracts-contract.test.ts` and `tests/worker/cloudflare-publication.test.ts` cover ID collisions/renames, shared filters and dossiers across reload, pagination, exact-window CSV context, correction/cancellation handling, and scenario labels. On 3 October the complete post-cleanup suite passed (144 files / 835 tests); `npm run lint`, `npx tsc --noEmit`, the pinned Node 24.17.0/npm 11.13.0 toolchain check, source ownership and public-route boundary checks passed. `npm run build` passed before removal of the isolated NHS direct-KV writer. A current live dossier-to-source reconciliation, a verified amendment sequence if exposed by the publisher, and comparison to separate public measures remain outstanding.

**Release-history verification (2026-10-03):** Added a strict normalizer for Find a Tender OCDS record packages, an exact `/data/contracts/history.json?ocid=...` Worker route, and an on-demand dated release sequence in each selected dossier. The route has a fixed publisher host, validated OCID, 8-second timeout, 512 KiB response cap, same-host check, 300-second cache and generic failure states. The compact response preserves release IDs, dates and exact OCDS tags, sanitizes publisher HTML to plain text, and links each notice and the official record package/API documentation. Updated `contracts/public-surfaces.json` and `worker/wrangler.toml`; tests reject malformed identifiers, repeated/extra query values, mismatched OCIDs, duplicate releases, foreign redirects, oversized responses and upstream throttling. Re-fetched the official package for `ocds-h6vhtk-047306`: HTTP 200, four dated releases from 2024-06-27 to 2026-03-13 (planning, tender, tender update, award/contract). Focused contract/Worker/UI/public-route tests passed (4 files / 21 tests). This verifies the reader journey locally; the new route and UI are not deployed.

**Done when:** Dossiers support useful investigation without misleading entity joins, double-counted money or national claims based on an incomplete sample.

### Task 14 — Make country comparisons explorable and comparable (priority 9)

**Files:** `worker/international-comparison.js`, `worker/international-comparison-publication.js`, `app/lib/countryComparison.ts`, `app/components/CountryComparisonFigures.tsx`, `app/components/InternationalComparison.tsx`, comparison contracts.

- [x] Verify the seven current measures against live primary publications, units, historical/estimate/projection status and country universe. Keep refresh/readiness isolated from national publication.
- [x] Provide individual country and evidence-status controls for each measure; the visible denominator updates with the selection.
- [x] Add meaningful peer presets and serialize measure/country/status selection in a shareable URL. Validate malformed state and preserve browser back/forward behavior. Expand the country universe only when source coverage supports it.
- [x] Offer common-year comparisons when the publication retains multiple years, and a distinctly labeled latest-available mode otherwise. Never disguise mixed years as a single-year league table.
- [x] Show included/excluded countries, reasons, missingness and the selected ranking denominator. Handle ties explicitly; null values are not ranked as zero.
- [x] Provide country dot plots, exact-value tables, accessible labels and cited chart exports. Explain each measure separately; no overall score or cross-measure ranking.
- [x] Save and validate a temporary comparison publication from the verified source collector output; record its 13-country universe, source coverage, measure years/statuses and denominators outside repository fallback data. The validated capture is `%TEMP%\international-comparison-round2-source-fixture.json`.
- [x] Verify the currently deployed comparison page at 390px and 1440px: peer filters, share URL round-trip and matching CSV/JSON exports work against its current publication. This is a reader-path proof only; the deployed edition generated `2026-10-02T11:50:45.036Z`, has no defence-year history and reports zero-country denominators for several measures.
- [ ] After release and comparison refresh, inspect government debt, 2015–2025 defence history and one latest-available-only measure. Check selected-year/latest modes, country/status filters, missing countries and ties; reconcile visible values and denominators to IMF, SIPRI or the cited primary table/API.
- [ ] Download JSON and CSV from the same selected state against the refreshed deployed edition. Reconcile country rows, values, years, status, exclusions, denominator and source URLs to both the visible table and publication. Do not add a Node fetch shim or fixture branch to shipped code to bypass request-time SSR.
- [ ] Record the refreshed public `/data/international-comparison.json` edition ID and rerun the reader/export checks after integration. The old production response does not satisfy the new source-history acceptance evidence.

**Live-source and URL verification (2026-10-03):** Re-ran `collectInternationalComparison` against current primary endpoints; all 11 source requests succeeded and all seven measures validated. Counts, years, statuses, units and UK publisher identities: government debt 2026 projection (13, IMF); ODA 2025 estimate (10, OECD); defence 2025 estimate (13, SIPRI); public social expenditure 2023 historical (10, OECD); healthcare 2024 historical (7, WHO series through World Bank WDI); tax revenue 2024 historical (10, OECD); debt interest 2024 historical (13, IMF). The adapter retains 143 defence observations (13 countries × 2015–2025); 2025 is marked estimate, and 2015–2024 historical. Other measures currently publish their single latest source year, so the UI accurately labels them latest-available and does not imply additional common-year history. Shareable measure/country/status/year state, UK/Europe and major-powers presets, malformed-state recovery, popstate behavior, intentionally empty filters and selected-year JSON contents are covered by focused UI/unit tests (4 files / 25 tests). All denominator/status/rank/source metadata remains in the export. The national publication path is unchanged. The populated live comparison reader/export remains open: local development deliberately renders the no-publication state, and the updated comparison edition cannot be published until the code is released and its isolated data route is refreshed.

**Done when:** Readers can choose peers and understand exactly what the comparison can and cannot support.

### Task 15 — Finish the public source, revision and archive ledger (priority 10)

**Files:** `app/components/RevisionLedger.tsx`, `app/sources/page.tsx`, `app/sources/[id]/page.tsx`, `app/editions/page.tsx`, `app/editions/[id]/page.tsx`, archive/summary contracts from Task 4.

- [x] Give each source a useful public page: publisher, evidence class, linked measures, direct publication links, latest successful edition and intelligible availability. Keep queue keys, account details and private error logs out of it.
- [x] Link every claim/chart to its source edition and any retained historical snapshot. Make archival dates distinct from source publication and observation dates.
- [x] Define observation identity for ledger comparisons from measure ID, geography, observation period, unit and the existing comparison key/basis definition. Compare numeric values only when that identity matches; distinguish new periods, value revisions, metadata-only changes and method/definition changes.
- [x] Extend `worker/edition-summary.js` and the publication/archive contracts so value revisions carry previous/next values, source edition and revision IDs, source publication dates, units and direct source URLs. Retrieval alone creates no event; source-publication metadata changes are separate from numeric revisions.
- [x] Add summary/archive tests for a new observation, same-observation revision, metadata-only change, method/identity change, undocumented omission, idempotent finalisation and immutable historical read. An omitted point creates no withdrawal claim.
- [x] Render revision, metadata and method changes with units, source publication dates, both source links and historical edition links. Historical values remain separate from current evidence.
- [ ] Support a publisher-documented withdrawal only after a real source notice and affected observation identity have been verified; no reviewed source example currently supplies that evidence. Keep omissions as unknown coverage, never as a withdrawal.
- [x] Make archive browsing and edition comparison discoverable from briefings and measure pages. Preserve honest gaps when a prior version was not retained; do not reconstruct a fictional past.
- [x] Publish the rolling 60-catalog retention rule and render unavailable/expired-edition states. Keep the count as a revisable storage policy, not a feature or CI ceiling.
- [ ] Measure actual archive cadence, response sizes, list/detail traffic and namespace storage; compare the current rolling 60-catalog policy with reader history needs and verified platform capacity. Change it only from those measurements, preserve immutable IDs, and report any cost requiring approval before incurring it.
- [ ] Use the populated local browser journey to open a source, inspect a real revision event, follow its primary notice and open both retained editions. Repeat against production after release; do not mark withdrawal display production-verified until a publisher-documented withdrawal exists.

**Local reader verification (2026-10-03):** Added a visible evidence-class field to source pages, linked the briefing and measure detail to their exact archive/source histories, clarified chart tooltips as source revision identifiers, and published the 60-catalog rolling-count retention policy. Playwright rendered `/sources/`, `/sources/employmentStats/`, `/editions/`, and a real immutable edition. The source page showed current status, last successful check, four measures, ONS edition and direct bulletin; its revision ledger correctly labeled four new observations. The archive index showed two stored catalogs (22 and 15 September) and the 22 September edition detail showed its 2 October as-of date, 17 recorded changes, historical values, source edition IDs and direct ONS publication URLs. HTTP requests confirmed server-rendered archive content before client JavaScript. Missing/expired archive records have an explicit unavailable message; 60 newest catalogs are retained by count, so no fixed time span is promised. Production list/detail reads still require release and post-release verification. The retention and unavailable-state portion is complete; source-backed withdrawals are not represented by a current source contract and remain open rather than labeling an outage as a publisher withdrawal.

**Done when:** A reader can trace and reproduce a published figure and understand changes to it across retained editions.

### Task 16 — Verify the whole product, release and report remaining limitations honestly

**Files:** Existing unit/Worker suites, affected `tests/e2e/` journeys, `scripts/release-smoke.mjs`, production verification utilities and operations runbooks. Add a focused `tests/e2e/publication-round-two.spec.ts` only if existing journeys cannot reasonably hold this coverage.

- [x] Build the ten-row acceptance matrix above with routes, primary evidence, local proof, reader checks and production proof. The execution pass must still run every populated journey and test-only sparse/degraded/unavailable state; never ship invented fixtures as fallback data.
- [ ] Run the ten populated reader journeys: (1) front page to current evidence; (2) atlas search/filter/deep link; (3) comparison/share/reload/export; (4) dated briefing/story/RSS/archive; (5) calendar/watchlist/ICS; (6) cost-of-living and private rent; (7) pollster/party/fieldwork filters and correction history; (8) buyer/supplier dossier and notice timeline; (9) country/year/status comparison and export; (10) source/revision/archive lineage. Record any primary-source or production-publication blocker against only its dependent claim.
- [ ] For the affected routes, verify 320/390/768/1440px reflow, keyboard/focus, reduced motion, direct initial HTML without client execution, hydration/revalidation, browser back/forward, shared URL restoration and exact downloaded values/citations. Change source freshness once in a controlled test and prove the headline, chart, status and exports all use the same edition.
- [ ] Review backward compatibility for existing route IDs, saved comparison/watchlist state, archive schemas, public response shapes and prepared artifacts. Add an additive reader or explicit migration test wherever an older saved/public form remains in use.
- [ ] Run the pinned toolchain check, source/architecture guards, `npm run lint`, `npm test`, `npm run build:prepare` and `npm run build`. Run the locked OpenNext build because web/data deployment contracts changed; run the static seed build only if its input or recovery path changed. Keep the full `quality` result as the one required code gate; browser checks remain required for these user-facing journeys, not as a global gate on unrelated Markdown edits.
- [x] Inspect live GitHub delivery rules and workflows. The active `main` ruleset requires PR plus `quality`, prevents deletion/non-fast-forward updates, requires zero human approvals, allows merge/squash/rebase, and has non-strict status checks. The deploy environment has no additional protection rule. Copilot code review is automatically requested; GitHub documents this as a review request, not a required approval or merge gate. The PR workflow has no file/line/complexity ceiling; only actual Markdown-only changes skip dependency installation, while executable/config/workflow changes take the full lane. Recheck the exact PR diff after creation.
- [ ] Measure current bundle size, request/Worker CPU and subrequests, KV reads/writes/storage, Queue/retry volume, source cadence and archive traffic from available deployment telemetry. Mark unavailable measurements as unknown instead of inferred. Compare viable runtimes on source access, reader performance, reliability, migration burden and current official pricing; obtain approval before any paid commitment.
- [ ] Review `git diff`, exact `HEAD`, ignored and untracked user data, then create five reviewable stacked PRs without staging `output/`, generated publication snapshots or other user files. Push one chunk at a time, wait for its required `quality` result, resolve genuine failures and merge bottom-up before rebasing the next chunk.
- [ ] After the merge-triggered release, verify the exact deployed SHA, web routes, health/publication contract, international comparison edition and the affected ten journeys. Verify evidence collection/recovery separately from code health; retain a recoverable prior release and rehearse rollback only in a safe non-production environment.
- [ ] Report each capability as locally verified, production verified or blocked by a named source/dependency. Read PR, workflow and deployment status live; do not commit volatile status snapshots as durable documentation.

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
| `docs/cloudflare-worker-backend.md` | Current runtime/hosting guidance. | Current-state description only; new public contracts and service boundaries may be added when the product needs them. Keep private collection operations protected. |
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

Also inspect executable steering outside Markdown: the workflows; public-route, source-ownership, lockfile, PR and lane checks; `contracts/public-surfaces.json`, `contracts/measure-coverage.json`, `docs/architecture/source-ownership.json`; Next/OpenNext/Wrangler configs; lockfiles; GitHub branch rules and environment settings. Remove feature-size, text-format and provider vetoes. Keep source, privacy, security, accessibility and public/private contract checks.

## 8. Execution handoff

Run these remaining steps in order. Each ends with the named tests or evidence in its task's Proof section; only tick it after that proof exists.

1. [x] **Finish Task 11's reader verification.** Re-ran `npm exec -- vitest run tests/worker/measure-catalog.test.ts tests/worker/house-price-index.test.ts tests/unit/CostOfLivingLens.test.tsx tests/unit/measureAvailability.test.ts` (4 files / 33 tests). Live ONS data passed through the catalog and page; rent and HPI rendered separately, both actual CSV/JSON downloads matched their latest non-null visible values and retained source/caveat fields, SSR contained both level values, and 320px mobile had no horizontal overflow. Restored and hash-verified the original generated snapshot.
2. [x] **Complete Task 12's local correction reader.** The five-file/36-test polling suite passed. Browser verification at 390px and 1440px confirmed the Ipsos correction table and real CSV/JSON downloads match the publisher notice and have no horizontal overflow. Verify current freshness and the correction history on the deployed revision in Task 16.
3. [x] **Close Task 13's source-backed notice trail locally.** The current Find a Tender reader follows publisher identifiers, paginates the declared complete seven-day universe, retains amendments/cancellations and exports the exact selected rows; collector, contract, API-history and dossier tests pass. Verify the deployed history route and reader journey after integration.
4. [x] **Capture and validate Task 14's comparison source edition.** The 11-request collector previously produced a validated 13-country publication from successful IMF, OECD, SIPRI and WHO/World Bank requests. Regenerate and revalidate source data during release execution; temporary captures are not committed or treated as current production evidence. Fetch the deployed route before refresh, and do not treat earlier browser checks as proof that a newly collected edition is live.
5. **Finish Task 14 against the real deployed publication after release.** Do not add a fetch-shim or fixture branch to application code. Open the request-time comparison page against the public route after the independent publication refresh; verify current government debt, 2015–2025 defence history, a latest-only measure, selected-year/latest modes, peer/status filters, missingness, denominator and ties. Download CSV/JSON for the same state and reconcile every row and provenance field to the current publication contract and primary sources.
6. **Finish Task 15's production checks.** Focused tests cover exact revision lineage, metadata-only changes, method changes, omitted history, idempotency and immutability. Search primary publisher records for a documented withdrawal example before deciding withdrawal behaviour; never infer it from omission. After integration, verify live list/detail routes and a real source → measure → revision → retained editions → primary-publication path. Measure archive cadence, response sizes, traffic and namespace storage from available telemetry; label unavailable metrics unknown and revisit the rolling 60-edition policy only from evidence.
7. **Complete Task 16's acceptance matrix and reader checks.** Map each priority to its primary source, route, tests, populated browser action, export/deep-link proof and deployed evidence. Walk all ten reader journeys at desktop/mobile; verify keyboard/focus, reduced motion, no-JavaScript HTML, hydration/revalidation, saved URLs, exact downloads and sparse/degraded/unavailable states. Close any compatibility gap with an additive reader or migration test.
8. **Finish all affected local builds and release checks.** Use pinned Node/npm; run source/architecture guards, lint, all unit/Worker tests, TypeScript, `build:prepare` and the deployable OpenNext build. Finish Pages static export only if its input or recovery path changed. Keep generated snapshots, `output/`, and unrelated user files out of commits. Confirm the active main ruleset and required `quality` check.
9. **Integrate five stacked PR chunks in order.** (A) scope/CI release lane (Tasks 0–1 and the retired direct NHS workflow); (B) source/publication integrity, catalog/archive/chart foundations (Tasks 2–5); (C) visual redesign, atlas and comparison (Tasks 6–8 / priorities 1–3); (D) briefing, calendar and cost-of-living (Tasks 9–11 / priorities 4–6); (E) polling, public-money, country comparison, revision/archive reader and deployed acceptance (Tasks 12–16 / priorities 7–10). Each PR has a defined diff, focused acceptance tests and its own required `quality` result. Base each on the previously merged chunk; merge bottom-up only after the exact head passes. The normal final merge-triggered release follows protected `main`; do not issue a separate manual deployment command.
10. **Verify the deployed release and report limits.** Confirm exact SHA, public routes, health/currentness, refreshed international comparison and the ten affected journeys. Keep code health separate from evidence collection/recovery; trigger an explicit evidence refresh only if the deployed source publication still needs it. Classify each priority as local verified, production verified or blocked by a named publisher/access dependency; never fabricate data to close a source-access gap.

Use focused local checks while implementing, one required `quality` gate per stacked PR, and reader-facing production checks after the final merge-triggered release. Do not claim a feature production-complete until its acceptance evidence is observed on the deployed reader journey.

At each increment report: what readers can now do, proof actually obtained, remaining source dependencies and the next task. Do not add recurring status documents, additional approval gates or a new standing agent programme. The final result must be demonstrably useful with populated evidence and honestly incomplete wherever an external source remains unverified.
