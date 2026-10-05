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
| 6 | Contract dossier | Not started |
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

## Next

1. Start feature 6 (Contract dossier): lead with the notice, not a money total; buyer and supplier pages; exclusion line beside any total; framework maxima distinct; seven-day window labelled as notices updated.
2. Do not invent NHS figures. Do not mark NHS optional.
