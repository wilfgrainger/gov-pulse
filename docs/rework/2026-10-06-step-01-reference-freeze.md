# Rework baseline — Step 1: freeze editorial reinvention as reference

Date: 2026-10-06  
Baseline branch: `rework/evidence-publication-v2`  
Production baseline: `main`  
Reference PR: #213 — `feat/editorial-visual-reinvention`

## Decision

PR #213 is **reference work only**. It must not be merged into the rework baseline.

The rework starts from production `main`, because the objective is to replace the accumulated publication-state, source-catalogue, orchestration and UI architecture rather than add another presentation layer on top of it.

The reference branch remains useful as a design experiment. Selected ideas may be reimplemented against the new domain model, but code is not to be cherry-picked merely because it is already complete.

## Carry forward as product/design principles

1. **Progressive evidence disclosure**  
   A reader should get the number and context first, with detailed provenance/methodology available without making the primary reading path feel operational.

2. **Gap-preserving charts**  
   Missing observations remain missing. Charts must not visually interpolate across evidence gaps or imply observations that do not exist.

3. **Explicit source context**  
   Period, publisher/source, revision status and material caveats belong close to the evidence they qualify.

4. **Accessible underlying observations**  
   Important charts should retain an accessible tabular representation and export path where useful.

5. **Domain identity**  
   Topic colour can aid scanning, provided colour never carries evidence-state meaning by itself.

6. **Reader-first filtering**  
   Primary filters should expose the dimensions readers actually use; specialist filters may move behind progressive disclosure.

7. **Policy-aware navigation**  
   Public navigation must not advertise routes or capabilities that are not genuinely usable.

8. **Strong degraded-state discipline**  
   Do not substitute an older value, zero, estimate or interpolation merely to avoid an empty state.

## Do not carry forward as architecture

1. The layered `v3-*` / `premium-*` / `edition-look-*` CSS generations.
2. A fixed six-card homepage or any layout contract encoded as a permanent data invariant.
3. A single publication `enabled` boolean controlling collection visibility, route existence, catalogue membership and public state.
4. UI components interpreting raw collector/source-health state independently.
5. Repeated publisher URLs, cadence, geography, caveats or source metadata in React/config/docs.
6. An expanding Measure Library as the primary reader experience.
7. Operational language such as “fail closed” or “reverify” as default public-facing editorial copy.
8. Source-string tests that protect CSS class names, implementation text or redesign-specific markup rather than behaviour.

## Rework invariant

> Every public number is an accepted evidence record with one source of truth. Every missing number has one explicit state. The reader never has to understand our operational machinery to trust the result.

## Next step

Step 2 defines the canonical domain model: source, measure, collection result, verification result, evidence record, freshness state, publication decision and immutable edition.
