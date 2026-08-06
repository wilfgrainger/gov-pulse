# Deployment CI frugality

## Structural baseline before issue #201

A normal push to `main` used four isolated jobs and therefore ran:

- `npm ci` four times: quality, E2E, build and production verification;
- Playwright/browser dependency setup three times: E2E, publication build and production verification;
- `apt-get update` once inside the publication build.

A scheduled refresh skipped quality and E2E but still ran `npm ci` twice and browser/extractor setup twice.

## Consolidated design

The workflow now has two execution jobs:

1. **Validate and build** — one dependency install, one browser/extractor setup, conditional lint/unit/E2E on pushes, source preparation, snapshot assembly and static export.
2. **Deploy and verify** — one dependency install, deployment credentials isolated to this job, exact artifact deployment, revision/snapshot verification and the production mobile journey.

For push deployments this halves dependency installation from four to two and reduces browser/extractor setup from three to two. Scheduled refreshes retain the two isolated setup boundaries because the deployment/verification job must remain separate from untrusted source retrieval and static building.

## Runtime measurement

Every deployment run queries recent completed push and scheduled runs through the GitHub Actions API and records:

- median workflow duration;
- median total `npm ci` step time;
- median browser/extractor setup time;
- sample count for each event type.

The report is written to the workflow summary by `scripts/report-deploy-workflow-cost.mjs`. If Actions history cannot be read, it records `unknown` rather than inventing a baseline.

## Preserved boundaries

- Cloudflare credentials remain available only to the deployment job.
- The static export is uploaded as an immutable workflow artifact and downloaded by the deployment job.
- Pushes still require lint, unit/Worker tests, deterministic E2E and static export.
- Scheduled runs still rebuild current evidence and fail closed under the existing source contracts.
- Post-deployment revision, snapshot and Pixel 7 checks remain mandatory.
