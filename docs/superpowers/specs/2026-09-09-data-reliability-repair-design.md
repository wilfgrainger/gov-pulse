# Data Reliability Repair Design

## Goal

Keep verified official statistics publicly available for their statistical validity window even when a refresh attempt fails, while making collector failures observable and repairing the GDP, employment, migration and NHS collectors against current official publications.

## Problem

The publication layer currently couples evidence validity to retrieval recency. GDP, employment and migration are configured with short retrieval age limits, so a failed refresh can remove still-valid official evidence from the public snapshot. Collector drift also causes valid current publications to fail parsing. Homepage and topic-page status can diverge because they consume different section-level products.

## Design

1. Treat evidence validity and collector health as separate clocks.
   - `expiresAt` owns statistical validity when present.
   - `source.fetchedAt` and retrieval age remain operational diagnostics, but do not invalidate still-current evidence that carries a verified explicit expiry.
   - Evidence without an explicit expiry continues to use the existing retrieval-age policy.

2. Preserve last-known-good evidence.
   - A failed refresh must not overwrite or remove a still-current verified section.
   - The publication/status diagnostics must report the failed refresh independently.
   - Expired evidence must still be removed.

3. Repair current collectors.
   - GDP: accept current ONS bulletin wording while retaining existing reconciliation against official series.
   - Employment: accept current labour-market bulletin wording and preserve separate labour-force and vacancies periods.
   - Migration: prefer stable official publication/dataset discovery and avoid dependence on brittle internal visualisation markup where an official comparable source can be discovered deterministically.
   - NHS RTT: make annual-page and current-publication discovery tolerant of current NHS publication markup while preserving hostname/path validation and workbook/press-notice reconciliation.

4. Enforce canonical page consistency.
   - Homepage, explorer and topic pages must derive availability/currentness from the same canonical section record.
   - No page may claim a section is current when the canonical publication has removed it.

## Safety and evidence rules

- Never synthesize or fill missing official values.
- Never keep evidence past its verified statistical expiry.
- Preserve source provenance, observation period, publication date and retrieval timestamp independently.
- Fail closed when reconciliation between headline and official series fails.
- Keep deployment and upstream-data health separate.
- No new paid services or infrastructure.

## Verification

- Regression: explicit-expiry evidence survives retrieval-age expiry until `expiresAt`.
- Regression: the same evidence disappears at/after `expiresAt`.
- Regression: failed refresh retains last-known-good section and records degraded health.
- Current-format fixtures for GDP, employment, migration and NHS.
- Focused tests for each collector and publication currentness.
- Full owned test suite, lint and production build before completion.
- Production remains untouched until explicitly authorised.
