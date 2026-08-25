# Cloudflare Workers runtime boundary

public-data.org has two Workers with deliberately different responsibilities:

- `public-data-web` is the request-time OpenNext application Worker for `public-data.org/*`.
- `pulse-data-worker` is the data and publication Worker. It owns only `/data/metrics-snapshot.json`, `/data/health.json` and `/data/international-comparison.json`.

Both configurations set `workers_dev = false` and `preview_urls = false`. The data Worker has exact zone routes and no collector or diagnostic route is attached. The web Worker serves application assets and request-time HTML; it does not expose Worker internals to browser code.

## Local checks

```bash
npm run build:check
npm ci --prefix worker
./worker/node_modules/.bin/opennextjs-cloudflare build --config worker/web-wrangler.toml
```

The Pages export remains useful for deterministic seed generation and fallback validation. It is not evidence that the custom domain is being served by Pages.

## Deployment

The production workflow is the supported deployment path. It requires `refs/heads/main`, installs locked dependencies, audits production packages, validates and builds, reconciles the Queue, deploys/verifies the data Worker, bootstraps publication, deploys the request-time web Worker, and runs the production verifier. Manual dispatch is recovery-only.

Cloudflare credentials stay in environment secrets. Never put them in Wrangler output, logs, source, issues or evidence records.
