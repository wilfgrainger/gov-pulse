# Internal scheduled data Worker

## Security boundary

The Worker is an internal collection and diagnostic component. It is not part of the public website delivery path.

- `workers_dev = false` prevents a public `workers.dev` hostname.
- `preview_urls = false` prevents preview hostnames.
- No custom route is attached.
- The browser reads only the verified same-origin snapshot shipped with the static site.
- Deployment is manual and uses a scoped Cloudflare token stored in GitHub Actions secrets.

## Responsibilities

The Worker retrieves supported public sources on its four-hour cron, applies source freshness contracts and stores accepted records in the existing `METRICS_CACHE` KV namespace. Its HTTP handlers remain useful under local Wrangler development for diagnostics, but production has no public ingress.

## Local development

```bash
npm run worker:dev
```

Local diagnostic handlers include health, registry, metrics and refresh views. They must not be exposed by adding a public route without an explicit security review.

## Deployment

```bash
npm run worker:deploy
```

The `Deploy private scheduled data worker` workflow is manual. It deploys with Wrangler and checks the recorded deployment version; it does not probe a public endpoint.

## Operational guardrails

- Cron runs in UTC and refreshes are idempotent.
- KV is eventually consistent and is not used by the public browser.
- A successful retrieval does not prove that a source published a new observation; each source contract still validates period, provenance and acceptable age.
- Do not add a public Worker route, browser Worker URL, second data service or paid Cloudflare product without an explicit architecture decision.
