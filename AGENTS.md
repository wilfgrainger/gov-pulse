# public-data.org repository guide

## Operating method

Use Graphite Mountain from `skills/graphite-mountain/SKILL.md` as the only
repository operating method. Follow its sequential review: Jared for outcome
and scope, Richard for architecture, Dinesh for the complete implementation
path, Gilfoyle for adversarial reliability and security, Jian-Yang for user and
operational challenge, and Erlich for final simplification. These are bounded
review lenses, not persistent personas.

## Mission and public promise

public-data.org is a calm, independent UK public-evidence service. Every public
claim must tell a first-time reader what changed, why it matters, what was
measured, the observation period and geography, the unit, the publication date,
the direct primary source and the material uncertainty or revision caveat.

Prefer official primary publications. Evidence is editorially separated by source class: official statistics,
administrative data, polling and market signals are not joined to manufacture a
trend. A missing, stale, incomplete, ambiguous or unreconciled value is
`null`/unavailable, never zero, a forecast, an interpolation or a synthetic
replacement. Fail closed when evidence cannot be proved. Crime Survey estimates, police-recorded crime and court measures
remain separate. Rankings require a complete universe, date window, currency
basis, exclusions and missingness. Spending is not labelled waste, fraud,
corruption or a saving without direct evidence. Never publish a synthetic crime total or a combined national score. Never publish a combined crime total.

Charts use publication points, explicit units, restrained colour, accessible
text alternatives and mobile reflow. Accessibility includes semantic HTML,
keyboard access and visible focus. Do not smooth, interpolate, decorate or
combine materially different units. Preserve semantic HTML, keyboard access,
visible focus and reduced-motion behaviour.

## Architecture

The product has three deliberately small delivery planes:

1. Cloudflare Worker `public-data-web`, built from the Next.js application with
   the pinned OpenNext adapter, owns normal `public-data.org/*` application
   requests. Evidence-bearing pages are rendered at request time so crawlers,
   link unfurlers, no-JavaScript clients and browsers receive the same
   currentness decision. Static application assets are served from the same
   Worker bundle.
2. Cloudflare Worker `worker/public-data-entry.js` owns the runtime data plane.
   Its only public HTTP routes are the more-specific
   `/data/metrics-snapshot.json`, `/data/health.json`, and
   `/data/international-comparison.json`; all other paths return 404. The
   application and browser consume these as same-origin public contracts; no
   collector or operational route is exposed.
3. Cloudflare Pages retains a bounded static seed/fallback export. It is not the
   normal application plane. The data Worker may use a validated Pages seed only
   inside the documented fallback boundary, and the deployment workflow keeps
   the seed current after a successful web deployment.

The data Worker runs the Cloudflare Free plan schedule in `worker/wrangler.toml`: the daily
Cron (`17 3 * * *`) refreshes generic, external and procurement evidence; the
three-hour Cron (`47 */3 * * *`) refreshes betting markets. A single
`public-data-jobs` Queue runs one bounded job at a time with retry limits.
Workers KV (`METRICS_CACHE`) stores section fragments, run state and terminals,
the current national publication, bounded history, the prepared public artifact,
and the isolated international comparison publication.

The national publication path is:

`Cron -> Queue jobs -> source collectors -> validation/normalisation -> KV
fragments -> run terminals -> finaliser -> atomic prepared public artifact ->
request-time public delivery`

Finalisation is run-scoped and idempotent. Before the bounded retry deadline, an
incomplete run remains pending. At the deadline, the finaliser may atomically
publish the fresh successful source-owned fragments even when another expected
job failed or never completed. The run remains recorded as incomplete and the
public edition is explicitly degraded when required evidence is missing. A
failed job is never re-labelled successful merely because the deadline elapsed.

Public delivery applies the same fail-closed currentness boundary. A degraded
edition must declare `meta.publicationState = "degraded"` and an exact
`missingRequiredSections` manifest. It may contain only current, source-owned
evidence: never retain an expired value, invent a replacement or label a
degraded edition `ready`. `/data/health.json` reports `ready: false` for a
degraded edition. A complete current prepared artifact reports `ready: true`.
If no current evidence remains, return the generic unavailable response or a
validated Pages seed within the bounded fallback.

International comparison publication is deliberately isolated from national
readiness. `worker/international-comparison-publication.js` writes the verified
comparison edition to `v1:international-comparison:current`; the public route is
`/data/international-comparison.json`. A seven-day due guard limits refreshes of
this slow-moving evidence family. Bootstrap queues its refresh independently
from the required national run, so a comparison-source failure can never block
or downgrade the UK national publication.

## Evidence registry and contracts

`worker/feed-registry.js` is the source-of-truth registry. Required sections
are `sentimentPulse`, `gdpTracker`, `employmentStats`, `nationalDebt`,
`taxRevenue`, `migrationStats`, `electionPolling` and `nhsStats`. Optional
sections are `bettingOdds` and `crimeStatistics`; government contracts is a
separate bounded publication source. Registry entries define publisher, source
class, geography, cadence, retrieval method, freshness policy and direct source
links.

Collectors discover the latest official edition, retain observation and
publication clocks separately, validate the source identity and shape, build
like-for-like history where the publisher supplies it, reconcile the headline
with the newest historical point and normalise through the section contract.
The public snapshot carries registry provenance, source URLs, generated time,
validity and section-level status. `worker/publication-currentness.js`,
`worker/publication-entry.js` and `worker/queued-publication-entry.js` enforce
the national publication boundary.

The international comparison contract keeps its own country universe,
measure-specific observation years, value status, primary source provenance,
missingness and ranking denominator. Countries without a genuinely comparable
observation are excluded from that measure's denominator rather than treated as
zero. The seven measures remain separate and are never combined into an overall
national score.

The external collectors are intentionally source-specific:

- YouGov polling uses the newest named voting-intention article and its primary
  result-table PDF; the 14-day publication window is retained.
- NHS RTT discovers the current annual page, press notice and time-series
  workbook, then reconciles headline, missing trusts and 120 months of history;
  the 45-day window is retained.
- Betting evidence is a complete three-market Oddschecker snapshot with a
  four-hour window and no normalised forecast.
- Crime evidence keeps ONS, Home Office and Ministry of Justice publications
  separate and fails closed when the named versioned publication is not whole.
- International comparisons use authoritative IMF, OECD, SIPRI and WHO/World
  Bank publications with measure-specific years and explicit
  historical/estimate/projection status.

The browser national-data contract is consumed by `app/lib/useMetrics.ts` and
rendered by the section components and
`app/components/NationalEvidenceEdition.tsx`. International comparison pages
consume their isolated request-time comparison publication. The root layout
supplies the request-time national server snapshot before client revalidation.
Do not make the browser call Worker internals, expose cache keys, or embed
secrets, account identifiers, private repository details or deployment routes.

## Security and failure boundaries

Treat downloaded HTML, JSON, CSV, PDF and spreadsheet content as untrusted input.
Use allow-listed HTTPS primary publishers, bounded response sizes/timeouts,
strict parsing and exact source reconciliation. Keep Cloudflare credentials in
repository/environment secrets; never print or commit their values.
Do not add Vercel, paid Cloudflare products, tracking or personal-data collection without
an explicit recorded need. Public errors are generic and operational details
stay in private logs.

When a source, Queue, KV binding, publication artifact, web Worker or Pages seed
is unavailable, preserve a previously verified value only inside its configured
window; otherwise remove it and show an honest unavailable/degraded state. A
green build, a Worker deployment or a DNS response alone is not a live-data
claim. Claim production only after exact-head checks and the affected public
journey are observed.

## Delivery and verification

`main` is the release branch. `.github/workflows/pr-validation.yml` runs the
focused architecture/source guards, lint, unit and Worker tests, deterministic
Pages seed build, pinned OpenNext Worker build and browser checks as appropriate.
`.github/workflows/deploy.yml` validates once, reconciles the Queue, deploys the
data Worker, bootstraps the required national run and independently queues the
comparison refresh, accepts a verified prepared degraded KV edition when the
national evidence is honestly partial, deploys the request-time web Worker,
verifies the exact revision and live snapshot, then refreshes the bounded Pages
seed. Manual dispatch is recovery only.

Before handoff run the smallest falsifying test for the change, then the
affected Worker/component tests, lint, both production build modes, browser
checks and production verifier. Inspect `git status` and exact `HEAD`; preserve
untracked user files. Do not push, merge, deploy or delete material outside the
requested scope without explicit authority.

## Repository map

- `app/`: Next.js routes, editorial components and browser contract use.
- `worker/`: data Worker entrypoints, web-Worker/OpenNext configuration,
  collectors, normalisers, currentness, publication finalisation and Cloudflare
  bindings.
- `contracts/`: strict evidence and publication schemas.
- `data/`: checked-in source snapshots and static section downloads.
- `scripts/`: build snapshot, source discovery, diagnostics, release and
  production verification utilities.
- `docs/architecture/`: durable architecture decisions and source ownership.
- `.agents/PROGRESS.md`: current checked-out/live investigation only; it is
  deliberately volatile and is not a substitute for this guide.

Retired concepts include wildcard data APIs, direct browser collectors, routine
scheduled GitHub data retrieval, synthetic national scores, combined crime
totals, withdrawn visualisations and the old multi-file hourly-agent programme.
Remove obsolete paths rather than documenting them as active.
