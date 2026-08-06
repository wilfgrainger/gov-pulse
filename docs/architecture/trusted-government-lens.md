# PULSE trusted-government-lens architecture

## Purpose

PULSE is an independent public-evidence service for understanding UK central government and national outcomes. The architecture must let a citizen understand important changes quickly while preserving enough provenance for journalists, analysts and public servants to verify every material claim.

## Source-first domain model

### Observation
A dated value published for a defined measure, unit, geography and period. Observations are immutable once ingested; corrections create a new revision.

Required fields: `id`, `measureId`, `value`, `unit`, `geography`, `periodStart`, `periodEnd`, `publishedAt`, `retrievedAt`, `revisionId`, `evidenceClass`, `sourceReleaseId`, `comparisonBasis`, `status`.

### Release
A publisher artefact containing one or more observations.

Required fields: `id`, `publisher`, `title`, `canonicalUrl`, `publishedAt`, `retrievedAt`, `licence`, `cadence`, `coverage`, `methodologyUrl`.

### Revision
A declared change to a previously published release or observation.

Required fields: `id`, `supersedes`, `reason`, `publishedAt`, `materiality`, `affectedObservationIds`.

### Geography
A statistical area with an explicit type and stable identifier.

Required fields: `code`, `name`, `type`, `countryCoverage`, `validFrom`, `validTo`, `parentCode`.

### Evidence class
One of: `official-statistic`, `administrative-data`, `central-bank-data`, `fiscal-estimate`, `forecast`, `polling`, `market-implied`, `declared-position`, `derived`, `withdrawn`.

Evidence classes must never be visually or semantically collapsed into one another.

### Comparison basis
Defines whether a comparison is period-on-period, year-on-year, per-capita, real-terms, nominal, seasonally adjusted, indexed, geographic or government-period based. Unsupported comparisons fail closed.

### Fiscal estimate
A published estimate of cost, saving, revenue or borrowing impact. It records the publishing body, scorecard period, central estimate, range, assumptions, uncertainty and whether the estimate is certified, departmental or external.

### Contract award
A procurement notice or award with authority, supplier, sector, value, award date, procedure, source notice and lawful licence metadata. PULSE stores only data needed for public accountability and links to the primary notice.

### Policy decision
A dated government decision with stated objective, responsible department, implementation status, affected groups and attributed published evidence. Ideological labels are not ground truth.

Distributional-impact fields: affected groups, direction of impact, quantified fiscal effect where published, source, assumptions, uncertainty and separately attributed stakeholder reactions.

## Target information architecture

Primary navigation:

1. National signals
2. Economy and GDP
3. Public finances and debt
4. Tax and spending
5. Migration
6. NHS and public services
7. Contracts and procurement
8. Policy decisions and distributional impact
9. Elections, polling and forecasts
10. Cost of living
11. Housing and infrastructure
12. Crime, courts and prisons
13. Energy, climate and resilience
14. Regions and nations
15. Sources, revisions and methodology

## Platform contracts

- Point-of-use citation for every material claim.
- Publication calendar and revision ledger.
- Evidence-class badge and uncertainty explanation.
- CSV and JSON exports only for supported, reproducible observations.
- Stable citable URLs with explicit comparison parameters.
- Transformation registry for every derived field.
- Public change log for additions, corrections, revisions and withdrawals.
- Alert architecture without dark patterns or unnecessary personal data.
- API contract with rate limits, cache controls, input validation and privacy-safe telemetry.

## Failure behaviour

- Missing source: do not publish a value.
- Failed refresh: retain the last observation only when clearly labelled with its publication period and retrieval state; never imply live currentness.
- Invalid comparison: suppress the comparison and explain why.
- Conflicting revisions: show the latest publisher revision and retain the superseded lineage.
- Unsupported geography: fail closed rather than map approximately.
- Unattributed interpretation: do not publish it as fact.

## Roadmap order

1. National-signals overview and evidence-class navigation.
2. Publication calendar and freshness/revision ledger.
3. Contracts explorer foundation using Contracts Finder and Find a Tender provenance.
4. Policy-decision register with distributional-impact model.
5. Tax raised and public spending lens.
6. GDP, debt and fiscal comparison mode.
7. Migration geography and revision model.
8. NHS and public-service performance lens.
9. Cost-of-living and household-budget lens.
10. Housing and infrastructure lens.
11. Crime, courts and prisons lens.
12. Energy, climate and resilience lens.
13. Elections, polling, odds and forecasts with visibly separate evidence classes.
14. Regions and nations comparison with valid statistical geography.
15. Reusable public API and download contract.

## Architecture acceptance

The architecture is coherent only when every feature can use the same release, observation, revision, geography, evidence-class and comparison contracts; when unsupported data fails closed; and when political interpretation is attributed rather than asserted as objective truth.
