# Test-suite audit (cave-pony `audit` mode) — 2026-09-28

Read-only philosophy: do less, prove enough. Keep every test that would fail if
real product behaviour regressed. Cut tests that only assert governance-document
wording, police pull-request or commit process, or scrape source strings that a
real behaviour test already covers. Never minimise away trust-boundary
validation, accessibility, security, fail-closed evidence, or existing
compatibility guarantees.

Baseline before this audit: 104 test files, 532 tests, `npm run lint` and
`npm test` green.

## Summary

| Class | Count | Files |
| --- | --- | --- |
| CUT | 8 | change-complexity, pr-description-policy, pr-changed-files, pr-validation-lane, workflow-cost, repository-residue, reader-surface-minimalism, topic-page-minimalism |
| CONSOLIDATE / REWRITE | 1 | gov-metrics-master-skill (slim to real guarantees; drop missing-skill ceremony) |
| KEEP | rest | evidence contracts, currentness/fail-closed, worker collectors, accessibility, security boundaries, crime composition, deployment/release verifiers |

The PR description validator and validation-lane classifier remain wired into
`.github/workflows/pr-validation.yml`. The change-size gate and its helper were
removed on 2 October 2026: changed files are still listed in the lane summary,
but file count, concern count and line count do not block validation.
The same cleanup removed `steering-and-crime-composition.test.ts`, which
asserted Markdown wording and source-string composition already covered by
route-level, component and procurement tests. It also removed
`gov-metrics-master-skill.test.ts`, a second prose-only test of `AGENTS.md`;
executable architecture and source contracts remain covered by their guards
and behavior tests.

## Findings, ranked by impact

### 1. AGENTS.md mandated a review method that does not exist (highest impact)

- Defect: `AGENTS.md` "Operating method" ordered every contributor to use
  "Graphite Mountain from `skills/graphite-mountain/SKILL.md`" with six named
  personas. That file is absent from the repository; the only skill present is
  `.agents/skills/cave-pony/SKILL.md`.
- Evidence: `gov-metrics-master-skill.test.ts` asserts
  `/Graphite Mountain.*only/i` and `/sequential review/i`, i.e. the test
  actively enforces a pointer to a missing file.
- Consequence: a standing instruction, and a passing test, that reference a
  file nobody can open. Pure ceremony that constrains contributors for no
  benefit and blocks honest simplification.
- Smallest correction: replace the section with a short honest operating note
  (small root-caused changes; review for outcome/scope, architecture, complete
  implementation, adversarial reliability/security, and simplification) that
  depends on no skill file. Rewrite the test to stop asserting the missing
  skill (finding 7).

### 2. PR-description grammar policing tested as product behaviour

- Defect: `pr-description-policy.test.ts` and `pr-changed-files.test.ts` assert
  the wording rules of pull-request descriptions (issue link, "What changed"
  path list, exact-head evidence phrasing) and a git-diff helper used only to
  police those descriptions.
- Evidence: assertions on `validatePrDescription`, `claimedPaths`,
  `changedFiles`, `DIFF_FILTER === "ACMRD"`.
- Consequence: agent/process behaviour, not product behaviour. The helpers stay
  wired into `pr-validation.yml`, so cutting these vitest files loses no
  enforcement; it removes duplicate, brittle tests of English-prose rules.
- Smallest correction: delete both test files. Keep `pr-description-policy.mjs`
  and `pr-changed-files.mjs` (still invoked by `check-pr-description.mjs` in
  CI).

### 3. Change-size limits are process policy, not product behaviour

- The former size gate rejected changes over arbitrary file, concern, source-
  line and lockfile thresholds. It has been removed; changed files remain
  visible in the PR validation summary. Architecture, lockfile integrity,
  source ownership, lint, tests and builds still enforce concrete guarantees.

### 4. Workflow-cost reporter tested for a script wired nowhere

- Defect: `workflow-cost.test.ts` unit-tests a duration/median reporter.
- Evidence: `durationSeconds`, `median`, `stepSeconds` from
  `scripts/lib/workflow-cost.mjs`, consumed only by
  `scripts/report-deploy-workflow-cost.mjs`, which no workflow or npm script
  invokes (`grep` confirms no reference outside itself and its test).
- Consequence: a test of an orphaned diagnostic. Zero product coverage.
- Smallest correction: delete the test, the reporter script, and its
  now-orphaned helper `scripts/lib/workflow-cost.mjs` (grep confirms nothing
  else imports it).

### 5. Repository-residue governance test

- Defect: `repository-residue.test.ts` asserts absence of `.agents/PROGRESS.md`,
  asserts AGENTS.md wording ("derive current repository ... state from
  GitHub"), and asserts the internals of `report-github-current-state.mjs`
  (a diagnostic wired into no workflow or npm script).
- Evidence: `fs.existsSync(".agents/PROGRESS.md")`, AGENTS.md string match,
  reporter string matches.
- Consequence: polices agent-handoff hygiene and doc wording, not product
  behaviour. The one mild real guard (do not commit a volatile progress file)
  is not worth a standing test that also pins doc prose.
- Smallest correction: delete the test file. The AGENTS.md "derive ... from
  GitHub" guidance stays in the doc; it simply stops being test-enforced.

### 6. Source-string minimalism guards duplicate real reader tests

- Defect: `reader-surface-minimalism.test.ts` and `topic-page-minimalism.test.ts`
  scrape component source and assert that removed operational UI strings have
  not returned (`not.toContain("DataHealthBar")`, `not.toContain("Publication
  cadence")`, etc.).
- Evidence: dozens of `expect(source).toContain/not.toContain` string matches
  against `.tsx` files.
- Consequence: brittle negative string guards. They break on ordinary copy
  edits and duplicate what rendered-component tests
  (`HomepageIntro.test.tsx`, `MetricsStatus.test.tsx`, `SourcesPage.test.tsx`,
  the economy/topic component tests) already verify by rendering. They do NOT
  uniquely protect the crime-composition guarantee — that lives in
  `steering-and-crime-composition.test.ts`, which is kept.
- Smallest correction: delete both files; rely on the rendered-component tests
  for reader-surface behaviour.

### 7. gov-metrics-master-skill mixes dead ceremony with real guarantees

- Defect: this file asserts the missing-skill wording and a `<=220`-line cap
  (pure ceremony) alongside genuine architecture/evidence/platform guarantees
  (pipeline string, same-origin, metrics-snapshot.json, official primary, fail
  closed, observation period, publication date, Cloudflare Free, accessibility,
  untrusted input, combined crime total, "Do not add Vercel").
- Evidence: `/Graphite Mountain.*only/i`, `/sequential review/i`,
  `split("\n").length <= 220` vs the boundary-list assertions.
- Consequence: the ceremony half blocks AGENTS.md simplification; the guarantee
  half is worth keeping.
- Smallest correction: CONSOLIDATE — drop the missing-skill and line-cap
  assertions, keep the architecture/evidence/platform boundary assertions.

## KEEP (genuine behaviour coverage — untouched)

- Evidence contracts / boundaries: `*-contract-boundary.test.ts`,
  `government-contracts-*`, `metadata-contracts`, `observation-contract`,
  `edge-evidence-hardening`, `source-ownership`, `publication-fingerprint`.
- Currentness / fail-closed / degraded publication: all `tests/worker/*`,
  `degraded-publication-*`, `deploy-degraded-release`,
  `partial-publication-finaliser`, `publication-currentness`, `snapshotCanary*`.
- Deployment / release safety: `verifyProduction`, `verifyWorkerDeployment`,
  `release-smoke`, `bootstrap-*`, `fetch-cloudflare-publication-candidate`.
- Worker collectors: NHS, betting, migration, election, tax, economy, national
  debt, crime — every `tests/worker` collector test.
- Accessibility / component behaviour: every `tests/unit/*.test.tsx`.
- Security boundaries: `response-limits`, `crime-currentness-boundary`.
- Crime composition / platform steering: `steering-and-crime-composition`
  (kept; asserts real crime-link, no-synthetic-total, Cloudflare-only, no-Vercel
  guarantees), `legacy-ingestion-retirement`, `visualSystem`.

Net: 8 files removed, 1 slimmed. No trust-boundary, accessibility, security,
fail-closed, or compatibility coverage is weakened.
