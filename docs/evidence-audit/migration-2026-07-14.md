# Long-term migration evidence audit — 14 July 2026

## Public question

What is the latest official estimate of long-term international migration to and from the UK?

## Accepted official observation

| Field | Verified value |
| --- | --- |
| Publisher | Office for National Statistics |
| Release | Long-term international migration, provisional: year ending December 2025 |
| Release date | 21 May 2026 |
| Observation period | Year ending December 2025 |
| Long-term immigration | 813,000 |
| Long-term emigration | 642,000 |
| Net migration | 171,000 |
| Updated previous net migration | 331,000, year ending December 2024 |
| Change | 48% lower than the updated previous-year estimate |
| Geography | United Kingdom |
| Statistical status | Official statistics in development |
| Revision status | Latest estimates provisional for one year; earlier periods can be revised |
| Next release at verification | To be announced |

The three latest headline estimates reconcile: `813,000 - 642,000 = 171,000`.

## Reproduction

The Worker starts from the stable ONS dataset page:

`/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional`

It then:

1. discovers the latest edition from the first edition link or visible latest-edition heading;
2. builds the corresponding ONS bulletin URL;
3. reads the bulletin release date and headline immigration, emigration and net-migration estimates;
4. requires the net and immigration periods to match;
5. requires immigration minus emigration to equal net migration;
6. records the reference-period end separately from the publication date;
7. fails closed on source, discovery, parsing or arithmetic failure.

The current verified edition is `yearendingdecember2025`.

## Corrections made

- Replaced the year-ending June 2024 embedded headline with year-ending December 2025.
- Replaced the old ONS time-series connector, which no longer represented the current provisional publication model, with rolling dataset-and-bulletin discovery.
- Separated publication freshness from observation age: the Worker checks for a new ONS edition every four hours and treats an unrefreshed connector as degraded after 36 hours, while the statistical currentness contract uses the bulletin release date.
- Added a first-request cache migration so a legacy 2024 payload cannot survive deployment.
- Rebuilt the public page as an ONS-only briefing with the three reconciling headline measures and explicit provisional-status caveats.
- Added a production canary contract for the ONS-only shape.

## Withdrawn sub-series

The previous page also showed visa-type and nationality tables. These are withdrawn because:

- Home Office visa grants are administrative events, not the same measure as ONS long-term migration;
- the displayed periods and denominators were not aligned to the ONS headline;
- the nationality table was not backed by one reproducible current source contract;
- mixing them in one panel made a partially refreshed page appear wholly current.

They may return only as separate evidence pages with their own publisher, definition, geography, period, unit, revision status and source contract.

## Material caveat

Long-term international migration means people changing their country of usual residence for 12 months or more. The estimates use administrative data and modelling, are designated official statistics in development, and are revised as source data and methods improve. They should not be equated with visas issued, border crossings, foreign-born population or asylum applications.

## Primary sources

- ONS bulletin: `https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/longterminternationalmigrationprovisional/yearendingdecember2025`
- ONS dataset: `https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional`

## Closure standard

Issue #103 may close only after exact-head lint, unit/Worker tests, static export and Playwright pass; review threads are resolved; the PR is guarded-merged; and the deployed Worker route is observed when the secret-configured production URL is available.
