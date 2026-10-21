# Cloudflare resource exhaustion — containment and proof plan

**Review date:** 22 October 2026. **Scope:** public-data.org V1 and the shared Cloudflare account.
**Status:** Candidate code fixes on a separate branch; not a production root-cause attribution or deployment sign-off.

## Established evidence

Cloudflare's account emails report:

- 29 September 2026: the account exceeded the 1,000/day Workers KV **put** allowance. This is a write incident, not proof of 100,000 reads.
- 4 October 2026: account-wide KV operations reached the 90% alert threshold.
- 15 October 2026: at least 100 Workers CPU-limit exceptions in the preceding 24 hours.
- 20 October 2026: at least 1,000 Workers CPU-limit exceptions in the preceding 24 hours.

Account alert emails do **not** identify which deployed Worker or KV namespace caused each event. Do not attribute the 1,000+ errors to this repo until real Cloudflare metrics confirm that fact. Cloudflare plan upgrades are not an RCA.

## The specific problems in this repository

1. The shared `app/layout.tsx` was reading the production snapshot with `readServerMetricsSnapshot()`. In production this calls `connection()` and a `cache: "no-store"` cross-Worker fetch. That forces unnecessary runtime work even for held/static pages. Route-specific evidence pages retain their own server read and receive the initial snapshot explicitly; the root shell no longer forces every route dynamic.
2. The `pulse-data-worker` cron was scheduling all registered sections and contracts daily **regardless** of publication decisions, plus betting refresh every three hours. Each run writes KV bookkeeping, section fragments and finalisation records, with retries in failure scenarios.
3. The international-comparison scheduler was independent of the publication switch and could still issue Queue work when its entire publication was held.
4. The public Worker and data Worker both consume the same account quotas as other projects. The repository workload model is a forecast, not measured account use; the historical KV-put incident may have another account-wide consumer.

## Containment proposed in this branch

- Scheduled national/three-hour collection now selects *enabled source publications only*. The manual/explicit bootstrap path still has the original required-source coverage and explicit optional contracts recovery. No completed evidence, archive entry or KV namespace is deleted.
- When no source is due (e.g., the held betting publication) Cron returns without Queue sends, KV reads or writes. Re-enabling an evidence publication restores the next scheduled collector.
- Independently scheduled international comparisons run only when their publication is enabled.
- The root layout no longer fetches evidence. The homepage and enabled topic pages provide their own initial verified snapshots to client components. Other pages may fetch evidence when their page requires it, and must never substitute unverified historical values.
- This is *containment*, not proof that the account is under quota and not the final static-first architecture.

**Intentional trade-off:** Held sources are no longer refreshed routinely. Before enabling a long-held source, execute an explicit approved evidence bootstrap, check it against its release clocks, and verify public availability. The publication toggle does not authorise publication of stale or incomplete data. This containment does not change an active source's expected validity semantics.

## Account verification (read-only before any further mitigation)

1. In Cloudflare, select the account referenced by the alerts. Review Workers & Pages metrics for **14–16 October** and **19–21 October**, broken down by Worker, deployed revision, route and CPU-limit-exception count. Record whether `public-data-web`, `pulse-data-worker`, `graingers-worker`, `mi-five-v2` or an untracked Worker actually dominates. Report p50/p90/p99 CPU time, total requests, bot-score breakdown where supported, 1102 errors and cache-hit ratio.
2. In Workers KV, compare **28–30 September** and **3–5 October** daily `put` operations by namespace; map each namespace to the actual deployed bindings/Workers. Do not assume the project owning a namespace is its only caller.
3. In Queues, inspect `public-data-jobs` messages delivered, retried, failed and moved to dead letter; correlate with run IDs and source-specific errors. Exclude manual refreshes, bootstrap and deployment probes from normal traffic. Identify whether repeated Queue retries caused a write burst.
4. Capture the current account's real plan/entitlements and alert thresholds, plus deployments changed before each spike. Do not expose credentials, user identifiers or raw token-bearing logs.
5. If Cloudflare reports a different Worker/namespace, stop blaming this repository and open a separate scoped fix against the actual owner.

### Sufficient proof for attribution

- CPU: Cloudflare per-Worker `exceededCpu` count and affected route/deployment revision for the alert's 24-hour window.
- KV: exact namespace and operation (`put`) count, mapped to live Worker bindings or API caller over the alert's reset window.
- Regression: a 24–72h before/after comparison under comparable request volumes, with crawler traffic and release deployments noted. If evidence is missing, label the root cause `unverified`.

## Next architecture change (separate review and controlled rollout)

**Target: precomputed evidence, mostly static public pages, tiny dynamic read API.** Never render a full Next/OpenNext tree per visitor when the content can be prepared as a versioned edition.

1. Inventory every route: build-static, edition-static, dynamic-read-only, truly request-specific. Record whether no-JS output, timestamps, SSR search indexing or export contracts require data at HTML generation time.
2. Materialise immutable editions and validated public artifacts at publication time. Use content/revision hashes and an atomic publication reference; enforce source policy before publishing. Do not derive a new public edition from unpublished or expired source evidence.
3. Serve editorial pages, images, charts and fixed metadata as static Worker assets or Cloudflare Pages. Keep genuinely dynamic retrieval/lookup in a small Worker with bounded CPU and a documented cache-key/TTL contract.
4. Avoid CDN caching of time-sensitive HTML beyond the verified `validUntil` for its embedded evidence. Test expiry boundaries and stale/held snapshots; never hide an unavailable source behind stale-while-revalidate.
5. Replace unconditional GET-on-render with edition-keyed fetches and a strict caching contract. Route-specific origin bypass and cache invalidation must be tested, especially after publication switches or record corrections.
6. Separate collection state, publication approval, immutable history and operational event logs. Prefer one write per changed source publication, with deduplicated queue delivery and per-source scheduling. Keep an audit record, but avoid writing identical large snapshots per refresh.
7. If expensive parsers cannot reliably fit Workers Free CPU, choose a deliberate background compute lane only after its costs and operational burden are measured; do not mask a broken collector with retries.

## Before merging into the V1 integration branch

- [ ] Repository lint, unit/Worker tests, TypeScript, architecture guards and OpenNext production build pass on the exact head SHA.
- [ ] Held topic pages and public routes render without server-side snapshot fetches and without displaying held data, including no-JS fallbacks.
- [ ] Homepage, national debt, editions, downloads, history, source and comparison journeys retain expected evidence.
- [ ] Cron no-op tests prove no KV/Queue writes with held betting, and enabled daily collection still works.
- [ ] Workload footprint and current account quotas are measured; if evidence cannot be obtained, document that limitation.
- [ ] Explicit approval for any production deployment or paid change; production remains unchanged until then.

### Rollback

Revert the remediation commit(s) and redeploy the last verified revision using the existing deployment workflow. Never delete the KV namespace, historical editions or Queue. If a newly enabled source has no current data, leave its public output unavailable and recover through a verified bootstrap, not through a fabricated fallback.
