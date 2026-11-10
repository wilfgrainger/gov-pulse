# V1 release readiness

**Observed baseline:** 10 November 2026, 07:50–10:30 UTC, against production revision `c92585684e25ff052d8290d36c6bcc59df4aa73c`. Recheck all live state immediately before release; this record is dated evidence, not a current dashboard feed. The 12 October baseline it replaces is in git history.
**Launch decision:** **Not ready.** Four capabilities have held evidence or page gaps, the live site intermittently returns Error 1102, and no independent sign-off or rollback exercise is recorded.

## Capability dashboard

"Production" is the result of the 10 November independent audit of the live site (about 150 page loads) and the browser suite run against production. "Fix PR" lists open, unmerged pull requests; nothing in that column is deployed.

| Capability | Production result | Supporting evidence state | Open gap | Fix PR |
|---|---|---|---|---|
| P01 Editorial design | Pass with defects | Published | Phone-width overflow on `/explore/` and `/compare/`; charts paint one frame at 640 px; no skip link on trust, section and sources pages; no-JavaScript check finished for the home page only | #247 |
| P02 Measure atlas | Pass with defects | Published (33 measures) | Search and topic filter were not restorable from the URL | #255 |
| P03 Comparison studio | Pass with defects | Published | Redundant `observation_period` export column | #255 |
| P04 Briefings, stories, RSS | Pass with defects (briefing, RSS); stories held | Stories held (`product-hold`) | Briefing changes and the feed did not link to their edition; stories lacked the cited-edition link and honest dates | #255, #249 |
| P05 Calendar and watchlist | Held | `releaseCalendar`, `nhsReleaseCalendar` held | Source review passed (81 ONS and 5 NHS dates reconciled). ICS dropped announced times; no cross-edition date-change notice | #251 |
| P06 Cost of living | Pass | Published | None found | — |
| P07 Polling | **Fail** | Published | Only one current pollster live; More in Common rejected for fieldwork that crosses a month | #253 |
| P08 Public money | Pass with defects | Published | Placeholder treated as a supplier; CSV repeats a notice value per supplier; amendments and cancellations not seen (history load failed during 1102 errors) | in progress |
| P09 International | Held | `internationalComparison` held | Source review reconciled all seven measures. `/compare/` did not link to it; table export, year disclosure and caveats missing | #250 |
| P10 Provenance and archive | Pass with defects | Published (8 editions) | Trace from topic page to measure, source record and edition works; edition pages hit by 1102 errors | #252 |

Counts: 0 of 10 have named independent sign-off. 1 passes the production audit outright, 6 pass with defects, 1 fails and 2 are held.

## Release evidence

- **Deployed revision:** the `deploy.yml` run for `c925856` passed every step, including the deployed-revision, reader-route and publication-control checks. `/data/health.json` returned `{"status":"ready","ready":true,"held":["nhsStats"]}`.
- **Published families (11 plus the edition archive):** `electionPolling`, `nationalDebt`, `gdpTracker`, `sentimentPulse`, `taxRevenue`, `governmentContracts`, `employmentStats`, `crimeStatistics`, `migrationStats`, `housePriceIndex`, `realWages`, `editionArchive`.
- **Held:** `bettingOdds`, `nhsStats`, `earlyYears`, `releaseCalendar`, `nhsReleaseCalendar`, `internationalComparison`, `storyHouseholdBudgets`, `storyPublicFinances`.
- **Browser suite against production:** 26 passed, 12 failed, 4 skipped before the fixes above. The failures are the P01 defects, the held international journeys and two test-only locator faults.
- **Same-figure consistency:** CPI, unemployment, GDP, private rents and debt agreed across the home page, section page, measure page, `/explore/`, the snapshot and the section JSON.
- **Hosted `quality`:** passed on #243, #244 and #245, which make up `c925856`.

## Blocking decisions and defects

1. **Error 1102 on the live site (high).** `public-data-web` renders evidence pages per visitor at 35–425 ms of CPU against the 10 ms free-plan limit; failing requests are killed with `exceededCpu`. On 10 November 9 of 12 pages returned 503 in one pass and recovered within minutes. #252 is a stopgap (a 300-second page cache). The durable options are the static-first delivery plan (owner gate G9; the CPU measurements are in `docs/operations/free-resource-budget.md`) or a paid Workers plan, which needs owner approval of the spend.
2. **National debt is one release behind.** Production shows August 2026 (93.8% of GDP, published 22 September). ONS published September (94.0%) on 21 October. #244 fixed the collector, and a local run on 10 November returned the September figure; the next daily collection should publish it. The stored record's validity ends on 14 November.
3. **Cache lifetimes above the 300-second cap.** The snapshot carried a stale-while-revalidate of about 30 hours and prerendered held notices a year-long `s-maxage` for requests without `Accept: text/html`. Fixed in #248, not deployed.
4. **Per-family activation decisions.** `releaseCalendar`, `nhsReleaseCalendar`, `internationalComparison` and the two stories each need explicit owner authorization after their fix PR merges. None is recorded.
5. **No independent sign-off (A14) is recorded for any capability,** and the 10 November audit could not finish the broken-link crawl, the no-JavaScript check beyond the home page, or the public-money release history, because of the 1102 errors.
6. **Rollback has not been exercised outside production.**
7. **Feed-architecture plan:** the pipeline cutover (Task 10, after #246) and stopping legacy writes (gate G4, not before 13 November and seven recorded clean dual-write days) are open. The daily divergence-log counts have not been recorded.

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
