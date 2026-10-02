# Source and runtime feasibility evidence (updated 2 October 2026)

> Dated evidence ledger, not current-source authority or an implementation
> gate. Reverify observations against live workflows, publisher responses and
> the current Cloudflare account. Round-two work is ordered in
> `docs/superpowers/plans/2026-10-02-publication-reinvention-round-2.md`.

| Area | Repository evidence | Finding / follow-up |
| --- | --- | --- |
| Static/public hosting | `worker/wrangler.toml`, `.github/workflows/deploy.yml`, hosting boundary checks | Cloudflare Workers + static assets and a data Worker are configured; Pages is a secondary manual seed fallback. GitHub Pages is prohibited by the user's Cloudflare-Free constraint. |
| Source collection | `worker/feed-registry.js`, `worker/queued-publication-entry.js` | 12 active registered feeds; daily collection plus three-hour betting refresh; the separate public-money/Find a Tender refresh adds one daily queue job. |
| Scheduled queue load | `scripts/audit-free-budget.mjs`, `worker/wrangler.toml` | 30 healthy deliveries/day and 90 modeled operations/day; up to 120 deliveries/360 modeled operations if every scheduled delivery uses all three retries. Bootstrap, manual runs and changing source coverage are separate workload. The international comparison has its own direct daily scheduler outside the Queue. |
| NHS time series | `.github/workflows/nhs-ingest.yml`, NHS publication and parser code | The GitHub importer recently received an upstream access challenge. Direct publisher access and deployed readback require re-verification. |
| Workbook input | `worker/xlsx-workbook.js`, `worker/response-limits.js` | Compressed response and expanded ZIP/XML caps are bounded in code. They are project caps; total runtime and CPU impact still need fixture/load measurement. |
| Cloudflare Free account quotas | No account binding or quota snapshot available in this environment | Official Cloudflare documentation/account requests were blocked by the network proxy (`CONNECT tunnel failed, HTTP 000`). Exact Free limits, current usage and 20% headroom cannot be certified here. Do not deploy based on repository constants. |
| External source freshness | Source-specific feed registry and collector tests | Each topic requires source-by-source currentness, parse/revision and failure-retention fixes in implementation Tasks 3–6. An endpoint being configured is not proof of current observations. |

Cloudflare-only architecture remains mandatory. A blocked source or unverified
quota does not authorize adding a paid provider, proxy or executor. Continue
independent local implementation and retain those two gates for operational
verification.
