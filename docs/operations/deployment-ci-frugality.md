# Deployment CI frugality

## Normal production release

One environment-gated job installs each locked toolchain once (root npm dependencies and the worker-local OpenNext adapter), runs lint and repository unit/Worker tests, prepares generated assets, compiles the application once with OpenNext, and deploys the web and data Workers. Cloudflare credentials are scoped to the individual deployment steps. No Actions artifact upload or browser installation is required.

A bounded smoke probe checks the exact revision on the homepage and GDP topic and validates the health endpoint. An honest `ready: false` response is reported as degraded evidence; transport errors, malformed health responses, wrong revisions and broken routes fail the probe. Source availability is not confused with application deployment success.

Production concurrency queues a newer release behind an already running deployment, avoiding cancellation between the web and data Worker steps. Pull-request runs still cancel superseded validation.

## Removed from the ordinary release path

- A second checkout and duplicate root/adapter dependency installations.
- Duplicate Next.js/OpenNext builds and the redundant pre-adapter server build.
- Static Pages seed compilation on every normal code release.
- Automatic collection/bootstrap polling for up to 12 minutes.
- Overlapping full-site, snapshot-canary and repeated download probes.
- YAML assertions requiring those redundant deployment steps.

The default path now has one application compilation instead of up to five. There are two dependency installations total (one per distinct toolchain) instead of four. These are structural counts, not measured wall-clock speedups.

## Pull requests and diagnostics

Pull requests retain source/architecture guards, lint, repository tests and a Next.js application build. The production release validates the pinned Cloudflare adapter. Browser tests remain available with `npm run test:e2e`; full production diagnostics remain available through `scripts/verify-production.mjs` and `npm run test:live`. They do not gate every routine deployment.

Vitest explicitly discovers only `tests/unit` and `tests/worker`. It must not execute tests shipped inside `worker/node_modules`, an issue that previously pulled in unrelated Next.js, Wrangler and blake3 test dependencies.

## Recovery and fallback

The existing daily Cloudflare Cron/Queue pipeline owns recurring collection. Manual dispatch offers `refresh_evidence` for bootstrap recovery and `refresh_pages_seed` to update the secondary Pages fallback. Neither runs by default. The fallback retains its currentness/expiry boundary, so an old seed cannot impersonate current data. Refresh it explicitly after source recovery when a usable backup is desired.

Keep GitHub Pages disabled. No DNS change, data migration, paid product or credentials change is part of this simplification. Revert the workflow commit to restore the prior release procedure.

The GitHub cost-report utility remains available for measurement; the workflow does not claim to run it automatically.
