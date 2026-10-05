# Revamp progress

Updated 5 October 2026.

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
| 11 | Premium look | In progress on `premium-look`. Ink chrome, warm paper surfaces, vermillion accent, asymmetric masthead, designed offline shell. Debt-only publication behaviour unchanged. |

## Premium look evidence

- Direction: paid editorial terminal. Ink desk `#0c0f12`, warm paper reading surfaces `#f6f2ea`, one vermillion accent `#e8352e`.
- Display face remains Familjen Grotesk (`--font-display-file`). Inter stays body only.
- Signature moves: asymmetric masthead, extreme type contrast, ink paper, single accent, tabular nums, hairline furniture, lead breakout, designed offline state, reduced-motion, focus-visible AA.
- Hard bans kept: no purple-to-blue gradient, no glassmorphism, no Inter display, no centred AI hero.
- Publications config untouched. NHS stays unavailable. `governmentContracts`, polling and betting stay disabled.
- Local: `npx vitest run tests/unit/premiumLook.test.tsx tests/unit/SectionNav.test.tsx tests/unit/LeadHistoryCards.test.tsx` — 14 passed.

## Next

1. Merge premium look after quality checks. Deploy verification of live homepage chrome and `/editions/`.
2. Do not invent NHS figures. Do not mark NHS optional. `governmentContracts` stays disabled unless this progress note says otherwise.
