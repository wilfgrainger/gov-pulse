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

## Features

| # | Feature | Status |
|---|---|---|
| 1 | Edition look | Merged. Masthead doors and display face are on `main`. |
| 2 | Enable debt only | Merged. `config/publications.json` sets `nationalDebt` to true. Every other publication stays false. NHS stays unavailable. |
| 3 | Machine feeds | Merged. Debt generator HF6W/HF6X tips are cross-checked against the ONS public-sector-finances bulletin. Bulletin is a check only; published figures still come from the generator. Fail closed on mismatch. |
| 4 | Lead card and history card | Merged. Homepage lead and history are separate white cards. Debt section mirrors the same lead/history split. Fail closed when history has fewer than two verified points. |
| 5 | Six topic cards | Merged. Homepage grid is six cards: prices, jobs, debt, rents, NHS waiting list, contracts. Unavailable cards say unavailable, never zero. NHS stays unavailable. |
| 6 | Contract dossier | In progress. Notice-first lead, exclusion line on totals, framework badges, buyer/supplier dossier routes. Not merged yet. |
| 7 | Look up a place | Not started |
| 8 | Compare, one indicator | Not started |
| 9 | Polling table | Not started |
| 10 | Edition page and read API | Not started |

## Lead and history evidence

- Homepage `NationalEvidenceEdition` renders `lead-card` and `history-card` from the selected lead signal only via `LeadHistoryCards`.
- History card requires at least two verified observations. No invented earlier points.
- Debt section `NationalDebtCounter` presents the ONS stock as a lead card and the ten-year HF6W series as a history card.
- NHS stays unavailable. Other publications stay paused as configured. No invented figures.

## Six topic cards evidence

- `selectNationalEvidenceEdition` returns exactly six cards in this order: Prices (CPI), Jobs (unemployment), Debt (PSND % of GDP), Rents (ONS PIPR annual change with the ONS average monthly rent), NHS waiting list (England RTT pathways), Contracts (Find a Tender comparable award count).
- GDP, real wages, house prices and net migration leave the homepage grid. They are demoted to "Go deeper by topic" links, shown only when their publication is enabled. No tool or route is removed.
- Each card fails closed: a missing source, a non-current catalog record or a missing field gives "Current value unavailable", never zero.
- Rents read `housePriceIndex.headline.privateRent*` only, and are gated on the catalog `privateRentAnnualChange` state without overwriting the house-price history.
- Contracts show a notice count with "Notices updated, not money spent" and the summed exclusion counts. No money total on the card. Contracts never become the lead.
- With today's debt-only publication, debt is current and the other five cards say unavailable. NHS stays unavailable.
- Local tests: `npx vitest run` 170 files, 1090 tests passed before the PR split. Focused suites, `tsc --noEmit`, ESLint on changed files, static architecture and source ownership checks passed on the tip.
- Known gap: `tests/e2e/smoke.spec.ts` still expects 7 signal cards (it was already stale at 8). It is not run in PR validation and will be updated with the homepage rebuild.

## Contract dossier evidence

- `GovernmentContracts` leads with the highest-ranked Find a Tender notice (title, buyer, supplier, value basis, procedure, framework flag, notice link), not a money headline.
- Any ranked money total requires `contractCoverageLine` from complete exclusion counters. Incomplete exclusions withhold the totals.
- Framework awards use an amber badge and row treatment: "Framework maximum (ceiling, not committed spend)".
- Buyer and supplier publisher IDs open `/money/buyer/[id]` and `/money/supplier/[id]`, which redirect into the existing dossier URL state.
- Window copy states notices updated, not money spent that week. Caveats and no-waste policy stay. `governmentContracts` publication stays disabled.
- Local focused suites: GovernmentContracts, publicMoney, PublicMoneyExplorer, publicMoneyPublication, plus contracts publication/contract/chart tests. `tsc --noEmit`, source ownership and architecture checks passed.

## Next

1. Merge feature 6 only when PR validation is green, then start feature 7 (Look up a place).
2. Do not invent NHS figures. Do not mark NHS optional.
