# Deployment and resource use

Reviewed against the workflows and Worker configuration during publication
reinvention round two. This document describes current delivery behavior; it
does not restrict product scope.

## Pull request checks

`pr-validation.yml` sends Markdown-only changes through text checks without
installing dependencies. Code and executable configuration changes
run source/architecture guards, one root npm install, lint, unit/Worker tests
and one Next build. The required `quality` result reflects the selected lane.
Lighthouse is opt-in through `lighthouse.yml`; it builds only when explicitly
requested.

There is no CI maximum for changed-file count, concern groups or added lines.
Machine-readable and executable files do not qualify for the Markdown-only
lane. Lockfile-only changes run the same locked install, tests and build as
other code changes.

Equivalent runs reduced aggregate runner time from 235 seconds to 122 seconds
(48.1%); end-to-end PR time remained 135 seconds. The latest measured quality
job took 114 seconds: unit/Worker tests 51 seconds, app build 16 seconds, lint
13 seconds. Task 1 of the active round-two plan profiles overlapping these
independent checks without dropping coverage or repeating installs/builds.

## Production release

The `quality` PR result is required by the `main` branch ruleset. A merged PR
therefore carries the source checks, tests and application build used to gate
that release. On a relevant push to `main`, `deploy.yml` installs both locked
root and worker-local npm toolchains, prepares assets, performs one OpenNext
build and deploys the web Worker. Manual deployments run the source checks.
It reconciles the Queue, then deploys
and verifies the data Worker. It then checks the deployed revision, reader
routes and health contract without waiting for source collection. The full job
has a 15-minute timeout.

Manual dispatch can run a separate evidence-recovery job after deployment or
rebuild/deploy the secondary Cloudflare Pages seed. Recovery failure remains
visible on its own job and cannot skip or invalidate the completed code release
checks. Runtime data collection and KV publication continue independently.

## Runtime and cost accounting

Cloudflare is the current platform, not a Free-only requirement. Derive requests,
CPU, Queue messages/retries, KV reads/writes/storage, artifact size and egress
from actual schedules and traffic. Compare viable platforms using current
official limits, account configuration, reliability, operating burden and full
cost. Existing Worker budget constants are subject to review; do not treat them
as quota evidence. Get user approval before incurring paid spend.

The NHS importer recently received an upstream access challenge from its
GitHub runner. Treat retrieval as unverified until an allowed primary-source
path successfully publishes reconciled data. Do not bypass access controls or
add a paid executor.

The current deploy workflow targets Cloudflare Workers, with Pages as an
explicit fallback. Another platform is allowed when the product case supports a
coordinated migration and one canonical public route. Do not run competing
production deployments for the same public identity. The current host checker
still asserts Cloudflare-specific deployment steps; the round-two plan replaces
that assertion with the selected-host contract before enabling a different
target.
