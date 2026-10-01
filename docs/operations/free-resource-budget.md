# Free-runtime workload budget

This is a repository workload model, not evidence of Cloudflare account
entitlement. It is derived from `worker/feed-registry.js`, the scheduled cron
expressions in `worker/queued-publication-entry.js`, and `worker/wrangler.toml`.

The healthy recurring schedule has nine cron invocations: one daily run and
eight three-hour betting refreshes. The daily run queues eleven publication
sections, one contracts refresh and one finaliser (13 deliveries). Each
three-hour run queues the betting refresh and one finaliser (16 deliveries).
The resulting target is 29 queue deliveries per day. The code records a
planning factor of three queue operations per delivery, or 87 operations/day;
this factor is a conservative project estimate, not a Cloudflare billing
definition.

The queue allows three retries. If every scheduled delivery exhausts all three
retries, the configured upper bound is 116 deliveries/day and 348 project
operations/day. This is a failure bound, not a healthy target. Bootstrap and
manual recovery traffic are excluded and must be budgeted separately. The
derived schedule is tested so a new active feed or retry allowance cannot
silently leave the inventory unchanged.

Cloudflare Free readiness remains unverified. In this environment, requests
to official Cloudflare documentation and account endpoints fail at the
network proxy with `CONNECT tunnel failed, HTTP 000`; no account settings are
available here. Do not interpret the workload values as proof that quotas,
CPU, KV, Queue, storage, build or egress limits have 20% headroom. Verify those
limits and the deployed account from an authorized network before the
production feasibility gate.

The retained workbook limits are project input caps, not Cloudflare plan
quotas: 8 MiB expanded per retained ZIP entry, 24 MiB total retained expanded
XML, 25,000 rows per worksheet and 250,000 cells per workbook. Decompression
counts bytes while streaming; forged ZIP uncompressed-size fields are ignored.
