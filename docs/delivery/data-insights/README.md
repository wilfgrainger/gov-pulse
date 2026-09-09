# Data, insights and lean delivery

## Outcome and acceptance

Make verified UK statistics easier to find, compare and reuse, and remove repeated work from code releases. Preserve source-specific dates, geography, missingness, free Cloudflare hosting, and the existing public contracts. No production migration or new paid service.

Acceptance: one installation per toolchain and one application compilation per normal deployment; no browser matrix or upstream collection wait in the normal release path; a searchable, filterable explorer exposing the existing underlying measures with direct sources, measured periods, history, comparisons and downloadable rows; regression proof for statistical publication lag and unsupported comparison claims.

## Review findings and decisions

1. **High — observation and publication clocks disagree.** `applyObservationContracts` accepts a statistical release based on publication age, but `sectionCurrentness` expires its output based on the older observation date unless it includes `expiresAt`. Migration and lagged GDP/employment data can be accepted on collection and rejected on delivery. Emit the existing explicit expiry contract from the verified release date. Keep retrieval limits and original observation dates; do not extend evidence age merely because a collector ran. NHS already emits publication-based expiry and is not explained by this particular defect.
2. **High — code deployment is coupled to external data readiness.** Deployment bootstraps and polls for up to 720 seconds, then performs overlapping full-site/data checks. An upstream outage can mark a successfully deployed application failed. Use a small revision/route smoke check on release. Report data degradation separately; retain explicit manual recovery and the thorough diagnostic verifier.
3. **High — repeated builds and dependency installation.** Two deployment jobs discard validated outputs and reinstall both toolchains. Next.js is built repeatedly for static seed, validation, server preparation, OpenNext and fallback. Consolidate ordinary production work in one environment-gated job, build with OpenNext once, and refresh the secondary Pages seed only on requested recovery. No Actions artifact storage.
4. **Medium — tests enshrine deployment ceremony.** The publication-order test reads YAML as text and requires redundant builds and waits. Replace those implementation-mirroring assertions with behavior tests for the bounded smoke checker. Retain data/parser/currentness tests. Browser tests and full diagnostics remain available explicitly.
5. **Medium — the homepage hides useful data.** Eight fixed headline slots exclude receipts, vacancies, employment, inactivity, migration flows and detailed waiting-time measures already represented by collectors. Add a common explorer over source-owned measures; it must never fill gaps with example numbers.
6. **Medium — missing change can become an unchanged claim.** NHS and migration summary branches conflate null comparison with zero. Render comparison unavailable; zero remains a genuine unchanged result.
7. **Medium — freshness expires in open tabs.** Cached browser snapshots and retained initial results can outlive validity while remaining visible. Reapply currentness at cache reads and on failed refresh.
8. **Medium — product framing dominates the first screen.** The large introductory hero, giant lead figure and repeated editorial explanation delay inspection. Compact the opening and expose the explorer and latest figures immediately.
9. **Medium — operational documentation contradicts workflows.** The frugality document claims immutable artifact handoff, scheduled Actions and browser setup that no longer exist. Replace with actual run paths and honest structural counts.
10. **Follow-up — collectors and coverage.** Local GDP, labour-market and economic-series probes returned valid current source data while production lacked those sections. This narrows the fault to publication/delivery or deployed collector behavior, but does not prove every production failure's cause. NHS/source failures require private runtime diagnostics. Missing topic families include housing, earnings, poverty, education, energy and environment; admit each only with a complete primary-source contract and refresh ownership.

## Architecture and alternatives

Preserve Next.js/OpenNext and the isolated Cloudflare data Worker. A static rewrite would simplify serving but reintroduce divergent browser/crawler currentness and require deployment migration. A new API/database would duplicate existing data ownership. The selected minimal design adds a read-only typed projection and explorer to the current request-time snapshot, without new infrastructure or cross-origin browser requests.

The explorer treats each measure independently. Search and filters operate on labels, topic and geography. History uses published points, retains units and omits absent values. Comparisons show absolute differences and a percentage only with a positive baseline, never a synthetic national score. CSV exports include provenance and dates. Expired or unsupported measures remain unavailable.

## Delivery and recovery

Editor/integration owner: Codex. Sequential Graphite Mountain lenses: product acceptance, architecture, complete user journey, failure/security, claims, simplification. Changes are prepared on a dedicated branch. Production remains untouched until release is authorised. Revert the branch commits to restore code behavior; no data migration is required. The existing manual bootstrap and Pages fallback tools remain recovery paths. A deployment smoke failure requires inspecting the identified revision and route; an unavailable upstream is an evidence incident rather than proof of a failed code deployment.

## Verification

Record actual focused tests, lint and production builds at handoff. Structural reductions are not measured runtime savings. No claim of production recovery until the changed Worker is deployed and its public edition inspected.

### Recorded checks

- Full owned test suite: 511 tests across 100 files at the first clean full run; subsequent source-link regression tested separately.
- Production OpenNext Worker build and deterministic Pages seed build completed locally; both include the new explorer route.
- Lint, architecture, source-ownership and source-repair guards completed locally.
- Independent review corrected fractional percentage-point formatting, health-probe error handling and debt-ratio source attribution.
- Local end-to-end collector/publication probes accepted GDP, employment, economic indicators and migration with the revised expiry contract. This is not a production recovery claim.
- The environment uses Node 24.19.0/npm 11.9.0, while CI retains the pinned Node 24.17.0 toolchain. Broad standalone TypeScript checks include existing test-type errors; the production application builds type-check successfully.
- No browser automation or production deployment was performed. NHS production collection and newly added topic families remain explicit follow-up work; the explorer exposes existing source measures, not 27 newly acquired datasets.
