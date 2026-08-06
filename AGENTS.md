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

The product has two deliberately small planes:

1. Cloudflare Pages serves the static Next.js export built from `app/`,
   `public/`, `data/`, `contracts/` and the checked-in build configuration.
   The browser consumes the same-origin `/data/metrics-snapshot.json` contract;
   Pages owns section JSON/CSV downloads and normal site routes.
2. Cloudflare Worker `worker/public-data-entry.js` owns the runtime data plane.
   Its only public routes are `/data/metrics-snapshot.json` and
   `/data/health.json`; all other paths return 404. The Worker also receives
   Cron and Queue events but exposes no collector or operational route.

The Worker runs the Cloudflare Free plan schedule in `worker/wrangler.toml`: the daily
Cron (`17 3 * * *`) refreshes generic, external and procurement evidence; the
three-hour Cron (`47 */3 * * *`) refreshes betting markets. A single
`public-data-jobs` Queue runs one bounded job at a time with retry limits.
Workers KV (`METRICS_CACHE`) stores section fragments, run state and terminals,
the current publication, bounded history and the prepared public artifact.

The publication path is:

`Cron -> Queue jobs -> source collectors -> validation/normalisation -> KV
fragments -> run terminals -> finaliser -> atomic prepared public artifact ->
same-origin browser response`

Finalisation is run-scoped and idempotent. A run publishes only when every
required job succeeded and every included section passes its own wall-clock
currentness policy. A failed job remains pending until its bounded deadline;
it is not treated as successful merely because it has become terminal. If no
complete current artifact exists, the public route returns a generic 503 or a
validated Pages seed within the documented bounded fallback. Never publish a
partial or stale edition as ready.

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
the publication boundary.

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

The browser data contract is consumed by `app/lib/useMetrics.ts` and rendered
by the section components and `app/components/NationalEvidenceEdition.tsx`.
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

When a source, Queue, KV binding, publication artifact or Pages deployment is
unavailable, preserve the last verified artifact only inside its configured
window; otherwise show an honest unavailable state. A green build, a Worker
deployment or a DNS response alone is not a live-data claim. Claim production
only after exact-head checks and the affected public journey are observed.

## Delivery and verification

`main` is the release branch. `.github/workflows/pr-validation.yml` runs the
focused architecture/source guards, lint, unit and Worker tests, static export
and deterministic browser checks as appropriate. `.github/workflows/deploy.yml`
validates once, reconciles the Queue, deploys the Worker, bootstraps/verifies a
ready artifact, deploys Pages and verifies the exact revision, live snapshot
and Pages-owned downloads. Manual dispatch is recovery only.

Before handoff run the smallest falsifying test for the change, then the
affected Worker/component tests, lint, static production build, browser checks
and production verifier. Inspect `git status` and exact `HEAD`; preserve
untracked user files. Do not push, merge, deploy or delete material outside the
requested scope without explicit authority.

## Repository map

- `app/`: static Next.js routes, editorial components and browser contract use.
- `worker/`: Worker entrypoints, collectors, normalisers, currentness,
  publication finalisation, Wrangler configuration and Cloudflare bindings.
- `contracts/`: strict evidence and publication schemas.
- `data/`: checked-in source snapshots and static section downloads.
- `scripts/`: build snapshot, source discovery, diagnostics, release and
  production verification utilities.
- `docs/architecture/`: durable architecture decisions and source ownership.
- `.agents/PROGRESS.md`: current checked-out/live investigation only; it is
  deliberately volatile and is not a substitute for this guide.

Retired concepts include wildcard Worker APIs, direct browser collectors,
routine scheduled GitHub data retrieval, synthetic national scores, combined
crime totals, withdrawn visualisations and the old multi-file hourly-agent
programme. Remove obsolete paths rather than documenting them as active.
