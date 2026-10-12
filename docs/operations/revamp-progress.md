# Revamp progress

Updated 12 October 2026.

## Signed off

| Change | Test | Result |
|---|---|---|
| #197 edition look | GitHub quality check on `7a50464` | Passed, merged as `9eb9500` |
| Debt generator reconciliation | `npx vitest run tests/worker/national-debt.test.ts tests/worker/national-debt-generator.test.ts tests/unit/publication-policy.test.ts` | 13 passed locally on the fixture commit; live ONS generator tips still read August 2026 as HF6W 2985.5 and HF6X 93.8 |
| Enable nationalDebt only | Publication policy, page switches, worker switches, debt generator fixtures | Merged as `923e63d`. Deploy run 37306636970 succeeded. |
| #199 machine feeds (bulletin as a check) | Local debt suite including entry mocks; PR validation full-quality on `812158eb` | 21 related tests passed locally. Merged as `c219817`. |
| #201 lead card and history card | Local `LeadHistoryCards`, `NationalDebtCounter`, `NationalEvidenceEditionBadges`; PR validation classify, quality and full-quality on `8e9f287` | Passed. Merged as `c68aeed`. |
| #203 six topic cards | Local six-card suites; PR validation classify, quality and full-quality on `8bd3628` | Passed. Merged as `de9d4b6`. |
| #205 contract dossier | Local money/contracts suites; PR validation classify, quality and full-quality on `366bc62` | Passed. Squash-merged as `0450dcb`. |
| #206 Look up a place | Local `placeLookup` unit tests; PR validation classify, quality and full-quality on `6226d4b` | 6 passed locally. Squash-merged as `75153d9`. |
| #207 Compare one indicator | Local `oneIndicatorCompare` unit tests; PR validation classify, quality and full-quality on `d37ed53` | 7 passed locally. Squash-merged as `0a9ee2f`. |
| #209 Polling table | Local `pollingTable` and `ElectionPolling` suites; PR validation classify, quality and full-quality on `cdf1aad` | 17 passed locally. Squash-merged as `3a9a063`. |
| #210 Edition page and read API | Local edition archive suites; PR validation classify, quality and full-quality on `70f072a` | 38 passed locally. Squash-merged as `cd44854`. |
| #212 Premium look | Local `premiumLook`, `SectionNav` and `LeadHistoryCards` suites; live deployment verification of `/`, `/editions/` and `/data/editions.json` on 9 October 2026 | 14 passed locally. Squash-merged as `2ef54a4`. Live chrome, edition ledger and health contract verified. |

## Features

| # | Feature | Status |
|---|---|---|
| 1 | Edition look | Merged. Masthead doors and display face are on `main`. |
| 2 | Enable debt only | Merged. `config/publications.json` sets `nationalDebt` to true. Every other publication stays false except the later archive enablement in feature 10. NHS stays unavailable. |
| 3 | Machine feeds | Merged. Debt generator HF6W/HF6X tips are cross-checked against the ONS public-sector-finances bulletin. Bulletin is a check only; published figures still come from the generator. Fail closed on mismatch. |
| 4 | Lead card and history card | Merged. Homepage lead and history are separate white cards. Debt section mirrors the same lead/history split. Fail closed when history has fewer than two verified points. |
| 5 | Six topic cards | Merged. Homepage grid is six cards: prices, jobs, debt, rents, NHS waiting list, contracts. Unavailable cards say unavailable, never zero. NHS stays unavailable. |
| 6 | Contract dossier | Merged. Notice-first lead, exclusion coverage on totals, framework badges, buyer/supplier dossier routes. `governmentContracts` stays disabled. |
| 7 | Look up a place | Merged. Explore is the Look up door; published geographies only; postcodes fail closed. |
| 8 | Compare, one indicator | Merged. One-indicator Compare door; overlay peers only when definitions match; country peers unavailable while UK-in-context is offline. |
| 9 | Polling table | Merged. Aligned party-column table; no average; shares require a source URL; corrections are separate rows; betting markets absent from the table. `electionPolling` stays disabled. |
| 10 | Edition page and read API | Merged. `/editions/` and `/editions/[id]` open with `editionArchive` enabled; `/data/editions.json` and `/data/edition.json` are the public read path; revision ledger on the index. Disabled source values stay redacted from archived responses. Squash-merged as `cd44854`. |
| 11 | Premium look | Merged as `2ef54a4`. Ink chrome, warm paper surfaces, vermillion accent, asymmetric masthead and designed offline shell are on `main`; live deployment verified on 9 October 2026. Debt-only publication behaviour unchanged. |

## Premium look evidence

- Direction: paid editorial terminal. Ink desk `#0c0f12`, warm paper reading surfaces `#f6f2ea`, one vermillion accent `#e8352e`.
- Display face remains Familjen Grotesk (`--font-display-file`). Inter stays body only.
- Signature moves: asymmetric masthead, extreme type contrast, ink paper, single accent, tabular nums, hairline furniture, lead breakout, designed offline state, reduced-motion, focus-visible AA.
- Hard bans kept: no purple-to-blue gradient, no glassmorphism, no Inter display, no centred AI hero.
- Evidence-family publication switches remain fail-closed: only `nationalDebt` and `editionArchive` are enabled; NHS, `governmentContracts`, polling, betting and other data families remain held. The current implementation changes the two authored-story routes from disabled to enabled. Stories are not dataset activation, but publishing them still requires review of their evidence links, metadata gate and editorial content before integration.
- Local: `npx vitest run tests/unit/premiumLook.test.tsx tests/unit/SectionNav.test.tsx tests/unit/LeadHistoryCards.test.tsx` — 14 passed.
- Live (9 October 2026): `/` serves 200 with ink `#0c0f12` and vermillion `#e8352e` on the chrome and warm paper `#f6f2ea` in the deployed CSS chunk; `/editions/` serves 200 with the revision ledger; `/editions/<id>` resolves 308 to the trailing-slash 200 detail route; `/data/editions.json` returns the archive (latest edition published 2026-09-22, asOf 2026-10-03); `/data/health.json` reports `degraded`/`ready:false` for `nhsStats` only, consistent with NHS staying unavailable.

## V1 continuation

The active ten-priority scope and execution sequence are in the [round-two plan](../superpowers/plans/2026-10-02-publication-reinvention-round-2.md). This file is the concise factual status and handoff ledger.

- **Scope:** the ten priorities in the round-two plan remain in scope. Existing code and tests are implementation assets, not proof of complete populated reader journeys. No new data-family activation is authorized. NHS remains unavailable. Authored stories require editorial review separately from evidence-family approval.
- **Static publication boundary repaired:** The Pages candidate writer validates the complete required current candidate, then applies publication policy before sanitizing it. Static section downloads apply currentness and publication policy, and remove stale known section files. If the JSON candidate is absent in an optional local build, downloads use the same generated snapshot as the static app and apply the same currentness and publication filters. The static output check rejects disabled or unknown download assets, checks that current national-debt HTML and downloads agree, and checks that held GDP renders unavailable without download links or files. This is a build-time boundary check; no claim is made about an artifact served in production.
- **Static fallback and route build gaps repaired:** RSS and source-directory data helpers now live outside Next route/page modules. Buyer and supplier dossier routes generate an explicitly unavailable static fallback. Static source pages do not resolve request-only search parameters.
- **Verified checks (12 October):** `npm run toolchain:check`, `node scripts/check-static-architecture.mjs` (six public routes), `node scripts/check-source-ownership.mjs` (12 active sources; 5 withdrawn sources/routes), and `npm run build:prepare` passed. `STATIC_EXPORT=true npm run build:check` passed and rendered 111 pages with only current, enabled national-debt JSON/CSV downloads. The full `npm test` run passed 1,127 tests in 175 files. `npm run lint` passed with one warning at `worker/offline-pages-entry.js:5`. The OpenNext Cloudflare Webpack build passed. `npm run test:e2e` passed 28 desktop/mobile cases; 12 deployment-only cases were skipped because no production base URL was configured. Stale browser expectations were corrected, and the homepage GDP fragment now has a matching destination. These local checks are not a hosted `quality` result or a production release verification.
- **Build path:** `package.json` now runs `next build --webpack`. In this environment the default Turbopack build failed while its CSS worker tried to bind a port (`Operation not permitted`); the Webpack build passed through the exact OpenNext adapter build. The underlying Turbopack environment issue has not been diagnosed further.
- **Release and reader acceptance:** The local checks do not complete the required hosted `quality` workflow, all-ten browser/accessibility acceptance, populated production journeys, or source approvals. No hosted PR validation or deployment verification exists for this change set. An unavailable HTTP 200 page is not a populated acceptance journey. Keep code-release health separate from source-evidence readiness and refresh both before release.

### Next

1. Close Wave 0's remaining publication-path evidence gap: inspect the deployed Pages seed and the current KV publication payload read-only, then record what each path actually serves in this ledger.
2. Review authored-story content and evidence links before any integration that would publish the currently enabled story routes; the metadata gate is covered locally, but editorial approval remains separate.
3. Enter Wave 1 after the inventory and architecture interfaces are agreed. Keep all held data families offline until each family is independently verified and explicitly authorized.
4. Continue the ten-priority sequence in the round-two plan; record local checks, reader journeys, evidence approvals and exact-revision release/rollback proof as they occur.
