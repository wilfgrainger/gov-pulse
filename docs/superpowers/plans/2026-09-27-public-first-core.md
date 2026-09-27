# Public-first Core Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a compact, question-led core edition with consistent unemployment evidence and working live section downloads.

**Architecture:** Reuse the existing evidence selectors and filtered snapshot. Limit the reader-facing measure definitions, map unemployment to employmentStats, and serve section downloads through a same-origin Next route from the request-time snapshot. Do not change collectors or publication orchestration.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Cloudflare/OpenNext.

**Spec:** `docs/superpowers/specs/2026-09-27-public-first-core-design.md`

## Global Constraints

- Preserve fail-closed source currentness, primary links, separate observation/publication dates and source-class boundaries.
- Seven explorer measures and six homepage signals as listed in the spec.
- Keep existing topic routes and the Cloudflare Free data plane.
- No new dependency, cookie, tracking or fabricated value.

## Review Focus

- A missing employmentStats section must not show unemployment from sentimentPulse: selector test in Task 1.
- A verified but unavailable core measure must be discoverable through the explorer's explicit control: component test in Task 2.
- A section absent from the filtered snapshot must return non-success from the download route: route test in Task 3.
- Unknown section names and formats must never access arbitrary objects: route test in Task 3.
- Static export and request-time builds must both produce the intended routes: build checks in Task 3.

---

### Task 1: Canonical core selectors

**Files:** Modify `app/lib/dataExplorer.ts`, `app/lib/nationalEvidence.ts`; test `tests/unit/dataExplorer.test.ts`, `tests/unit/nationalEvidence.test.ts`.

**Interfaces:** `exploreMeasures(raw, now)` returns seven measures; `selectNationalEvidenceEdition(snapshot)` returns six signals and one current lead; unemployment reads `employmentStats.headline.unemploymentRate` and its source state.

- [ ] Write tests for seven IDs, canonical unemployment, missing source, six homepage IDs and lead chosen by current publication date.
- [ ] Run focused tests and observe their expected failures.
- [ ] Narrow definitions and selectors with no fallback across source contracts.
- [ ] Run focused tests and the full repository suite.
- [ ] Commit the self-contained selector change.

### Task 2: Public front door

**Files:** Modify `app/components/HomepageIntro.tsx`, `app/components/NationalEvidenceEdition.tsx`, `app/components/DataExplorer.tsx`, `app/explore/page.tsx`; test `tests/unit/HomepageIntro.test.tsx`, `tests/unit/dataExplorer.test.ts` and one focused component test.

**Interfaces:** Homepage action describes the seven core measures; explorer initially shows available values and provides a visible control to reveal all seven. Reader-facing copy uses short questions and explains geography.

- [ ] Write a focused failing UI test for the default explorer and the explicit unavailable toggle.
- [ ] Run it and observe the expected failure.
- [ ] Implement the minimal copy and layout changes using existing visual tokens.
- [ ] Run focused tests, repository suite and lint.
- [ ] Commit the public front-door change.

### Task 3: Same-origin current downloads

**Files:** Create `app/lib/sectionDownloads.ts`, `app/data/sections/[file]/route.ts`; modify `app/section/[id]/page.tsx`, `scripts/generate-section-downloads.mjs`, `package.json` only if necessary; test `tests/unit/sectionDownloads.test.ts` and a route test.

**Interfaces:** `sectionDistribution(snapshot, section)` and `sectionCsv(distribution)` produce source-bearing formats; route accepts only known `<section>.json|csv` and returns 404/503 for unsupported or unavailable evidence.

- [ ] Write failing tests for JSON/CSV, missing section, invalid file and current-source filtering.
- [ ] Run focused tests and observe their expected failures.
- [ ] Implement the shared formatter and the request-time route; remove the conflicting generated public-file path from the normal build.
- [ ] Run focused tests, full suite, lint, request-time build and static export build.
- [ ] Inspect rendered routes and commit the download change.

### Task 4: Review and release evidence

**Files:** Update README and source-facing copy only where behavior has changed.

**Interfaces:** Existing topic URLs remain intact; only core measures are advertised in the public front door.

- [ ] Inspect the complete diff for unused claims, old measure counts and dead download promises.
- [ ] Verify desktop and mobile reader journeys and relevant route responses.
- [ ] Record exact test/build results, production limitation and branch state for handoff.
