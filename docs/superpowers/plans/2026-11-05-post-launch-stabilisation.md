# Post-launch stabilisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the consolidated v2 publication build, now deployed, into a release that meets the master plan's gates: per-family publication approvals, no silently missing feeds, no invented evidence, free-tier-safe read paths, and a controlled release path.

**Architecture:** Keep the existing Next.js/OpenNext web Worker, data Worker, Queue and KV design. Make the master plan's invariants executable as tests (approvals, CI action allow-list, held-evidence leaks), then fix the demonstrated defects task by task. Each task ends with a focused test run and a reviewable commit.

**Tech Stack:** Next.js (OpenNext), Cloudflare Workers/KV/Queues (free tier), Vitest, Playwright, GitHub Actions.

**Spec:** `docs/v1/MASTER-DELIVERY-PLAN.md` (sole execution plan; this plan serves its Wave 1 follow-ups and the gate Wave 3 needs). Evidence rules: `AGENTS.md`. Records to update as work lands: `docs/v1/RELEASE-READINESS.md`, `docs/v1/ACCEPTANCE-RESULTS.md`, `docs/v1/EVIDENCE-REGISTER.md`.

## Global Constraints

- Missing, stale, incomplete or unreconciled evidence is unavailable, never zero, interpolated or invented.
- No publication switch changes without explicit user authorization after source-specific review. Every data activation is a separate user-authorized action.
- Do not merge PR #213; do not merge PR #214 wholesale.
- Official statistics, administrative data, polling and market signals stay separate. No synthetic crime total, overall country score, or waste/fraud/corruption claim without direct evidence.
- Cloudflare free tier only. No paid spend without the user's approval of the cost. Free-tier limits that bind: about 10 ms CPU per Worker request, 1,000 KV writes per day.
- Public responses never expose credentials, KV keys, Queue state, private diagnostics or collector internals.
- Required code gate is the `quality` aggregate in `.github/workflows/pr-validation.yml`; run it on the exact head before any merge claim.
- Keep commits and remote updates at reviewed milestones. Chat replies use `.agents/skills/caveman/SKILL.md`.

## Review Focus

1. A family later set to held is still served from a cached artifact, Pages seed, archived edition or feed. Expected: withheld everywhere. Pinned in Task 1.
2. A family marked `published` has no data. Expected: an explicit "unavailable, reason" state for readers and operators, never blank or zero. Pinned in Task 3.
3. A scraped link or redirect leaves the approved HTTPS origin. Expected: rejected before the request is sent. Pinned in Task 5.
4. A cache miss on a `/data/*` route exceeds the free plan's CPU budget. Expected: one clone at most, no read of the full internal record on health. Pinned in Task 7.
5. A keyboard-only reader on a narrow screen cannot scroll a wide chart or table. Expected: every scroll region is focusable and named. Pinned in Task 8.

---

## File Structure

- `config/publication-approvals.json` (new): per-family approval ledger.
- `tests/unit/publicationProgramme.test.ts`, `tests/unit/workflow-actions-allow-list.test.ts` (new): executable invariants.
- `worker/` collectors and publication modules: existing files, edited per task.
- `app/components/ScrollRegion.tsx` (new): shared focusable scroll wrapper.

---

### Task 1: Per-family publication approval gate

**Files:**
- Create: `config/publication-approvals.json`
- Modify: `config/publications.json`, `docs/v1/EVIDENCE-REGISTER.md`
- Test: `tests/unit/publicationProgramme.test.ts`

**Interfaces:**
- Produces: `config/publication-approvals.json` shaped `{ "version": 1, "approvals": { "<publicationId>": { "approvedBy": string, "approvedAt": "YYYY-MM-DD", "evidenceReview": "<path>#<anchor>" } } }`.

- [ ] **Step 1: Write the failing tests** in `publicationProgramme.test.ts`: `"every published publication has a recorded approval"` and `"approvals only name known publications"`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/publicationProgramme.test.ts`. Expected: FAIL listing each published family without an approval (currently 11: electionPolling, nationalDebt, gdpTracker, sentimentPulse, taxRevenue, governmentContracts, employmentStats, crimeStatistics, migrationStats, housePriceIndex, realWages; `editionArchive` is also published).
- [ ] **Step 3: Decision step (user).** Put the per-family evidence table in front of the user (source, period, last reconciliation, caveat). Record an approval entry only for each family they approve. Set every other family to `state: "held"` in `config/publications.json` with a reason code. Do not invent approvals.
- [ ] **Step 4: Add leak tests** `"a family set to held is absent from the snapshot, edition, archive and feed even when a cached artifact still lists it"` using the existing worker and app fixtures.
- [ ] **Step 5: Run** the programme and worker suites. Expected: PASS.
- [ ] **Step 6: Commit** `git add config tests docs/v1 && git commit -m "Gate publication on recorded per-family approval"`.

### Task 2: CI action allow-list contract

**Files:**
- Create: `tests/unit/workflow-actions-allow-list.test.ts`
- Modify: `docs/operations/deployment-ci-frugality.md`

- [ ] **Step 1: Write the test** `"every uses: in .github/workflows matches the documented allow-list"`. It reads all workflow files and expects each `uses:` to match `actions/(checkout|setup-node|upload-artifact)@\S+`, and expects the docs file to contain `actions/checkout@*, actions/setup-node@*, actions/upload-artifact@*`.
- [ ] **Step 2: Run it.** Expected: FAIL on the docs assertion only.
- [ ] **Step 3: Document** the allow-list and the symptom (a workflow that never starts, zero-second run, annotation naming the rejected action) in the docs file.
- [ ] **Step 4: Run it.** Expected: PASS. **Step 5: Commit.**

### Task 3: Published families with no data

**Files:**
- Modify: `worker/house-price-index.js`, `worker/live-crime-collector.js`, `worker/section-builders.js`, `worker/publication-plan.js`
- Test: `tests/worker/published-family-presence.test.ts`; fixtures under `tests/fixtures/ons/`

**Interfaces:**
- Consumes: `buildHousePriceIndex`, `discoverHousePriceIndexChartUrl(html: string, bulletinUrl: string): string`.
- Produces: an unavailable reason string per family, `"no-current-observation" | "collector-failed" | "not-scheduled"`, reachable by `/data/health.json` without exposing internals.

- [ ] **Step 1: Capture fixtures** of the current ONS house price and crime bulletin pages and chart CSVs into `tests/fixtures/ons/`.
- [ ] **Step 2: Write the failing test** `"housePriceIndex and crimeStatistics sections build from the recorded bulletins"`. Assert a section with `status: "ok"` and a dated latest observation for each.
- [ ] **Step 3: Run it.** If it passes, the defect is scheduling: check that both families appear in `publication-plan.js` jobs and the published-only selection. If it fails, fix the parser the failure names. The root cause is not yet known; a forced refresh ran 6 minutes, succeeded, and still produced neither section.
- [ ] **Step 4: Write the test** `"a published family with no section reports an unavailable reason"` for the health contract. Implement the reason field.
- [ ] **Step 5: Run** `npx vitest run tests/worker`. Expected: PASS. **Step 6: Commit.**

### Task 4: Remove invented evidence from visuals

**Files:**
- Modify: `app/components/visuals/HousingAffordabilityVisual.tsx`, `SupplierMarketConcentration.tsx`, `GovernmentContractsScrutiny.tsx`
- Test: `tests/unit/evidenceVisuals.test.tsx`

- [ ] **Step 1: Write failing tests:**
  - `"housing visual shows house-price change and real-pay growth as two labelled series, each with period and source"` and asserts no "Living Standards Index" or "Affordability Gap" text.
  - `"a single-point series renders without NaN coordinates"`.
  - `"an award with several suppliers is shown once and lists every supplier, with no equal split"`.
  - `"top-10 award share and top-5 supplier share each carry their own basis label"`.
- [ ] **Step 2: Run them.** Expected: FAIL. **Step 3:** Implement. Axes are date-spaced and units are percent for rates, with percentage points only for differences.
- [ ] **Step 4: Run** `npx vitest run tests/unit`. Expected: PASS. **Step 5: Commit.**

### Task 5: Approved-origin pre-check for collectors

**Files:**
- Modify: `worker/response-limits.js`, `worker/official-source-fetch.js`, `worker/live-feed-common.js`, `worker/wrangler.toml`
- Test: `tests/worker/approved-origin-fetch.test.ts`

**Interfaces:**
- Produces: `assertApprovedSourceUrl(url: string | URL, approvedHosts: ReadonlySet<string>): URL` (throws on non-HTTPS, userinfo, explicit port, or unlisted host) and `fetchWithApprovedRedirects(url: string, init: RequestInit, approvedHosts: ReadonlySet<string>, fetchImpl?: typeof fetch): Promise<Response>` (manual redirects, at most 3 hops, every hop re-validated).

- [ ] **Step 1: Write failing tests:** off-host, `http://`, userinfo, port, redirect off-host on hop 2, and `"the request is never sent for a rejected URL"` (fetch spy not called).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** Implement both functions; route `fetchOfficialResponse` and `fetchResponse` through them. Cancel rejected response bodies.
- [ ] **Step 4:** Add the `global_fetch_strictly_public` compatibility flag to the data Worker config and a config test that checks it.
- [ ] **Step 5: Run** `npx vitest run tests/worker`. Expected: PASS. **Step 6: Commit.**

### Task 6: Atomic enqueue and monotonic fragments

**Files:**
- Modify: `worker/publication-run-lifecycle.js`, `worker/publication-collection-runner.js`, `worker/publication-publisher.js`
- Test: `tests/worker/publication-atomicity.test.ts`

**Interfaces:**
- Produces: `writeSectionFragment(env, runId: string, section: string, record: FragmentRecord): Promise<"written" | "kept-newer">`.

- [ ] **Step 1: Write failing tests:**
  - `"enqueue after a failed final KV write does not resend the job batch"`.
  - `"a failed finaliser send is retried without re-enqueueing jobs"`.
  - `"an older retried job cannot overwrite a newer fragment"`.
  - `"an interrupted publish leaves public and current records consistent after recovery"`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** Write the run's dispatch marker before sending, and make sends idempotent per run. Compare `fetchedAt` before a fragment write. Add a recovery repair for a public record ahead of current.
- [ ] **Step 4: Run** `npx vitest run tests/worker`. Expected: PASS. **Step 5: Commit.**

### Task 7: Free-tier read-path budget

**Files:**
- Modify: `worker/public-data-entry.js`, `worker/publication-publisher.js`
- Test: `tests/worker/public-data-hot-path.test.ts`

**Interfaces:**
- Produces: `readPreparedPublicArtifact(env, now: Date): Promise<PublicArtifact | null>` that does at most one `structuredClone` per cache miss, because the publisher stores an already-normalised artifact.

- [ ] **Step 1: Write failing tests:**
  - `"a snapshot cache miss clones the artifact at most once"` with a `structuredClone` spy.
  - `"/data/health.json reads the status key and never the full internal publication"`.
  - `"every KV key written on publish has a reader"`; the commit manifest key has none today.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** Normalise once at publish. Health reads status only. Either delete the unread manifest write or wire its reader into recovery.
- [ ] **Step 4:** `node scripts/audit-free-budget.mjs`. Expected: totals no higher than before. **Step 5: Run** worker tests; **Step 6: Commit.**

### Task 8: Reader accessibility and discovery

**Files:**
- Create: `app/components/ScrollRegion.tsx` (`{ label: string; children: ReactNode }`, renders `role="region"`, `aria-label`, `tabIndex={0}`)
- Modify: the 21 `overflow-x-auto` containers in `app/`, `app/layout.tsx`, `app/lib/discovery.ts`, `app/sitemap.ts`, `scripts/generate-social-cards.mjs`
- Test: `tests/unit/scrollRegionContract.test.ts`, `tests/unit/discoveryMetadata.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `"every overflow-x-auto in app/ is rendered through ScrollRegion"`.
  - `"the housing chart has an accessible name and keyboard-reachable values"`.
  - `"comparison series differ by marker or dash, not colour alone"`.
  - `"sitemap omits feed URLs and unavailable routes"`.
  - `"withheld routes set robots noindex"`.
  - `"social images are PNG 1200x630"`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3:** Implement. Render the PNGs with `sharp`, already a dependency; do not add a new renderer.
- [ ] **Step 4: Run** `npx vitest run tests/unit`; then `npm run test:e2e` for desktop and mobile. Expected: PASS. **Step 5: Commit.**

### Task 9: Controlled release path

**Files:**
- Modify: `.github/workflows/deploy.yml`, `scripts/release-smoke.mjs`; rebase the branch `codex/least-privilege-cloudflare-deploys` onto `main`
- Test: `tests/unit/deploy-degraded-release.test.ts`

- [ ] **Step 1 (user prerequisites):** create the two Workers-scoped Cloudflare tokens, the matching GitHub environments, and the Pages deploy hook; set the Pages project's preview branches to None. Keep the old token until the new path is proven.
- [ ] **Step 2: Write failing tests:**
  - `"the data Worker deploys and passes an HTTP health check before the web Worker deploys"`.
  - `"release verification fails when /data/health.json lacks status and ready booleans"`.
  - `"a push release requires a successful quality check on the exact SHA"`.
- [ ] **Step 3: Run.** Expected: FAIL. **Step 4:** Implement in the workflow and smoke script; rebase the credential-scoping branch and resolve the `deploy.yml` conflict in favour of the tested order.
- [ ] **Step 5:** Run the workflow tests and `npm run test`. Expected: PASS. **Step 6:** Rehearse rollback outside production and record it in `docs/v1/RELEASE-READINESS.md`. **Step 7: Commit.**

---

## Out of scope

Per-family source reconciliation (Wave 3), the ten capability journeys (Wave 2) and independent sign-off (Wave 4) stay in the master plan. This plan only supplies their gates.
