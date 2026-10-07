# Retired product ledger

Date: 2026-10-07

This file preserves the reasons for product/runtime removal during the evidence-publication-v2 rework. It is historical evidence, not an active product or publication contract.

## Retired evidence products

| Product | Former route / key | Retirement reason | Re-entry requirement |
| --- | --- | --- | --- |
| Prime minister approval | `/section/pm-approval/` / `pmApproval` | The former series was not backed by a reproducible current primary-poll publication contract. | Named first-party poll publications, complete fieldwork/sample/question disclosure, explicit comparability rules and tested ingestion. |
| Political polarisation score | `/section/govt-approval/` / `polarizationMeter` | The derived score did not have reproducible inputs, weighting, missing-data treatment, formula, sensitivity analysis or uncertainty. | Publish and test the complete derivation contract before any score is exposed. |
| Government satisfaction trend | `/section/gov-trust-trend/` / `trendLines` | The series and event annotations were hard-coded and conflated satisfaction, approval and trust concepts. | One named measure, direct primary tables, wave metadata and explicit comparability breaks. |
| UK regional comparison | `/section/uk-regions/` / `geographicHeatmap` | The former view mixed non-standard regions and source systems with incompatible geographic coverage. | One versioned official geography, one named measure and a reproducible join/population method. |
| Policy relationship matrix | `/section/policy-links/` / `echoChamberMap` | The relationship matrix did not expose reproducible survey inputs, weighting, exclusions, statistic or uncertainty. | Versioned primary inputs and a tested, published analytical method. |
| Political compass | `politicalCompass` | Illustrative self-assessment was outside the public-evidence product and was not a validated public statistic. | A separately scoped product decision; it must never be represented as population evidence. |

These removals are intentional. Old URLs are not kept alive as pseudo-products whose only purpose is to explain that they are withdrawn.

## Retired compatibility/runtime artefacts

- `worker/index.js`: compatibility Worker core superseded by direct section builders and the canonical publication pipeline; it was not a deployed entrypoint.
- `app/lib/metricFallbacks.ts`: unused zero/empty fallback shapes. Missing evidence is represented by explicit lifecycle state, never fabricated placeholder values.
- `app/components/visuals/BritishDatelineTicker.tsx`: unused presentation experiment superseded by the current publication chrome.
- `public/dashboard.html`: unreferenced legacy redirect with a separate visual system.
- Default Next/Vercel SVG starter assets: unreferenced.
- `data/crime/moj-court-publication.js`: checked-in dated court figures. Current crime collection intentionally leaves justice evidence unavailable until a current MoJ edition is collected and verified.

## Historical evidence retained elsewhere

Dated evidence audits and design/research records remain under `docs/` for accountability. They do not confer runtime ownership or publication eligibility.
