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

## Free resource accounting

Cloudflare plan limits change and must be confirmed from current official
documentation and account settings before claiming Free-tier readiness. Derive
Worker requests, CPU, Queue messages/retries, KV reads/writes/storage, artifact
size and egress from actual schedules and traffic. Existing Worker budget
constants are subject to review; do not treat them as quota evidence.

The NHS importer recently received an upstream access challenge from its
GitHub runner. Treat retrieval as unverified until an allowed primary-source
path successfully publishes reconciled data. Do not bypass access controls or
add a paid executor.

GitHub Pages must remain disabled. Public hosting/runtime is Cloudflare Free.
