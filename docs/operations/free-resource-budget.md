# Current Cloudflare workload baseline (model refreshed 2 October 2026)

> This is a workload estimate. The 20% headroom figure below is a planning
> target, not a product, code-size or blanket release gate; reassess it against
> measured traffic and current account limits.

This is a repository workload model, not evidence of Cloudflare account
entitlement. It is derived from `worker/feed-registry.js`, the scheduled cron
expressions in `worker/queued-publication-entry.js`, and `worker/wrangler.toml`.

The healthy recurring schedule has nine cron invocations: one daily run and
eight three-hour betting refreshes. The daily run queues twelve registered
feeds, one contracts refresh and one finaliser (14 deliveries). Each
three-hour run queues the betting refresh and one finaliser (16 deliveries).
The resulting target is 30 queue deliveries per day. The code records a
planning factor of three queue operations per delivery, or 90 operations/day;
this factor is a conservative project estimate, not a Cloudflare billing
definition.

The national finaliser checks the edition archive once per daily run. A steady
duplicate publication costs two KV reads for the existing summary and index.
A worst-case new edition adds a content existence read, three KV writes and up
to two retention deletes: at most eight archive KV operations per successful
finaliser. With all three configured Queue retries applied to each daily
finaliser, the modeled archive upper bound is 32 KV operations/day. This is
separate from source-fragment KV activity and origin cache misses on the
read-only edition routes; public request traffic still needs measurement.

The queue allows three retries. If every scheduled delivery exhausts all three
retries, the configured upper bound is 120 deliveries/day and 360 project
operations/day. This is a failure bound, not a healthy target. Bootstrap and
manual recovery traffic are excluded and must be budgeted separately. The
derived schedule is tested so a new active feed or retry allowance cannot
silently leave the inventory unchanged.

This model describes the current Cloudflare deployment only. It is not a
Cloudflare-Free requirement or proof that quotas, CPU, KV, Queue, storage, build
or egress limits have 20% headroom. Verify current platform limits and account
usage when comparing hosting choices; see the source-feasibility ledger for the
last access result.

The retained workbook limits are project input caps, not Cloudflare plan
quotas: 8 MiB expanded per retained ZIP entry, 24 MiB total retained expanded
XML, 25,000 rows per worksheet and 250,000 cells per workbook. Decompression
counts bytes while streaming; forged ZIP uncompressed-size fields are ignored.
