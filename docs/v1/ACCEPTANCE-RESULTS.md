# V1 acceptance results

**Purpose:** actual verification output and open defects. Wave sequencing lives in [MASTER-DELIVERY-PLAN.md](MASTER-DELIVERY-PLAN.md).

## Wave 0 verification state

| Check | Result | Evidence / limitation |
|---|---|---|
| Repository and historical-plan review | Pass with open findings | A01 inventory, A02 architecture review, A03 visual review and A14 baseline audit completed. Detailed decisions/gaps are recorded in the inventory and architecture records. |
| Production routes and contracts | Partial pass | Core page/feed routes returned 200 at audit time; health is degraded; procurement/international and Pages seed endpoints returned 503. An HTTP 200 offline shell is not a populated journey. |
| Primary-source review | Partial pass | Debt values reconciled against ONS HF6W/HF6X and bulletin. Other families remain held and lack full deployed source-to-screen proof. |
| Local unit suite on candidate commit | Pass | On `e48a71a13056ac3be02db15262472adab8d58ecc`, `npm test` exited 0: 175 files and 1,127 tests passed. Repeated jsdom canvas `getContext` warnings were non-fatal. |
| Local browser journeys on candidate commit | Partial pass | `npm run test:e2e` exited 0: 28 passed, 12 deployment-only tests skipped without a production base URL. Desktop/mobile local smoke, keyboard search/trust pages, held states and responsive checks passed. |
| Lint and toolchain on candidate commit | Pass with warning | `npm run toolchain:check` and `npm run lint` exited 0. Lint reported 0 errors and 1 warning: anonymous default export in `worker/offline-pages-entry.js`. |
| Static architecture and source ownership checks | Pass | `node scripts/check-static-architecture.mjs` checked 6 public routes; `node scripts/check-source-ownership.mjs` reported 12 active sources, 5 withdrawn sources and 5 withdrawn routes. The latter emitted a non-blocking Node module-type warning. |
| Production build mode | Prior pass; not rerun in A14 | `docs/operations/revamp-progress.md` records `STATIC_EXPORT=true npm run build:check` and OpenNext Webpack build passing on 12 October. A14 did not rerun because `build:check` writes a tracked generated module. |
| Hosted quality check | Not run for candidate | Existing passing PR checks do not cover the V1 candidate revision. |
| Candidate deployment | Not performed | Candidate is not the production revision. No release is claimed. |
| Data-family activation | Not authorized | Holds remain in place. |

## Known defects and acceptance gaps

| Severity | Finding | Status / Closure evidence |
|---|---|---|
| High | Public snapshot says degraded while omitting missing required NHS; health names `nhsStats`. | **Resolved**: `contracts/publication-policy.js` preserves `missingRequiredSections` on degraded snapshots; verified by unit and worker suites. |
| High | Pages recovery can serve an old candidate projection without reapplying today's publication holds (PR #214 code path). | **Resolved**: `fetchSeedSnapshot` in `public-data-entry.js` and `queued-publication-entry.js` filters Pages seeds through `filterPublicationSnapshot`; strips held sources and rejects all-held seeds. Verified in worker tests. |
| High | Publisher/archive use multiple KV writes; interruptions can leave edition index/detail/public state inconsistent. | **Resolved**: Implemented staged publish-after-write with atomic `PUBLICATION_COMMIT_KEY` manifest linking public artifact and internal edition, plus rollback protection on interrupted writes; verified with failure simulation and clean retry recovery in `tests/worker/cloudflare-publication.test.ts`. |
| High | Collection fragments are shared per section, not scoped to a run. | **Resolved**: Scoped section fragment KV keys to active runId (`${RUN_PREFIX}${runId}:section:${section}`) with fallback to shared prefix; cross-run isolation verified in `tests/worker/partial-publication-finaliser.test.ts`. |
| High | Pages seed withdrawal only occurs when all evidence sources are disabled, leaving a transition where one source is newly held while a prior seed remains deployable. | **Resolved**: `filterPublicationSnapshot` strips newly-held evidence and marks required sections missing in `public-data-entry.js` and `queued-publication-entry.js`; verified in `tests/worker/cloudflare-public-api.test.ts`. |
| Medium | Debt measure validity extends beyond the announced next ONS release; top-level catalog validity is shorter than measure validity. | Reconcile source publication clocks and verify currentness after 21 October 2026 release or failure (Wave 3). |
| Medium | Production has only debt measures; P02/P03 routes therefore lack the required breadth of populated journeys. | Feature acceptance using verified, approved source families (Wave 2/3). |
| Medium | Authored story routes are enabled in the candidate but their content/evidence review is open. | Editorial and fact-check sign-off before integration/publication (Wave 2). |
| Medium | Historical shared-chart/no-JavaScript work is incomplete: current `ClientOnlyChart` server fallback is a loading skeleton. | **Resolved**: `ClientOnlyChart` updated with `fallbackContent` and accessible static fallback frame (`aria-busy="false"`) pointing to SSR data tables without false loading pulses; verified in `tests/unit/ClientOnlyChart.test.tsx` and full suite. |
| Open | Ten full production journeys, all-ten accessibility, performance, security and rollback acceptance have not been completed. | Wave 2–5 evidence and A14 sign-off. |

The MagicPath review recommends “The evidence desk” as the P01 visual grammar, with selective typography and discovery elements from the other directions. The board is a static concept and does not satisfy production, responsive or accessibility acceptance.

## Per-capability gate

No priority is marked complete until its functional, browser, evidence, production and named independent sign-off fields are all recorded in `RELEASE-READINESS.md`. As of the observed baseline, **0/10** have full production acceptance. Do not convert an unavailable state into a passed capability.
