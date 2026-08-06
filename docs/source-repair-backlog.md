# Source integrity programme

This document records the current evidence-source priorities. Historical task wording is not retained as an active backlog after the repository has implemented a different or stronger source contract.

Every source tranche must include deterministic parser or contract tests, fixture provenance where fixtures are used, observation-currentness checks, review resolution, exact-head CI and production verification.

## Priority 1 — Crime publication discovery

Current public evidence is the ONS `Crime in England and Wales: year ending December 2025` release, with separate Crime Survey, police-recorded and court-timeliness modules.

Required next work:

- discover the latest ONS bulletin and data edition from rolling official pages rather than keeping the December 2025 URL pinned;
- validate release identity, reporting period, next-release metadata and every approved measure before replacing the current edition;
- retain CSEW, police-recorded crime and criminal-court statistics as separate systems;
- keep regional comparisons unavailable until one complete versioned Police Force Area dataset is joined to official geography and population inputs with reproducible rate calculations;
- fail closed if the next edition cannot be discovered, parsed and reconciled.

## Priority 2 — Deepen government-contract scrutiny

The base Find a Tender contract is implemented: the latest complete seven-day update window is collected in paced six-hour slices, comparable disclosed GBP awards are validated, and the largest 100 are published through the same-origin snapshot with direct source links and an explicit unavailable state.

Required next work:

- observe repeated production collections and retain diagnostics for page completeness, exclusions, duplicate releases, source latency and bounded fallback use;
- distinguish award notices from later contract-change notices, lots, frameworks and confirmed expenditure before adding any lifecycle or spend comparison;
- add historical comparisons only after comparable windows, buyer and supplier identities, corrections and award revisions can be reconciled deterministically;
- assess official departmental payment and spending sources separately from Find a Tender rather than treating award value as cash paid;
- expose procedure and disclosure-quality gaps only when the accepted OCDS fields directly support them;
- preserve the independent-scrutiny framing: contract size alone is never evidence of waste, fraud, corruption or savings.

## Priority 3 — Historical depth for current core series

The current headline contracts are active. The remaining work is comparable history, not restoration of embedded values.

- GDP: keep the live ONS headline separate from independently sourced G7 or sector comparisons.
- Employment: add direct series identifiers and reconciled comparable history for each displayed measure.
- Tax: add tax-category or burden analysis only when each measure has a named official series, accounting basis, period and revision status.
- Migration: keep modelled estimates and administrative counts separate; do not restore embedded visa or nationality structures without direct contracts.
- National debt: publish observed ONS values and aligned history only; do not restore extrapolated counters.

## Priority 4 — Time-sensitive non-statistical evidence

- Election polling: accept only primary pollster publications with fieldwork dates, sample, method, question wording and source URL; do not infer a trend from one poll.
- Betting markets: retain only complete timestamped approved-market snapshots; never describe prices as official statistics or forecasts.

## Maintained contracts

The following are implemented evidence contracts and should not be described as unimplemented backlog items:

- ONS and Bank of England economic indicators;
- ONS monthly GDP;
- ONS labour market;
- ONS public-sector debt and central-government receipts;
- ONS long-term international migration;
- primary election polling;
- NHS England referral-to-treatment;
- strict political betting snapshots;
- modular ONS/Home Office/MOJ crime evidence;
- Cabinet Office Find a Tender top-100 award publication and independent procurement-scrutiny view.

An open GitHub issue that still describes superseded implementation work should be reconciled against `main` and closed or rewritten before new code begins.
