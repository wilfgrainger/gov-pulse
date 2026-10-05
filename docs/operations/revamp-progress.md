# Revamp progress

Updated 5 October 2026.

## Signed off

| Change | Test | Result |
|---|---|---|
| #197 edition look | GitHub quality check on `7a50464` | Passed, merged as `9eb9500` |
| Debt generator reconciliation | `npx vitest run tests/worker/national-debt.test.ts tests/worker/national-debt-generator.test.ts tests/unit/publication-policy.test.ts` | 13 passed locally on the fixture commit; live ONS generator tips still read August 2026 as HF6W 2985.5 and HF6X 93.8 |
| Enable nationalDebt only | Publication policy, page switches, worker switches, debt generator fixtures | Merged as `923e63d`. Deploy run 37306636970 succeeded. |
| #199 machine feeds (bulletin as a check) | Local debt suite including entry mocks; PR validation full-quality on `812158eb` | 21 related tests passed locally. Merged as `c219817`. |

## Features

| # | Feature | Status |
|---|---|---|
| 1 | Edition look | Merged. Masthead doors and display face are on `main`. |
| 2 | Enable debt only | Merged. `config/publications.json` sets `nationalDebt` to true. Every other publication stays false. NHS stays unavailable. |
| 3 | Machine feeds | Merged. Debt generator HF6W/HF6X tips are cross-checked against the ONS public-sector-finances bulletin. Bulletin is a check only; published figures still come from the generator. Fail closed on mismatch. |
| 4 | Lead card and history card | Not started |
| 5 | Six topic cards | Not started |
| 6 | Contract dossier | Not started |
| 7 | Look up a place | Not started |
| 8 | Compare, one indicator | Not started |
| 9 | Polling table | Not started |
| 10 | Edition page and read API | Not started |

## Machine feeds evidence

- Collector still publishes from the ONS generator CSV for HF6W and HF6X.
- The Public sector finances, UK bulletin is fetched as an independent check.
- Fixture `tests/fixtures/ons-public-sector-finances-august-2026.html` matches the live August 2026 bulletin wording fetched 5 October 2026: £2,985.5 billion and 93.8% of GDP at the end of August 2026; release date 22 September 2026; next release 21 October 2026.
- Period, stock, ratio and release date must agree with the generator tip. Mismatches fail closed. No invented bulletin-only figures.
- NHS stays unavailable. Other publications stay paused as configured.

## Next

1. Start feature 4 (Lead card and history card).
2. Do not invent NHS figures. Do not mark NHS optional.
