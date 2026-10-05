# Revamp progress

Updated 5 October 2026.

## Signed off

| Change | Test | Result |
|---|---|---|
| #197 edition look | GitHub quality check on `7a50464` | Passed, merged as `9eb9500` |
| Debt generator reconciliation | `npx vitest run tests/worker/national-debt.test.ts tests/worker/national-debt-generator.test.ts tests/unit/publication-policy.test.ts` | 13 passed |

## Features

| # | Feature | Status |
|---|---|---|
| 1 | Edition look | Merged. Not a live edition yet, because publications stay disabled. |
| 2 | Enable debt only | Tested, not enabled. Official generator files read August 2026 as HF6W 2985.5 and HF6X 93.8. The flag stays off until the worker publishes that pair. |
| 3–10 | Remaining | Not started |

## Why debt is not enabled yet

The collector already reads the ONS generator CSV. Turning `nationalDebt` on before a published snapshot exists would open the route without the August pair. The policy test still requires every publication to stay paused.
