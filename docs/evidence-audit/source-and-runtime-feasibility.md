# Source and runtime feasibility evidence (1 October 2026)

This is an evidence ledger for implementation, not a production readiness signoff.

| Area | Repository evidence | Finding / follow-up |
| --- | --- | --- |
| Static/public hosting | `worker/wrangler.toml`, `.github/workflows/deploy.yml`, hosting boundary checks | Cloudflare Workers + static assets and a data Worker are configured; Pages is a secondary manual seed fallback. GitHub Pages is prohibited by the user's Cloudflare-Free constraint. |
| Source collection | `worker/feed-registry.js`, `worker/queued-publication-entry.js` | 11 active registered sections; daily collection plus three-hour betting refresh; daily public-money/Find a Tender collection adds bounded requests. |
| Scheduled queue load | `scripts/audit-free-budget.mjs`, `worker/wrangler.toml` | 30 healthy deliveries/day including daily international comparison refresh; up to 120 if each scheduled delivery incurs all three configured retries. Bootstrap, manual runs and changing source coverage are separate workload. |
| NHS time series | `.github/workflows/nhs-rtt-ingest.yml`, NHS publication and parser code | Trusted GitHub Actions ingest exists for the NHS origin that rejects Cloudflare egress. The parser/publication path is reusable; runner allowance and deployed readback remain unverified. |
| Workbook input | `worker/xlsx-workbook.js`, `worker/response-limits.js` | Compressed response and expanded ZIP/XML caps are bounded in code. They are project caps; total runtime and CPU impact still need fixture/load measurement. |
| Cloudflare Free account quotas | No account binding or quota snapshot available in this environment | Official Cloudflare documentation/account requests were blocked by the network proxy (`CONNECT tunnel failed, HTTP 000`). Exact Free limits, current usage and 20% headroom cannot be certified here. Do not deploy based on repository constants. |
| External source freshness | Source-specific feed registry and collector tests | Each topic requires source-by-source currentness, parse/revision and failure-retention fixes in implementation Tasks 3–6. An endpoint being configured is not proof of current observations. |

Cloudflare-only architecture remains mandatory. A blocked source or unverified
quota does not authorize adding a paid provider, proxy or executor. Continue
independent local implementation and retain those two gates for operational
verification.
