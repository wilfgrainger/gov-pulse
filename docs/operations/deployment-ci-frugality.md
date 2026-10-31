# Deployment and resource use

Reviewed against the workflows and Worker configuration during publication
reinvention round two. This document describes current delivery behavior; it
does not restrict product scope.

## Pull request checks

`pr-validation.yml` sends Markdown-only changes through a no-install
documentation lane; it runs no prose, encoding or newline gate. Code and
executable configuration changes run source/architecture guards, install the
root and OpenNext toolchains once each, run lint and all unit/Worker tests, then
build the deployable OpenNext artifact once (which compiles the Next app).
The required `quality` result reflects the selected lane.
Lighthouse is opt-in through `lighthouse.yml`; it builds only when explicitly
requested.

There is no CI maximum for changed-file count, concern groups or added lines.
Machine-readable and executable files do not qualify for the Markdown-only
lane. Lockfile-only changes run the same locked install, tests and build as
other code changes.

The previous workflow baseline measured 235 seconds of aggregate runner time
and 135 seconds end to end. The current workflow runs lint, tests and the single
OpenNext build in parallel after both locked installs; remeasure comparable PR
runs before claiming a new duration. Task 1 of the active round-two plan keeps
all checks while reducing duplicated setup and build work.

## Production release

The `quality` PR result is required by the `main` branch ruleset. A merged PR
therefore carries the source checks, tests and application build used to gate
that release. On a relevant push to `main`, `deploy.yml` builds and deploys
the web Worker and data Worker on separate runners. Each individual-Worker
token is injected only into its own deploy/metadata steps after locked
dependency installation. The existing Queue must already be provisioned;
routine CI has Queue Edit only in the separate manual recovery environment and
no Queue Read or create permission. Route bindings are dashboard-managed and
omitted from Wrangler config, so deployment does not need zone route-write
access. A credential-free verification job checks both deployments, reader
routes and health contract without waiting for source collection.

Manual dispatch can run a separate evidence-recovery job after successful
deployment or refresh the secondary Cloudflare Pages seed. Recovery uses its
own main-only GitHub environment with separate Queue Edit and account-scoped
KV Read tokens. The Queue ID and namespace ID pin the requests made by the
script; they do not reduce either Cloudflare token's account-wide authority.
Create those recovery tokens only for an actual recovery, give them short
expiry, and remove the GitHub secrets and revoke the tokens immediately after
the run. Pages publishing uses a main-only, project-bound Cloudflare deploy
hook instead of Pages Write. Recovery failure remains visible on its own job
and cannot invalidate a completed code release. Runtime data collection and KV
publication continue independently.

## Runtime and cost accounting

Cloudflare is the current platform, not a Free-only requirement. Derive requests,
CPU, Queue messages/retries, KV reads/writes/storage, artifact size and egress
from actual schedules and traffic. Compare viable platforms using current
official limits, account configuration, reliability, operating burden and full
cost. Existing Worker budget constants are subject to review; do not treat them
as quota evidence. Get user approval before incurring paid spend.

The NHS importer recently received an upstream access challenge from its
GitHub runner. Treat retrieval as unverified until an allowed primary-source
path successfully publishes reconciled data. Do not bypass access controls.
Evaluate another permitted retrieval path, including a paid executor, against
source terms, reliability, security and total cost; obtain approval before
incurring paid spend.

The current deploy workflow targets Cloudflare Workers, with Pages as an
explicit fallback. Another platform is allowed when the product case supports a
coordinated migration and one canonical public route. Do not run competing
production deployments for the same public identity. The PR architecture guard
checks Cloudflare data-plane ingress when its configuration is present and
always checks the provider-neutral public-surface manifest. It does not veto a
different runtime; deployment checks must move with any chosen host.
