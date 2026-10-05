# Revamp progress

Updated 5 October 2026.

## Signed off

| Change | Test | Result |
|---|---|---|
| #197 edition look | GitHub quality check on `7a50464` | Passed, merged as `9eb9500` |
| Debt generator reconciliation | `npx vitest run tests/worker/national-debt.test.ts tests/worker/national-debt-generator.test.ts tests/unit/publication-policy.test.ts` | 13 passed locally on the fixture commit; live ONS generator tips still read August 2026 as HF6W 2985.5 and HF6X 93.8 |
| Enable nationalDebt only | Publication policy, page switches, worker switches, debt generator fixtures | Pending merge of this branch |

## Features

| # | Feature | Status |
|---|---|---|
| 1 | Edition look | Merged. Masthead doors and display face are on `main`. |
| 2 | Enable debt only | Enabled on this branch. `config/publications.json` sets `nationalDebt` to true. Every other publication stays false. NHS stays unavailable. |
| 3 | Machine feeds | Not started |
| 4 | Lead card and history card | Not started |
| 5 | Six topic cards | Not started |
| 6 | Contract dossier | Not started |
| 7 | Look up a place | Not started |
| 8 | Compare, one indicator | Not started |
| 9 | Polling table | Not started |
| 10 | Edition page and read API | Not started |

## Debt enablement evidence

- Collector already reads the ONS generator CSV for HF6W and HF6X.
- Fixture files `tests/fixtures/ons-hf6w.csv` and `tests/fixtures/ons-hf6x.csv` match the live generator tips fetched 5 October 2026: August 2026 HF6W £2,985.5 billion and HF6X 93.8% of GDP.
- Bulletin release date in the baked snapshot is 22 September 2026. Next release remains 21 October 2026. Both series are not seasonally adjusted.
- Enabling only `nationalDebt` opens the homepage and `/section/national-debt/`. Other sections stay offline. Fail-closed: missing or unreconciled figures stay unavailable.

## Next

1. Merge this pull request after the quality check is green.
2. Start feature 3 (Machine feeds) only after debt is signed off on `main`.
3. Do not invent NHS figures. Do not mark NHS optional.
