# Deployment CI frugality

The current workflows keep assurance and Cloudflare mutation separate without pretending that GitHub Actions is a recurring evidence collector.

## Execution jobs

Pull Request Validation has one policy/classification job and one full-quality job. The full lane installs the root lockfile once, audits production dependencies, runs governance and architecture guards, lint, unit/Worker tests, the deterministic Pages build, the locked OpenNext build and deterministic browser journeys. It has no Cloudflare credentials.

Deploy public-data.org repeats validation/build in a credential-free job, then installs locked dependencies in one environment-gated production job. That job reconciles the Queue, deploys/verifies the data Worker, bootstraps publication, deploys/verifies the request-time web Worker and rebuilds/deploys the Pages seed from a verified current publication after the live production gate. No workflow artifact handoff is required for source or build output.

## Preserved boundaries

- Cloudflare credentials remain available only to the production deployment job.
- GitHub Actions has no scheduled recurring collection workflow.
- Source collectors run in Cloudflare Cron and Queue under bounded contracts.
- The static seed build and request-time OpenNext build are both verified before deployment.
- Browser, route, revision, health, national snapshot and comparison checks remain distinct evidence claims.
- If Actions history is inspected for cost, unknown values remain unknown; the workflow never invents a baseline.
