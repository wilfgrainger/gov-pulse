# National debt evidence audit — 14 July 2026

## Public question

What is the latest published UK public sector net debt figure, and what exactly does it measure?

## Accepted official observation

| Field | Verified value |
| --- | --- |
| Publisher | Office for National Statistics |
| Release | Public sector finances, UK: May 2026 |
| Release date | 19 June 2026 |
| Observation period | May 2026 |
| Measure | Public sector net debt excluding public sector banks |
| ONS series | HF6W |
| Value | £2,984.3 billion |
| Matching GDP ratio | 95.1% |
| Ratio series | HF6X |
| Geography | United Kingdom |
| Revision status | Subject to routine ONS public-sector-finance revisions |
| Next scheduled release at verification | 21 July 2026 |

## Reproduction

The Worker retrieves the ONS generator CSVs directly:

- HF6W: `/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf`
- HF6X: `/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf`

The connector:

1. parses monthly observations only;
2. sorts observations chronologically;
3. takes the latest observation from each series;
4. requires HF6W and HF6X to have the same period;
5. fails closed if either source is unavailable, empty or period-misaligned;
6. converts HF6W from £ billions to pounds for display;
7. records the exact series identifiers in the payload.

## Corrections made

- Replaced the stale March 2025 embedded observation with May 2026.
- Removed the estimated `debtPerSecond` field; the public product does not project the stock between official releases.
- Removed unrelated population, estimated GDP and milestone fields from the automated fallback contract.
- Removed public-sector borrowing series J5II from the national-debt provenance because it is no longer used to derive a projection.
- Added a cache migration so a legacy cached record cannot continue to be served after deployment.
- Updated the live-feed canary to require HF6W/HF6X provenance and reject the removed projection field.

## Material caveat

Debt measures differ by institutional coverage and accounting treatment. PULSE displays the ONS measure *public sector net debt excluding public sector banks*. It must not be compared with differently scoped gross-debt, central-government-only or public-sector-bank-inclusive measures without qualification.

## Closure standard

Issue #102 may close only after exact-head lint, unit/Worker tests, static export and Playwright pass; review threads are resolved; the PR is guarded-merged; and the deployed Worker route is observed when the secret-configured production URL is available.
