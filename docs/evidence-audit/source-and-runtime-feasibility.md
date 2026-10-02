# Source and runtime feasibility evidence (updated 2 October 2026)

> Dated evidence ledger, not current-source authority or an implementation
> gate. Cloudflare-Free-only and GitHub-Pages-prohibited statements below are
> superseded. Reverify observations against live workflows, publisher responses
> and the current platform account. Round-two work is ordered in
> `docs/superpowers/plans/2026-10-02-publication-reinvention-round-2.md`.

| Area | Repository evidence | Finding / follow-up |
| --- | --- | --- |
| Static/public hosting | `worker/wrangler.toml`, `.github/workflows/deploy.yml`, hosting boundary checks | Cloudflare Workers + static assets and a data Worker are configured; Pages is a secondary manual seed fallback. This records the current deployment, not a permanent provider restriction. |
| Source collection | `worker/feed-registry.js`, `worker/queued-publication-entry.js` | 12 active registered feeds; daily collection plus three-hour betting refresh; the separate public-money/Find a Tender refresh adds one daily queue job. |
| Scheduled queue load | `scripts/audit-free-budget.mjs`, `worker/wrangler.toml` | 30 healthy deliveries/day and 90 modeled operations/day; up to 120 deliveries/360 modeled operations if every scheduled delivery uses all three retries. Bootstrap, manual runs and changing source coverage are separate workload. The international comparison has its own direct daily scheduler outside the Queue. |
| NHS time series | `.github/workflows/nhs-ingest.yml`, NHS publication and parser code | The GitHub importer recently received an upstream access challenge. Direct publisher access and deployed readback require re-verification. |
| Workbook input | `worker/xlsx-workbook.js`, `worker/response-limits.js` | Compressed response and expanded ZIP/XML caps are bounded in code. They are project caps; total runtime and CPU impact still need fixture/load measurement. |
| Cloudflare account quotas | No account binding or quota snapshot available in this environment | Official Cloudflare documentation/account requests were blocked by the network proxy (`CONNECT tunnel failed, HTTP 000`). Exact plan limits and current usage cannot be certified here. Compare measured workload and pricing across suitable platforms before a provider decision. |
| External source freshness | Source-specific feed registry and collector tests | Each topic requires source-by-source currentness, parse/revision and failure-retention fixes in implementation Tasks 3–6. An endpoint being configured is not proof of current observations. |

The deployed Cloudflare architecture is the current baseline, not a mandatory
target. A blocked source still cannot justify bypassing access controls or
publishing unreconciled data. Paid spend requires approval of a concrete cost.
