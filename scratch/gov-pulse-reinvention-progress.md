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
- Reused the existing direct daily international-comparison scheduler and added per-measure source selection for retries; no Queue message was added. The workload stays at 29 healthy deliveries / 87 project operations, with 116 / 348 configured retry upper bound.
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
- Cloudflare Free quotas/account settings remain unverified due the previously recorded network restriction; the workload derivation currently reports 29 scheduled deliveries/day and 87 project operations/day, with maximum configured retry deliveries 87. This is not billing or headroom evidence.

## Current next step

Task 6: source-parser and editorial correctness pass, beginning with signed/zero/Unicode-minus wage revisions and source-verified text.
