# Withdrawn static evidence audit — 14 July 2026

## Scope

Issue #101 covered four routes that were configured as static evidence:

- PM approval;
- the PULSE polarization measure;
- government satisfaction or trust trend;
- the combined crime dashboard.

A route remains available so users can see what was withdrawn and what evidence would be required for a trustworthy replacement. No route in this audit displays a current or historical value.

## Findings

### PM approval

The former page used embedded polling values without one reproducible primary series. A valid approval observation requires a first-party poll publication, fieldwork dates, sample, geography, question wording and method. Approval questions from different pollsters are not automatically comparable and may not be averaged without a documented method.

**Decision:** remain withdrawn. No current PM approval figure is inferred from election polling or other PULSE sections.

### Polarization measure

The former PULSE-derived score had no published input dataset, formula, weighting, exclusions, missing-data treatment, sensitivity analysis or uncertainty.

**Decision:** remain withdrawn. A derived political score may return only when its complete reproducible method and inputs can be published and tested.

### Government satisfaction trend

The route still contained 25 hardcoded observations from January 2020 to December 2025, a `24%` current claim, a `DOWN 21pp` claim and a `HISTORIC LOW` claim. It cited both Ipsos Political Monitor and YouGov government approval while describing the line as satisfaction with government. It also annotated political events in a way that could imply explanation or causality without an analytical method.

**Decision:** remove the entire data array, every numerical claim, all event annotations, chart code and mixed source statement. The route now explains that satisfaction, approval and trust questions are not interchangeable.

### Crime dashboard

The former dashboard combined Crime Survey estimates, police-recorded offences, regional rates and justice outcomes from different periods and populations. Those measures answer different questions and cannot be combined into one total-crime headline.

**Decision:** remain withdrawn. Future work must present each source family separately with its own geography, reference period, denominator, revision status and direct primary release.

## Metadata repair

The four routes were previously labelled `static`, which caused the public source audit to describe them as embedded or published snapshots even when no value was shown. PULSE now has an explicit `withdrawn` delivery mode.

The public source audit therefore distinguishes:

- **automated** — a Worker-backed source contract;
- **static** — a curated embedded snapshot;
- **interactive** — calculated from the current user session;
- **withdrawn** — deliberately no value because the previous evidence does not meet the current contract.

Each withdrawn route now records `No active source contract` rather than retaining publisher names that could imply a current publication is represented.

## Shared presentation contract

All four routes use one shared withdrawn-evidence component with:

- an explicit withdrawn badge;
- a plain-language reason;
- a list of conditions required before the evidence can return;
- no metric-status badge, source timestamp, chart or fallback value;
- a link to the source and withdrawal policy.

## Validation boundary

Regression tests require all four routes to render as unavailable, verify the shared return conditions and ensure the former trust-trend values, event labels and source claim are absent. Metadata tests require exactly these four issue-#101 sections to use the `withdrawn` mode.

## Future source work

This release does not claim that no suitable source can ever exist. It establishes a fail-closed boundary. A future PR may restore a route only with a named primary series, reproducible transformation, period and geography, complete caveats, deterministic tests and exact-head release evidence.
