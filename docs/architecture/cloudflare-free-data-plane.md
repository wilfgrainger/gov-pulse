# Cloudflare Free data plane

Status: implementation prepared on `main`; production cutover requires one manual Worker deployment.

## Decision

Routine public-data.org collection and data publication run on the existing Cloudflare Worker, KV namespace, Cron Trigger and a single Cloudflare Queue. GitHub Actions are not part of the recurring data path.

The website remains a static Cloudflare Pages application. Its existing browser contract, `/data/metrics-snapshot.json`, is routed to the Worker. A new statistical observation therefore changes KV publication state without rebuilding or redeploying the Next.js application.

## Free products only

The data plane uses:

- Workers Free;
- one Cron Trigger;
- one Queue producer and one Queue consumer;
- the existing Workers KV namespace;
- Cloudflare routing for the exact snapshot path.

It does not use Workers Paid, R2, D1, Durable Objects, Browser Rendering, Workflows, paid Queues capacity or paid third-party collection services.

## Daily execution

At 03:17 UTC, one lightweight Cron invocation enqueues:

1. seven separate official-source section refreshes;
2. one government-contract refresh;
3. one publication job delayed by ten minutes.

The queue has a batch size and maximum concurrency of one. Each source is isolated in its own retryable invocation, rather than forcing collection and parsing through the 10 ms CPU budget of the Cron invocation.

Daily collection keeps the existing 36-hour retrieval-currentness contracts satisfied without using an hourly schedule. The publication job reads the accepted section fragments and the latest complete government-contract record, overlays them on the last verified snapshot and updates the current KV publication atomically from the reader's perspective. Failed sources do not erase their last verified values.

## Government contracts

Find a Tender is collected as complete UTC day shards:

- four six-hour slices per day;
- one page of at most 100 releases per slice;
- a 10.5-second minimum interval between requests;
- at most three missing days and 12 requests in one daily queue job;
- fail closed if pagination appears or a slice reaches the one-page boundary;
- ten-day shard retention in KV;
- publication only after seven consecutive complete days are present;
- exactly 100 unique comparable GBP awards in the final ranking.

The previous verified contracts record remains current until the canonical 72-hour contract expires. A large disclosed award is not labelled as waste, fraud or saving.

## Budget contract

The code publishes these maximum targets in snapshot metadata and enforces the bounded job plan:

| Resource | Designed daily use | Free allowance | Share of allowance |
|---|---:|---:|---:|
| Cron invocations | 1 | 100,000 Worker requests | 0.001% |
| Queue jobs | 9 | 100,000 Worker requests | 0.009% |
| Queue operations | 27 | 10,000 | 0.27% |
| KV reads | no more than 80 | 100,000 | 0.08% |
| KV writes | no more than 30 | 1,000 | 3% |
| Cron triggers | 1 | 5 | 20% of trigger count |

Expected normal use is lower because current official records are read from KV and only missing procurement shards are fetched.

The largest deliberate percentage is KV writes at 3% of the daily free allowance. There is no automatic path that upgrades the account or incurs an overage charge; Free-plan operations fail closed if a hard limit is reached.

## Feed treatment

Worker-safe official sources are refreshed daily:

- GDP;
- CPI, Bank Rate and unemployment;
- employment and vacancies;
- public receipts;
- national debt;
- long-term migration;
- modular crime evidence;
- Find a Tender government contracts.

Election polling and NHS RTT currently depend on primary PDF/repository ingestion. Betting markets depend on browser extraction. They are not moved to paid or fragile Cloudflare services merely to claim full automation. Their last verified snapshot can remain visible only inside its existing evidence-currentness contract; otherwise the section fails closed. A future collector must use a primary machine-readable source and fit this free-tier budget.

## Storage and retention

KV keys are versioned under `v12`:

- `v12:publication:current` — current canonical snapshot;
- `v12:publication:section:<section>` — accepted daily fragments;
- `v12:publication:history:<timestamp>` — 14-day expiring publication history;
- `v12:publication:status` — latest publication status and budget;
- `v12:contracts:day:<date>` — ten-day expiring procurement shards;
- `v12:section:governmentContracts` — latest complete top-100 contract record.

History and shard expiry is automatic and does not count as a billed KV delete operation.

## Delivery and rollback

The Worker deployment remains manual while GitHub Actions quota is constrained. The release command is:

```bash
npm ci
npm test
npm run worker:deploy
```

This must be run once from a trusted local environment with Cloudflare credentials, or through the manual-only Worker deployment workflow after Actions capacity is intentionally approved.

Rollback is a Worker deployment rollback. The Pages site and its static build are not changed by the data-plane cutover. Until the Worker version is deployed, the current Pages snapshot continues to serve production.

## Production acceptance

Before enabling the route:

- run the focused Worker and contract tests locally;
- deploy the Worker once;
- invoke the scheduled handler manually in local or preview testing;
- verify the Queue consumer writes `v12:publication:current`;
- request `https://public-data.org/data/metrics-snapshot.json` and validate its registry version and source metadata;
- confirm Pages HTML still contains its build-time last-verified evidence;
- observe daily Worker, Queue and KV usage for seven days and keep all dimensions below the budget table.
