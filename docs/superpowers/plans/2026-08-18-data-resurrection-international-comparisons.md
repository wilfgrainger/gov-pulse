# Data Resurrection and International Comparisons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore independently advancing UK evidence across public-data.org, add a source-reproducible 13-country `UK in context` comparison product for seven per-resident measures, and verify every public route before review.

**Architecture:** Keep the existing national publication and the new comparison publication isolated. First remove the run-finalisation choke point so healthy national fragments advance atomically even when another job fails; then repair source-specific collectors without relaxing freshness. Add international comparisons as an optional, independently validated artifact with its own registry, contract, collector/calculation modules and UI route, so its failure cannot affect national readiness.

**Tech Stack:** Next.js 16, React 19, TypeScript, Cloudflare Workers/Queues/KV, Vitest, Playwright, OpenNext Cloudflare, official/authoritative publisher HTTP datasets.

**Spec:** `docs/superpowers/specs/2026-08-18-data-resurrection-international-comparisons-design.md`

## Global Constraints

- No stale evidence may be labelled current and no missing value may be replaced with zero, interpolation, forecast or synthetic data.
- The fixed comparison universe is United Kingdom, United States, China, Russia, Ukraine, Germany, France, Italy, Spain, Türkiye, Netherlands, Switzerland and Poland.
- The v1 comparison product contains exactly seven measures: government debt, ODA, defence, public social expenditure, total healthcare expenditure, tax revenue and debt interest, all presented as USD per resident.
- Rankings are highest amount per resident first, use competition ranking for ties, and use only genuinely comparable non-null observations in the denominator.
- Observation classification (`historical`, `estimate`, `projection`) belongs to each country observation, not to the measure as a whole.
- International comparison readiness is optional and must never affect the national publication or `/data/health.json`.
- Recurring evidence collection remains on Cloudflare, not GitHub Actions. Do not add Actions artifact storage or paid Cloudflare products.
- Freshness windows are never widened merely to make a source appear healthy.
- Every source repair starts with a reproducing test/fixture and retains observation date, publication date and retrieval date separately.
- Exact-head governance, lint, unit/Worker tests, Pages seed build, OpenNext Worker build and Playwright must pass before review.

---

### Task 1: Let successful national evidence advance after a partial run failure

**Files:**
- Modify: `tests/worker/cloudflare-publication.test.ts`
- Modify: `worker/queued-publication-entry.js`
- Verify: `tests/worker/degraded-publication.test.ts`

**Interfaces:**
- Consumes: existing `publishFromCaches(env, { now })`, run terminal records and `missingRequiredSections()`.
- Produces: `finaliseRun()` that can publish a verified degraded/current subset after the bounded retry deadline while preserving failed/missing job diagnostics.

- [ ] **Step 1: Write the failing finaliser regression**

Add a test that creates a run with a successful `gdpTracker` terminal and failed `nhsStats` terminal, stores a fresh GDP fragment plus an expired NHS value, advances `now` beyond `deadlineAt`, calls `finaliseRun()`, and asserts:

```ts
expect(result.run.status).toBe("incomplete");
expect(result.run.failedJobIds).toContain("external:nhsStats");
expect(result.publicationResult?.status.status).toBe("degraded");
expect(result.publicationResult?.publication.gdpTracker).toEqual(freshGdp);
expect(result.publicationResult?.publication).not.toHaveProperty("nhsStats");
```

Also retain a separate all-failed/no-current-evidence case that does not create `PUBLICATION_CURRENT_KEY`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/worker/cloudflare-publication.test.ts`

Expected: the new partial-run test fails because `finaliseRun()` only invokes `publishFromCaches()` when every expected job succeeded.

- [ ] **Step 3: Implement the minimal finalisation change**

After the retry deadline, invoke `publishFromCaches()` when at least one source job succeeded or an existing canonical publication is available for currentness filtering. Keep the run's own terminal status `incomplete` whenever `complete === false`; the public publication may separately be `degraded`, `published` or `no-change`. If `publishFromCaches()` reports no source-owned current evidence, finalise the run as incomplete without manufacturing an edition.

- [ ] **Step 4: Run publication tests**

Run: `npm test -- tests/worker/cloudflare-publication.test.ts tests/worker/degraded-publication.test.ts`

Expected: PASS, including the all-failed protection and `ready: false` degraded-health contract.

- [ ] **Step 5: Commit**

```bash
git add worker/queued-publication-entry.js tests/worker/cloudflare-publication.test.ts tests/worker/degraded-publication.test.ts
git commit -m "fix: advance evidence after partial publication failure"
```

### Task 2: Audit and repair every active national collector against its current primary source

**Files:**
- Inspect/modify as failures require: `worker/economic-indicators.js`
- Inspect/modify: `worker/economy-evidence.js`
- Inspect/modify: `worker/national-debt.js`
- Inspect/modify: `worker/live-tax-revenue-collector.js`
- Inspect/modify: `worker/migration.js`
- Inspect/modify: `worker/live-polling-collector.js`
- Inspect/modify: `worker/live-nhs-publication-collector.js`
- Inspect/modify: `worker/live-betting-collector.js`
- Inspect/modify: `worker/crime-statistics.js`
- Inspect/modify: `worker/government-contracts-bootstrap.js`
- Modify matching tests under: `tests/worker/`
- Modify only if source identity/cadence changed: `worker/feed-registry.js`

**Interfaces:**
- Consumes: publisher URLs/provenance from `worker/feed-registry.js` and each existing collector's normalised section contract.
- Produces: current source-specific records or explicit fail-closed errors; no collector gains a synthetic fallback.

- [ ] **Step 1: Build a source-health matrix before editing collectors**

For each active feed record: current publisher URL, response/content type, discovered edition, expected observation period, collector outcome, failure stage (`discovery`, `host`, `parse`, `schema`, `reconcile`, `currentness`, `healthy`). Use the live publisher, not the public-data.org cached page, as source truth.

- [ ] **Step 2: Reproduce each actual failure with the smallest test**

For every source classified non-healthy, add or update one fixture-driven test containing the publisher shape that broke the collector. Freeze wall-clock time using `vi.useFakeTimers()` / `vi.setSystemTime()` whenever currentness is part of the assertion.

- [ ] **Step 3: Repair discovery before parsing**

If a rolling `latest` page changed, update only the source-specific discovery function and same-host validation. Preserve the stable primary publisher boundary and reject unrelated redirects.

- [ ] **Step 4: Repair parser/schema drift minimally**

Change only selectors/headers/column reconciliation required by the current primary source. Do not widen regexes to accept arbitrary numbers, and do not use prose-search fallbacks where a machine-readable series/table exists.

- [ ] **Step 5: Verify each repaired collector independently**

Run the relevant `tests/worker/<collector>.test.ts` file after each repair. Expected: the new regression passes and previous source-identity/currentness tests remain green.

- [ ] **Step 6: Run the complete Worker test slice**

Run: `npm test -- tests/worker`

Expected: PASS with no test depending on the real current date.

- [ ] **Step 7: Commit source repairs in small source-family commits**

Use commit messages such as:

```bash
git commit -m "fix: repair current ONS economy discovery"
git commit -m "fix: repair current polling publication discovery"
git commit -m "fix: repair current NHS RTT discovery"
```

Do not bundle unrelated collectors into one opaque commit when the root causes differ.

### Task 3: Define the international comparison contract, country universe and ranking engine

**Files:**
- Create: `contracts/international-comparison.ts`
- Create: `worker/international-comparison-registry.js`
- Create: `worker/international-comparison.js`
- Create: `tests/unit/international-comparison.test.ts`

**Interfaces:**
- Produces: `COMPARISON_COUNTRIES`, `COMPARISON_MEASURES`, `rankComparisonObservations(observations)`, `buildComparisonMeasure(input)` and `validateInternationalComparisonPublication(publication)`.
- Later tasks consume these exact exported names.

- [ ] **Step 1: Write failing country/ranking contract tests**

Test the exact 13-country IDs and names, null exclusion, competition ties, highest-first direction and denominator calculation. Example:

```ts
const ranked = rankComparisonObservations([
  { country: "GBR", value: 100 },
  { country: "USA", value: 120 },
  { country: "DEU", value: 100 },
  { country: "CHN", value: null },
]);
expect(ranked.find(x => x.country === "USA")?.rank).toBe(1);
expect(ranked.find(x => x.country === "GBR")?.rank).toBe(2);
expect(ranked.find(x => x.country === "DEU")?.rank).toBe(2);
expect(ranked.find(x => x.country === "CHN")?.rank).toBeNull();
expect(ranked.filter(x => x.rank !== null)).toHaveLength(3);
```

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- tests/unit/international-comparison.test.ts`

Expected: module not found / missing exported functions.

- [ ] **Step 3: Implement contract and ranking engine**

Each non-null country observation must contain `country`, `value`, `observationYear`, `valueType`, `source`, and optional `calculationInputs`. Each null observation must have `rank: null` and an `exclusionReason`. `rankComparisonObservations()` sorts descending and assigns competition ranks (`1, 2, 2, 4`).

- [ ] **Step 4: Add invariant tests**

Assert there is no `overallScore` field, all seven measure IDs are present, every measure unit is `USD per resident`, and validation rejects a value with missing source/year/classification.

- [ ] **Step 5: Run focused test and commit**

Run: `npm test -- tests/unit/international-comparison.test.ts`

```bash
git add contracts/international-comparison.ts worker/international-comparison-registry.js worker/international-comparison.js tests/unit/international-comparison.test.ts
git commit -m "feat: define international comparison evidence contract"
```

### Task 4: Implement authoritative-source transformations for the seven comparison measures

**Files:**
- Create: `worker/international-sources/imf.js`
- Create: `worker/international-sources/oecd.js`
- Create: `worker/international-sources/sipri.js`
- Create: `worker/international-sources/who.js`
- Create: `tests/worker/international-comparison-sources.test.ts`
- Add compact publisher fixtures under: `tests/fixtures/international-comparison/`

**Interfaces:**
- Produces source adapters returning normalised observations shaped as `{ country, value, observationYear, valueType, source, calculationInputs? }`.
- IMF adapter provides WEO GDP/population/debt inputs and public-finance interest inputs; OECD adapter provides ODA, SOCX and Revenue Statistics inputs; SIPRI provides publisher per-capita military expenditure; WHO provides `CHE_pc_US$`.

- [ ] **Step 1: Write RED transformation tests from real publisher shapes**

Fixtures must preserve the identifying headers/series keys needed to detect schema drift, but contain only the 13-country rows and minimal metadata required by the test. Assert, for example, that an ODA-noncovered country returns `value: null` with `exclusionReason: "not-covered-by-comparable-donor-series"`, never zero.

- [ ] **Step 2: Implement shared numeric/unit guards**

Reject non-finite numbers, percent values outside sensible source-contract bounds, missing population, population unit ambiguity, and cross-year derived calculations. Do not silently coerce `".."`, blanks or suppression markers to zero.

- [ ] **Step 3: Implement IMF debt and interest transformations**

Debt formula:

```js
const debtUsdPerResident = (debtPctGdp / 100) * gdpCurrentUsd / population;
```

Interest formula:

```js
const interestUsdPerResident = (interestPctGdp / 100) * gdpCurrentUsd / population;
```

Require same-year GDP/population and retain all three inputs in `calculationInputs`.

- [ ] **Step 4: Implement OECD ODA, SOCX and tax transformations**

ODA: divide publisher current-USD ODA by same-year population only for comparable provider coverage. SOCX: convert percent-of-GDP using same-year GDP/population. Tax: divide total general-government tax revenue by same-year population and exclude non-covered countries.

- [ ] **Step 5: Implement SIPRI and WHO direct per-capita transformations**

Prefer publisher per-capita values and retain publisher series/unit identity rather than recomputing them.

- [ ] **Step 6: Run focused transformation tests**

Run: `npm test -- tests/worker/international-comparison-sources.test.ts tests/unit/international-comparison.test.ts`

Expected: PASS for missingness, same-year enforcement, value classification and provenance.

- [ ] **Step 7: Commit**

```bash
git add worker/international-sources tests/fixtures/international-comparison tests/worker/international-comparison-sources.test.ts
git commit -m "feat: add authoritative international comparison transforms"
```

### Task 5: Publish international comparisons independently from the national edition

**Files:**
- Create: `worker/international-comparison-publication.js`
- Modify: `worker/queued-publication-entry.js`
- Modify: `worker/wrangler.toml`
- Modify: `worker/public-data-entry.js`
- Test: `tests/worker/international-comparison-publication.test.ts`
- Modify: `docs/architecture/source-ownership.json`

**Interfaces:**
- Produces KV key `v1:international-comparison:current` and public route `/data/international-comparison.json`.
- Comparison collection is due-guarded and optional. National `REQUIRED_PUBLISHED_SECTION_IDS` is unchanged.

- [ ] **Step 1: Write failing isolation tests**

Assert a failed comparison refresh leaves national `PUBLICATION_CURRENT_KEY` untouched and `/data/health.json` semantics unchanged. Assert the comparison endpoint returns 503/unavailable when no validated comparison artifact exists rather than falling back to fabricated data.

- [ ] **Step 2: Add comparison KV publication module**

Store a validated comparison publication atomically under its dedicated key with generated/source-version metadata. A partially available comparison may contain unavailable measures, but every available measure must validate independently.

- [ ] **Step 3: Add a low-frequency due guard**

Piggyback comparison scheduling on the existing daily cron but enqueue a comparison refresh only when the last successful source check is older than seven days or a source-specific due date has passed. The guard must prevent daily network retrieval of annual datasets.

- [ ] **Step 4: Add the exact public endpoint**

Extend `worker/public-data-entry.js` to serve `/data/international-comparison.json` as a third exact data route with the same safe GET/HEAD/OPTIONS method policy and no internal operational fields.

- [ ] **Step 5: Update source ownership**

Document the comparison publication as an optional independent source family, its KV key, schedule/due guard, route and failure boundary.

- [ ] **Step 6: Run Worker publication tests and commit**

Run: `npm test -- tests/worker/international-comparison-publication.test.ts tests/worker/cloudflare-publication.test.ts tests/worker/degraded-publication.test.ts`

```bash
git add worker/international-comparison-publication.js worker/queued-publication-entry.js worker/wrangler.toml worker/public-data-entry.js docs/architecture/source-ownership.json tests/worker/international-comparison-publication.test.ts
git commit -m "feat: publish isolated international comparisons"
```

### Task 6: Add the `UK in context` evidence experience

**Files:**
- Create: `app/components/InternationalComparison.tsx`
- Create: `app/lib/internationalComparison.ts`
- Modify: `app/lib/sectionContent.ts`
- Modify: `app/lib/sections.ts`
- Modify: `app/lib/discovery.ts`
- Modify: `app/components/NationalEvidenceEdition.tsx`
- Test: `tests/unit/international-comparison-ui.test.tsx`
- Test: representative Playwright spec under `tests/e2e/`

**Interfaces:**
- `loadInternationalComparison()` fetches `/data/international-comparison.json` and returns validated public data or `null`.
- `InternationalComparison` renders scorecard rows and per-measure detail from that contract only.

- [ ] **Step 1: Write the RED UI contract test**

Render a fixture with debt available for all 13 countries and ODA available for 10. Assert the UK row shows its amount, `3rd highest of 13 comparable countries` and `5th highest of 10 comparable donors`, plus year and source/caveat. Assert unavailable countries are shown as unavailable rather than `$0`.

- [ ] **Step 2: Implement the data loader and formatting helpers**

Formatting helpers produce concise USD-per-resident values and rank text from the actual denominator. Never hard-code the UK rank or amount in JSX.

- [ ] **Step 3: Implement the scorecard and measure detail**

The scorecard has exactly seven rows. Each detail view lists ranked comparable countries and a separate unavailable-country block, plus definition, observation year, source, calculation note and historical/estimate/projection labels.

- [ ] **Step 4: Wire section navigation/discovery**

Add section id `uk-in-context` under `Public money` or `Economy` (use `Public money` in v1), with title `UK in context` and descriptive metadata. Add a secondary homepage link/card without changing the national lead priority.

- [ ] **Step 5: Add one Playwright journey**

Navigate from the homepage or section nav to `/section/uk-in-context`, assert the seven-measure scorecard is visible, open one measure detail and verify source/year/rank text.

- [ ] **Step 6: Run UI tests and commit**

Run: `npm test -- tests/unit/international-comparison-ui.test.tsx`

```bash
git add app/components/InternationalComparison.tsx app/lib/internationalComparison.ts app/lib/sectionContent.ts app/lib/sections.ts app/lib/discovery.ts app/components/NationalEvidenceEdition.tsx tests/unit/international-comparison-ui.test.tsx tests/e2e
git commit -m "feat: add UK in context comparison experience"
```

### Task 7: Verify every public route and source-status state

**Files:**
- Modify/create: `scripts/verify-public-site.mjs`
- Modify: `package.json` only if a new script alias is needed
- Test: `tests/unit/public-site-verifier.test.ts`

**Interfaces:**
- Produces a deterministic route manifest verifier usable against local Playwright server and production after deployment.

- [ ] **Step 1: Write a route-manifest test**

Construct expected routes from `SECTION_CONTENT` plus `/`, `/sources`, publication/about/editorial pages and the three `/data/*` contracts. Assert withdrawn section routes are not accidentally promoted into active navigation.

- [ ] **Step 2: Implement verifier**

For each public page require an expected 2xx status, HTML content type, page title/main landmark and no generic Next error page. For data routes require JSON content type and schema-specific top-level structure. Allow `/data/international-comparison.json` to be explicitly unavailable only before its first validated publication; after seed fixture publication it must validate.

- [ ] **Step 3: Run local build + verifier**

Run the production build mode used by Playwright, launch the local server, then execute the verifier against it.

- [ ] **Step 4: Run representative accessibility/navigation E2E**

Confirm keyboard navigation and visible focus on homepage, sources, one normal section and `UK in context`.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-public-site.mjs tests/unit/public-site-verifier.test.ts package.json
git commit -m "test: verify complete public site surface"
```

### Task 8: Repository hygiene and remaining issue handoff

**Files:**
- Inspect: open GitHub issues/PRs
- Modify code only where the issue is in-scope and independently verifiable
- Create GitHub issues for any external/source limitation that cannot safely be solved in this feature PR

**Interfaces:**
- Produces: no stale open PRs, no resolved issue left open, and explicit handoff issues containing evidence and acceptance criteria for genuinely unresolved work.

- [ ] **Step 1: Re-check issue #6**

If PostCSS/Sharp can be upgraded with a focused lockfile diff that passes the repository complexity guard and full CI, implement it as a separate commit in this PR only if it does not pull Next/Wrangler or unrelated transitive upgrades. Otherwise leave #6 open with an exact explanation and acceptance criteria; do not weaken the complexity guard.

- [ ] **Step 2: Search for all open PRs/issues**

Close obsolete PRs, close issues demonstrably solved by this branch after merge semantics are clear, and create handoff issues only for external blockers such as publisher access/schema constraints that remain after source repair.

- [ ] **Step 3: Ensure docs match reality**

Update `AGENTS.md`, README/source ownership only where this implementation changes the active architecture or public route contract. Remove stale references rather than preserving two competing architectures.

### Task 9: Full exact-head verification and single PR handoff

**Files:**
- No feature files unless verification exposes a defect.
- PR body must include exact validation evidence and public impact.

**Interfaces:**
- Produces one reviewable PR from `superpowers/data-resurrection-comparisons` to `main`.

- [ ] **Step 1: Run the repository's full quality chain**

Run, in order:

```bash
npm run toolchain:check
npm run lint
npm run test
npm run build:check
npm run test:e2e
```

Also run the locked OpenNext Cloudflare Worker build exactly as `.github/workflows/pr-validation.yml` does.

- [ ] **Step 2: Inspect exact diff and focus guard**

Confirm the branch stays within the repository's focus/complexity policy. If one PR cannot pass honestly, split only at a clean subsystem boundary and create explicit linked issues/PRs rather than weakening the guard.

- [ ] **Step 3: Open or update the single feature PR**

PR body must contain `What changed`, `Public impact`, `Validation`, source/currency/period caveats and any handoff issue links. Do not claim live production recovery before deployment verification.

- [ ] **Step 4: Wait for exact-head CI and review threads**

Fix all actionable review comments and rerun the exact final head. Do not dismiss a reviewer merely because it conflicts with an old architecture note; update stale policy when the approved architecture changed.

- [ ] **Step 5: Return the PR ready for user review**

Do not merge the feature PR unless the user explicitly changes the requested handoff. Report exact-head SHA, tests/build/E2E results, feeds restored, any legitimately unavailable feeds and any handoff issues.
