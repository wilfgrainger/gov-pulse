# Data Reliability Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve still-valid verified official evidence through transient refresh failures and repair the current GDP, employment, migration and NHS publication collectors.

**Architecture:** Separate statistical evidence validity from collector retrieval health. Explicit statistical expiry controls public validity; retrieval age remains an operational health signal. Collector repairs remain source-specific and continue to fail closed on reconciliation errors.

**Tech Stack:** Next.js, Cloudflare Workers/KV/Queues, JavaScript/TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-data-reliability-repair-design.md`

## Global Constraints

- No new paid services or infrastructure.
- Never synthesize missing official values.
- Never publish evidence after its verified statistical expiry.
- Preserve provenance, observation period, publication date and retrieval timestamp independently.
- Production remains untouched until explicitly authorised.

---

### Task 1: Decouple statistical validity from retrieval health

**Files:**
- Modify: `worker/publication-currentness.js`
- Test: `tests/worker/publication-currentness.test.ts`

**Interfaces:**
- Consumes: `sectionCurrentness(section, data, source, now)`.
- Produces: the same API, with explicit `data.expiresAt` taking precedence over retrieval-age invalidation while still validating timestamps and source state.

- [ ] Write a failing test proving a section with a future explicit expiry remains current after the retrieval age limit.
- [ ] Run the focused test and verify it fails with `retrieval-expired`.
- [ ] Change `sectionCurrentness` so retrieval age is diagnostic-only when a valid future explicit expiry exists; retain retrieval timestamp validation and source status/cache checks.
- [ ] Run the focused tests and verify they pass.
- [ ] Add and run a regression proving the section becomes invalid at `expiresAt`.
- [ ] Commit with `fix: preserve valid evidence through refresh failures`.

### Task 2: Preserve last-known-good publication on failed refresh

**Files:**
- Modify if required: `worker/publication-queue-entry.js` and/or `worker/publication-entry.js`
- Test: existing publication queue/publication tests.

**Interfaces:**
- Consumes: cached section fragments and canonical publication snapshot.
- Produces: a degraded operational status without deleting still-current verified sections.

- [ ] Write a failing regression in the publication test suite where a refresh job fails after a prior valid section exists.
- [ ] Run the focused test and verify the section disappears or publication degrades incorrectly.
- [ ] Make the minimal publication change needed so the valid cached/canonical section survives while failure diagnostics remain visible.
- [ ] Run focused publication tests.
- [ ] Commit with `fix: retain last known good publication evidence`.

### Task 3: Repair current ONS GDP and labour bulletin parsing

**Files:**
- Modify: `worker/economy-evidence.js`
- Test: `tests/worker/economy-evidence.test.ts`

**Interfaces:**
- Produces unchanged `buildGdpTracker` and `buildEmploymentStats` result shapes.

- [ ] Add current-wording GDP fixture coverage such as `Monthly GDP grew by 0.3%` and corresponding three-month wording; verify failure.
- [ ] Extend only the GDP headline expressions needed to accept the current wording; keep series reconciliation unchanged.
- [ ] Run GDP tests.
- [ ] Add current labour bulletin wording fixture coverage while retaining distinct labour-force and vacancies periods; verify failure.
- [ ] Extend only the labour expressions required by the current bulletin and keep existing series validation.
- [ ] Run economy collector tests.
- [ ] Commit with `fix: parse current ONS economy bulletins`.

### Task 4: Harden migration discovery/history

**Files:**
- Modify: `worker/migration.js`
- Test: migration collector tests.

**Interfaces:**
- Produces unchanged `buildMigrationStats` shape and official ONS provenance.

- [ ] Add a failing fixture representing the current ONS dataset/bulletin markup where the existing visualisation-history selector is absent or changed.
- [ ] Implement deterministic discovery of an official comparable history asset or a narrowly compatible fallback from the current official page.
- [ ] Preserve arithmetic and headline/history reconciliation.
- [ ] Run migration tests.
- [ ] Commit with `fix: harden ONS migration publication discovery`.

### Task 5: Repair NHS RTT current-publication discovery/parsing

**Files:**
- Modify: `worker/nhs-rtt-source-discovery.js`, and only if required `worker/nhs-press-notice.js`
- Test: NHS RTT discovery/collector tests.

**Interfaces:**
- Produces unchanged `collectNhsRttPublication` payload and hostname/path safety constraints.

- [ ] Add a failing current NHS annual-page fixture covering the latest workbook and press-notice labels/paths.
- [ ] Make discovery tolerant of current NHS markup without weakening approved-host/path validation.
- [ ] If the current press notice wording changed, add one failing parser case and the minimum compatible parser extension.
- [ ] Run NHS focused tests.
- [ ] Commit with `fix: discover current NHS RTT publication`.

### Task 6: Canonical availability consistency

**Files:**
- Inspect/modify the homepage/topic/explorer availability projection files found by search.
- Add or modify the smallest relevant tests.

**Interfaces:**
- All page availability comes from canonical section presence/currentness, not independent ad-hoc source checks.

- [ ] Write a failing test showing the homepage and topic availability disagree for one section.
- [ ] Route both through the same canonical availability decision.
- [ ] Run focused UI/data projection tests.
- [ ] Commit with `fix: unify section availability across pages`.

### Task 7: Full verification

- [ ] Run all owned Vitest tests.
- [ ] Run lint and architecture/source-integrity checks used by the repo.
- [ ] Run the production OpenNext build.
- [ ] Inspect branch diff against `main` for unrelated changes.
- [ ] Confirm no production deployment occurred.
