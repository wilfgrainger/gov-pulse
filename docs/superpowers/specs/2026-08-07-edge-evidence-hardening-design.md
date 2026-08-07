# Edge Evidence Hardening Design

Date: 7 August 2026

## Outcome

Make public-data.org render current evidence at request time on Cloudflare while preserving the existing fail-closed data plane, and remove duplicated or retired code paths that can cause evidence or operational drift.

The public promise is unchanged: a value is only asserted when its source, observation period, publication clock, geography, unit and currentness are provable. Missing evidence remains missing rather than being substituted.

## Decision

Migrate the public Next.js application from a static Cloudflare Pages custom-domain frontend to a Cloudflare Workers-hosted Next.js application using `@opennextjs/cloudflare`.

Cloudflare currently recommends Workers for full-stack/SSR Next.js applications. The existing `pulse-data-worker` remains a separate, narrowly routed data worker for `/data/metrics-snapshot.json` and `/data/health.json`. The new web worker owns the remaining `public-data.org/*` routes. Cloudflare route specificity keeps the two data routes on the data worker.

Cloudflare Pages remains temporarily as the static seed origin used by the data worker during bootstrap and bounded outage fallback. It is no longer the production custom-domain frontend.

## Architecture

### Web plane

`public-data-web` runs the Next.js App Router through the Cloudflare OpenNext adapter.

Server-rendered pages read the current same-origin publication snapshot on every request with a bounded fetch and no application-level stale cache. The homepage and evidence section routes therefore render from the same current publication that the browser API exposes. A crawler, link unfurler or no-JavaScript user must never receive an expired build-time statistic merely because a Pages deployment is old.

The client may continue to revalidate after hydration, but the initial HTML must already be valid at request time.

### Data plane

`pulse-data-worker` remains responsible for Cron, Queue, source collection, source-specific validation, KV publication, `/data/metrics-snapshot.json` and `/data/health.json`.

The public snapshot may be in one of three publication states:

- `ready`: every required feed is current.
- `degraded`: the publication is valid but one or more expected feeds are explicitly unavailable; no stale value is asserted for those feeds.
- `unavailable`: no trustworthy public artifact can be produced.

A degraded publication is preferred to taking the entire evidence service unavailable because one upstream publisher changed format. Degradation never means retaining an expired value.

## Evidence registry

`worker/feed-registry.js` becomes the authoritative runtime evidence registry for active automated feeds. It owns publisher/source metadata, evidence class, geography, publication requirement, refresh cadence and retrieval-currentness window.

`worker/publication-currentness.js` derives retrieval currentness from registry policy instead of maintaining a second hard-coded map.

The application retains UI-only metadata in `app/lib/config.ts`, but removes the misleading inactive ONS and Bank of England source registries. Active upstream source identity must not be defined twice.

Source-ownership tests must prove that active sections, publication requirements and registry-backed currentness remain consistent.

## Retired code

`worker/index.js` is a retired implementation and must be deleted once repository references confirm it is not an active entrypoint. It contains obsolete `/metrics` and `/all` semantics, secondary polling collection and embedded fallback figures that conflict with the current evidence contract.

References, tests and documentation must point only to the live queued publication architecture.

## Rendering and currentness

Create a server-safe snapshot reader in the application layer. It:

1. fetches `/data/metrics-snapshot.json` from the canonical production origin in server runtime;
2. validates the payload with the existing metrics-snapshot compatibility contract;
3. returns `null` on timeout, network failure or invalid evidence;
4. never substitutes the generated build snapshot in production SSR.

Local development and deterministic tests may use injected fixtures or the generated build snapshot explicitly, but production request rendering does not.

The homepage lead-selection policy remains deterministic but is renamed and documented as a publication priority, not described as an editorial judgement based on recency.

## Production provenance

The public site and repository documentation must use gov-pulse as the active repository and must not reference retired gov-metrics deployment records as current evidence.

The site exposes non-secret publication provenance: application commit SHA, evidence registry version, publication generated time and publication state. Cloudflare account IDs, KV IDs, internal route details and secrets remain private.

`.agents/PROGRESS.md` is rewritten as a current handoff record and must not assert a production SHA unless that exact gov-pulse revision has been observed live.

## Deployment

The production workflow remains Worker-first:

1. validate repository;
2. deploy/reconcile the data worker and Queue;
3. bootstrap/verify a trustworthy publication;
4. build the OpenNext web worker;
5. deploy the web worker on `public-data.org/*`;
6. publish the static Pages seed/assets needed for bounded data-plane fallback;
7. verify exact web revision, health, live snapshot and section downloads.

The data worker's two more-specific routes must remain in place so the web worker cannot shadow the publication API.

## Testing

Add deterministic tests for:

- registry-derived currentness policy;
- ready/degraded/unavailable publication state;
- a required source expiring without an expired value surviving in the public artifact;
- server snapshot reads rejecting invalid or unavailable publications;
- homepage SSR using request-time evidence rather than a generated build snapshot;
- no active reference to `worker/index.js`;
- deployment configuration preserving specific data-worker routes before the catch-all web route;
- production verifier checking the current gov-pulse revision and publication state.

Existing lint, unit/Worker, build and Playwright gates remain mandatory.

## Non-goals

This change does not add new statistical topics, create a polling average, create a national score, move secrets into the application, introduce analytics, or change source-specific statistical definitions.
