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

## Features

| # | Feature | Status |
|---|---|---|
| 1 | Edition look | Merged. Masthead doors and display face are on `main`. |
| 2 | Enable debt only | Merged. `config/publications.json` sets `nationalDebt` to true. Every other publication stays false. NHS stays unavailable. |
| 3 | Machine feeds | Merged. Debt generator HF6W/HF6X tips are cross-checked against the ONS public-sector-finances bulletin. Bulletin is a check only; published figures still come from the generator. Fail closed on mismatch. |
| 4 | Lead card and history card | Merged. Homepage lead and history are separate white cards. Debt section mirrors the same lead/history split. Fail closed when history has fewer than two verified points. |
| 5 | Six topic cards | Merged. Homepage grid is six cards: prices, jobs, debt, rents, NHS waiting list, contracts. Unavailable cards say unavailable, never zero. NHS stays unavailable. |
| 6 | Contract dossier | Merged. Notice-first lead, exclusion coverage on totals, framework badges, buyer/supplier dossier routes. `governmentContracts` stays disabled. |
| 7 | Look up a place | Merged. Explore is the Look up door; published geographies only; postcodes fail closed. |
| 8 | Compare, one indicator | In progress. One-indicator Compare door; overlay peers only when definitions match; country peers unavailable. |
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
- UK DOGE scrutiny panel remains in `GovernmentContractsScrutiny` (`id="uk-doge"`), composed via Charts. Independent, evidence-led, not findings of waste.
- Local focused suites and PR validation full-quality green on tip `366bc62` before squash-merge `0450dcb`.

## Look up a place evidence

- Explore (`/explore/`) is the Look up door: place geography search plus the existing measure explorer.
- `lookupPlace` matches only geographies already present on measure definitions (UK, ENG, EW, GB, …). No invented local-authority series.
- Postcodes (including SY1, TD15, JE1) stay `postcode-unclassified` — a postcode area is not a country boundary.
- Unknown place names fail closed as `no-match`.
- Buyer and supplier dossiers remain under `/money/`.

## Compare, one indicator evidence

- `/compare/` leads with one published indicator from the current measure catalog.
- Overlay peers require `compareEligibility === "overlay"` (shared definition, unit, cadence and geography).
- Country peers stay unavailable while `internationalComparison` / UK-in-context is offline. No invented peer table.
- Comparison studio remains below for multi-measure workspaces. NHS stays unavailable. `governmentContracts` stays disabled.

## Next

1. Finish feature 8 (Compare, one indicator): tests, PR, merge when green.
2. Then feature 9 (Polling table).
3. Do not invent NHS figures. Do not mark NHS optional. `governmentContracts` stays disabled unless this progress note says otherwise.
