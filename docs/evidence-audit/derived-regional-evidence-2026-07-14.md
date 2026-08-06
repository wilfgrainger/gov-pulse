# Derived regional evidence audit — 14 July 2026

## Scope

Issue #108 covered two static derived routes:

- UK Regional Comparison (`geographicHeatmap`);
- Policy Relationships (`echoChamberMap`).

Both routes remain directly addressable so users can see why the evidence was withdrawn and what would be required for a trustworthy replacement. Neither route displays a current or historical value.

## UK Regional Comparison findings

The former tile map embedded 33 values directly in the component.

| Display area | Unemployment rate (%) | Police-recorded crime per 1,000 | Labour vote share, 2024 (%) |
| --- | ---: | ---: | ---: |
| Scotland | 3.6 | 52 | 35 |
| North East | 5.1 | 82 | 46 |
| North West | 4.2 | 89 | 44 |
| Yorkshire | 4.4 | 87 | 39 |
| Midlands | 4.6 | 80 | 38 |
| Wales | 3.8 | 68 | 37 |
| East | 3.4 | 61 | 31 |
| South West | 3.0 | 64 | 27 |
| South East | 3.2 | 62 | 29 |
| London | 5.0 | 98 | 48 |
| Northern Ireland | 2.6 | 44 | unavailable |

The component labelled the layers as:

- `ONS Labour Force Survey, Q3 2025`;
- `Home Office, year ending September 2025`;
- `Electoral Commission, July 2024`.

The repository did not retain row-level source records, source extracts, extraction code, geography codes, aggregation code, rounding policy, revision status, missingness rules or fixtures reproducing those values and rankings.

The geography was not a standard statistical classification:

- Scotland, Wales and Northern Ireland were combined with English regions;
- `Midlands` merged areas that official statistics normally publish separately;
- labels such as `East` and `Yorkshire` did not identify a named code set or boundary vintage.

The source claims were not mutually comparable:

- the Home Office police-recorded-crime system covers England and Wales, not a like-for-like UK series including Scotland and Northern Ireland;
- Scotland and Northern Ireland have separate justice systems, recording rules and publications;
- regional Labour Force Survey estimates require explicit official regions, periods and sampling caveats;
- election values require a reproducible constituency-to-region lookup and aggregation;
- Northern Ireland has a different party system and cannot be treated as a comparable zero or generic unavailable value in a Labour ranking;
- the previously removed income layer had already mislabelled employee earnings as household income.

The statement that every layer compared the same measure and reference period across each displayed UK region was unsupported.

### Decision

Remove the complete data array, tile map, rankings, colours, controls and source-period claims. No regional unemployment, crime, voting or income value is carried forward.

A future regional comparison requires:

1. one named measure at a time;
2. direct published rows and deterministic extraction;
3. official geography codes and boundary vintage;
4. one observation period, unit and revision status;
5. a reproducible geography join or aggregation;
6. explicit cross-nation comparability or separate national contracts;
7. documented missingness and uncertainty;
8. deterministic source-row, join, ranking and unavailable-state tests.

## Policy Relationships findings

The former matrix had already been hidden, but repository metadata still described it as an annual static derived analysis sourced from NatCen BSA and YouGov. No committed dataset or transformation supported that claim.

The repository did not contain:

- respondent-level or reusable aggregate input data;
- named survey waves and variables;
- question wording or response coding;
- sampled population, geography or fieldwork coverage;
- weighting;
- exclusions or missing-data treatment;
- minimum sample rules;
- the exact association statistic;
- uncertainty or multiple-comparison treatment;
- calculation code or fixed fixtures.

A reproducible relationship matrix requires:

- named source variables and survey waves;
- sampled population, geography and fieldwork coverage;
- respondent-level or reusable aggregate input data;
- weighting, coding, exclusions and missing-data treatment;
- the exact association statistic;
- uncertainty, multiple-comparison treatment and sensitivity checks;
- separation of statistical association from causal or political interpretation;
- fixed test fixtures for the complete transformation.

### Decision

Keep the matrix withdrawn, remove active-source and annual-cadence claims, and use the same first-class withdrawn-evidence presentation as other unreproducible routes. No coefficient, relationship strength, ideological cluster or causal link is inferred.

## Discovery and source-register boundary

Both routes are removed from the primary homepage and desktop/mobile navigation. Their direct routes remain available for audit. The Sources page lists potential future publishers under evidence gaps rather than active current evidence.

The evidence boundaries in `AGENTS.md` govern any future restoration.

## Removed evidence

This release removes or blocks the return of:

- all 33 regional values;
- every highest/lowest claim and regional ranking;
- the simplified tile-map comparison;
- the `Midlands` pseudo-region;
- the three unsupported source-period labels as active evidence;
- any policy coefficient, relationship strength, cluster or ideological label;
- active annual source claims for both derived routes.

No replacement value is inferred.

## Closure standard

Issue #108 may close only after exact-head lint, the full unit/Worker suite, static production export and deterministic Playwright pass; every review finding is resolved; the guarded merge succeeds; and the direct withdrawn routes and Sources evidence-gap register are verified where the public Pages host is observable.
