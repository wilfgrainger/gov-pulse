# V1 release readiness

**Observed baseline:** 12 October 2026, approximately 10:17 UTC. Recheck all live state immediately before release; this record is dated evidence, not a current dashboard feed.
**Launch decision:** **Not ready.** No V1 release candidate has passed the final acceptance matrix.

## Capability dashboard

| Capability | Implemented | Local | Production | Evidence approved | Independent sign-off |
|---|---|---|---|---|---|
| P01 Editorial design | Yes, partial | Partial prior checks; fresh assurance pending | Partial chrome only | Displayed claims must be reviewed | No |
| P02 Measure atlas | Yes | Reported implementation checks; fresh assurance pending | Partial; debt only | Debt only | No |
| P03 Comparison studio | Yes | Reported implementation checks; fresh assurance pending | Partial; two debt measures only | Debt only | No |
| P04 Briefings/stories/RSS | Yes | Partial | Debt feed/archive partial | Stories pending editorial review | No |
| P05 Calendar/watchlist | Yes | Partial | No verified populated events | None | No |
| P06 Cost of living | Yes | Partial | No; families held | None | No |
| P07 Polling | Yes | Partial | No; held | None | No |
| P08 Public money | Yes | Partial | No; held | None | No |
| P09 International | Yes | Partial | No; held | None | No |
| P10 Provenance/archive | Yes, partial | Partial | Debt archive only | Debt only | No |

## Release evidence

- The latest production deployment receipt and historic verification are recorded in [revamp-progress.md](../operations/revamp-progress.md). Verify the exact deployed SHA and current CI checks again for every release; the V1 candidate had no hosted quality result or deployment during this audit.
- The dated route and health observations are recorded in the operations ledger and evidence register. Recheck the required routes and public contracts against the exact candidate SHA before release.
- The current metrics snapshot published national debt only. Other families remain held. No new publication activation is approved by this record.
- The user brief and architecture review give PR #213 and PR #214 distinct review constraints; neither is blanket-approved for integration. Recheck their current state and required checks before an integration decision.

## Blocking decisions and defects

1. Obtain the hosted required `quality` check for the exact candidate revision. Local unit, lint, toolchain, static checks and available browser journeys passed; 12 production-only browser checks were skipped without a production base URL.
2. Resolve snapshot/health missing-manifest semantics.
3. Prevent stale Pages seeds and all alternate surfaces from bypassing current publication policy.
4. Establish run-scoped evidence and a failure-safe edition commit protocol.
5. Complete all ten populated reader journeys and source-specific verification.
6. Obtain explicit user authorization separately for each evidence family selected for activation.
7. Complete A14 accessibility, security, performance and failure-injection review.
8. Verify deployment SHA, public routes, rollback and post-release monitoring.

## Required release checklist

- [ ] All ten capability rows satisfy the master-plan acceptance matrix.
- [ ] Source/provenance review and publication state are recorded per family.
- [ ] No unresolved critical or high-severity issue.
- [ ] Required repository `quality` workflow passes on the exact candidate revision.
- [ ] A14 signs off functional journeys, evidence correctness, accessibility and release risks.
- [ ] Deployment publishes the approved SHA and its health/public contracts match the release record.
- [ ] Any source activation has explicit, family-specific user authorization and post-activation verification.
- [ ] Rollback/recovery route is tested outside production and handover instructions are complete.

## Rollback and handover

Use the repository's controlled release workflow to restore the last known-good code revision; verify the deployed SHA and public routes after rollback. Evidence recovery is a separate operation from code rollback: do not overwrite valid evidence with failed or empty collection output. Preserve the prior immutable edition and publication decisions until a reviewed correction is committed. Record the exact operator commands, contact/ownership roles, source limitations and recovery outcome at release time.
