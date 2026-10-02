# public-data.org working guide

## Product scope

Build an ambitious, FiveThirtyEight-inspired UK evidence publication. The active
round-two objective and execution sequence are in
`docs/superpowers/plans/2026-10-02-publication-reinvention-round-2.md`. Its ten
priorities are the product scope. Earlier plans, audits and design documents
are historical context, not competing instructions. Architecture descriptions
in this guide describe the current implementation; change them when the product
needs a better design.

Keep public evidence accurate and useful. Claims identify what was measured,
period, geography, unit, publication date, primary source and material caveat.
Distinguish new observations from revisions. Missing, stale, incomplete or
unreconciled evidence is unavailable, never zero, interpolated or invented.
Keep official statistics, administrative data, polling and market signals
separate. Do not publish a synthetic crime total, overall country score, or
claims of waste/fraud/corruption without direct evidence. Comparisons disclose
their universe, periods, units, basis and missingness.

The visual direction may be bold and colourful. Retain semantic HTML,
keyboard access, visible focus, readable contrast, text alternatives, mobile
reflow and reduced-motion behavior. Use observed publication points; do not
smooth away gaps or combine incompatible measures.

## Architecture and data

The current production app is a request-time Next.js application on a Cloudflare
Worker built with OpenNext. A separate data Worker serves public contracts
listed in `contracts/public-surfaces.json`; keep collectors, operational
routes, Queue state, KV keys, credentials and private diagnostics out of public
responses. Cloudflare Pages is a bounded static fallback, not the main app.
These boundaries can evolve with the product when contracts and deployment are
updated together.

`worker/feed-registry.js` owns source membership and retrieval policy.
Contracts own public shapes. Collectors treat downloaded content as untrusted:
use approved HTTPS sources, bounded retrieval, strict parsing, identity and
shape checks, source reconciliation and separate observation/publication
clocks. Public currentness follows the source's actual validity. Keep
publication writes bounded, run-scoped and idempotent; a failed job never
becomes successful just because retries end. Preserve older evidence only
within its original validity window.

Cloudflare is the current host, not a permanent platform ceiling. Choose the
runtime that best serves the product and evidence workload; measure real limits
and compare alternatives when needed. Do not commit paid spend without the
user's approval of the cost. Protect credentials in repository/environment
secrets. Do not add tracking or personal-data collection without an explicit
need and authorization.

## Working and delivery

Deliver the complete user-requested outcome. Keep implementation clear and
maintainable, but do not use simplicity, token economy or process as a reason to
shrink design ambition, defer features, or limit architecture, routes, files,
measures or validation. This repository's Cave Pony guidance controls response
length only. No agent persona, team, recurring review ceremony or fixed commit
cadence is required.

Run checks that meaningfully cover changed behavior and the affected production
build mode. The required code gate is the quality aggregate in
`.github/workflows/pr-validation.yml`; optional browser, Lighthouse and
exhaustive production checks run when the affected change warrants them. Normal
code release verifies the exact deployed revision, public routes and health
contract. Source collection/recovery is a separate operation: valid degraded
evidence does not by itself invalidate deployed code. See
`docs/operations/deployment-ci-frugality.md` for current commands.

`main` is the release branch. Preserve user files. Never expose secrets or
commit volatile PR/deployment snapshots as durable docs. Do not push, merge or
deploy outside the user's requested scope; when requested, complete the
applicable exact-head and affected-journey checks before claiming success.

## Repository map

- `app/`: routes, editorial components and browser contracts.
- `worker/`: web/data Workers, collectors, normalizers and publication logic.
- `contracts/`: public evidence, route and ownership contracts.
- `data/`: checked-in source snapshots and static section downloads.
- `scripts/`: build, diagnostics, release and verification utilities.
- `docs/architecture/`: current architecture decisions and source ownership.
