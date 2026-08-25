# Cloudflare data plane implementation notes

Status: current for public-data.org 1.0.0. The request-time application Worker and the isolated data Worker are deployed from separate Wrangler configurations; Pages is a bounded seed/fallback.

## Cloudflare resources

- `public-data-web` serves `public-data.org/*` through OpenNext.
- `pulse-data-worker` owns the exact national snapshot, health and international comparison routes.
- `public-data-jobs` is the single serial Queue producer/consumer.
- `METRICS_CACHE` stores source fragments, run state, terminals, the canonical publication, the prepared public artifact and the isolated comparison publication.
- Cron runs at `17 3 * * *` for national/economic/procurement work and `47 */3 * * *` for betting markets.

## National storage keys

- `v12:publication:current` — canonical current publication read during migration and finalisation;
- `v14:publication:public` — pre-sanitised public body with generated and validity metadata;
- `v13:publication:run:<runId>` — run state and expected job manifest;
- `v13:publication:run:<runId>:terminal:<jobId>` — bounded terminal record for one Queue job;
- `v13:publication:run:<runId>:section:<section>` — run-scoped accepted section fragment;
- `v12:publication:history:<timestamp>` — expiring publication history;
- `v12:contracts:day:<date>` — expiring procurement shards;
- `v12:section:governmentContracts` — latest complete procurement record;
- `v1:international-comparison:current` — independently expiring comparison edition.

The version prefixes are compatibility boundaries for the existing KV namespace, not an invitation to read arbitrary keys. Public delivery exposes no key names.

## Publication behaviour

Run fragments include their `runId` in both key and value. The finaliser reads only the selected run, filters each record through its registered currentness policy, and writes the canonical publication and prepared public artifact after deriving the exact missing-required-section manifest. An incomplete run remains pending before its deadline; a deadline may produce a degraded edition but never changes a failed terminal into success.

The international comparison uses a seven-day refresh due guard and a seven-day public hard expiry. Its expiry is also reflected in HTTP cache headers. National and international readiness are intentionally independent.

## Deployment order

The production workflow runs from `refs/heads/main` only. After the locked validation and OpenNext build, it reconciles the Queue, deploys/verifies the data Worker, bootstraps national publication, queues comparison refresh independently, deploys the request-time web Worker, verifies live routes and only then refreshes the optional Pages seed.

## Acceptance boundary

Local tests prove source contracts and deterministic code behaviour. They do not prove Cloudflare credentials, Queue delivery, KV propagation, deployed Worker revision, production HTML, current public evidence or rollback. Those observations must be recorded separately during release operations.
