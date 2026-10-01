# Deployment and resource use

Reviewed against `.github/workflows/pr-validation.yml`,
`.github/workflows/deploy.yml` and the current Worker configuration on 1 October
2026. This document describes current workflows; it does not restrict the
user-authorized publication reinvention.

## Pull request checks

`pr-validation.yml` classifies documentation-only work separately. Code PRs run
the `full-quality` job (root npm install, lint, unit/Worker tests and a Next
build). A distinct non-blocking Lighthouse job independently installs/builds
the application and uploads its report. Lighthouse is outside the required
`quality` result. The full-quality and Lighthouse jobs therefore do duplicate
build work on a code PR. Change this only with measured review of gate coverage.

## Production release

On a relevant push to `main`, `deploy.yml` installs both locked root and
worker-local npm toolchains, validates source, prepares assets, performs one
OpenNext build and deploys the web Worker. It reconciles the Queue, then deploys
and verifies the data Worker. A following bootstrap/readiness step runs on
**every push**; its bounded timeout is 420 seconds (7 minutes). The full job has
a 15-minute timeout. A reader-route/revision check follows.

Manual dispatch can separately bootstrap publication or rebuild/deploy the
secondary Cloudflare Pages seed. Pages is the fallback, not the request-time
web application. Automatic deployment occurs after an authorized merge/push to
the release branch; the workflow must not be run manually by development work
unless production release is explicitly approved.

## Free resource accounting

Cloudflare plan limits change and must be confirmed from current official
documentation and account settings before claiming Free-tier readiness. Derive
Worker requests, CPU, Queue messages/retries, KV reads/writes/storage, artifact
size and egress from actual schedules and traffic. Existing Worker budget
constants are subject to review; do not treat them as quota evidence.

Upstream collection has a source-specific trusted NHS GitHub Actions importer
because the NHS origin challenges Cloudflare egress. Reuse its existing
reconciled parser and publication path. Confirm the runner/account free
allowance and successful publication readback; do not add a paid executor.

GitHub Pages must remain disabled. Public hosting/runtime is Cloudflare Free.
