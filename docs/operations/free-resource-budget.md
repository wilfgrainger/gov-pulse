# Current Cloudflare workload baseline (revised 22 October 2026)

> This is a workload estimate. The 20% headroom figure below is a planning
> target, not a product, code-size or blanket release gate; reassess it against
> measured traffic and current account limits.

This is a repository workload model, not evidence of Cloudflare account
entitlement. It is derived from `worker/feed-registry.js`, the scheduled cron
expressions in `worker/queued-publication-entry.js`, and `worker/wrangler.toml`.

The deployment still receives nine cron invocations daily: one national run and
eight three-hour betting checks. **Only enabled evidence publications generate
scheduled work**; held feeds no longer write KV or enqueue Queue jobs. The
current V1 switches enable only the nationalDebt source. Thus the proposed
healthy schedule queues one section refresh and one finaliser per day: **two
Queue deliveries/day**, compared with the former all-feed model's 30.
The eight betting cron invocations return without Queue or KV calls. The
independently scheduled international-comparison refresh also skips while held.
These are deterministic projections from code/config, **not measured Cloudflare
usage or proof of plan headroom**. Manual bootstraps, replay and account-wide
workload are separate.

The planning factor of three Queue operations per delivery makes the current
two-delivery example six project operations/day. This is a conservative
estimate, not the platform's billing definition. When another source is
enabled its daily collection automatically resumes; update the projection.
Stored held-source evidence remains private and manual recovery remains
available.

The national finaliser checks the edition archive once per daily run. A steady
duplicate publication costs two KV reads for the existing summary and index.
A new edition adds a content existence read, three KV writes and up to two
retention deletes: at most eight archive KV operations per successful
finaliser. With all three configured Queue retries applied to each daily
finaliser, the modeled archive upper bound is 32 KV operations/day. This is
separate from source-fragment KV activity and origin cache misses on the
read-only edition routes.

The public archive was measured on 2 October 2026. Its list contained two
editions and used 6,015 UTF-8 bytes; their immutable detail responses used
281,446 and 18,162 bytes. A local adapter run with 36 validated records
produced a 347,998-byte catalog. These samples are not whole-namespace storage
telemetry. The code's 60-entry rolling retention would hold about 20.9 MB at
that catalog size; the per-edition 2 MiB validation ceiling gives a much wider
upper bound and is not a platform quota. The live editions were dated 15 and 22
September, too short a sample to claim a guaranteed retention duration.

An uncached archive-list request performs one index read and validates each
listed edition by reading its summary and immutable content: five KV reads at
the current two-entry live count and up to 121 at the configured 60-entry
maximum. The list is publicly cached for 60 seconds. A detail request reads two
keys and is cached as immutable for one year. Reader request frequency and
whole-namespace stored bytes have not been measured; check those before
changing the 60-edition rolling retention. Cloudflare currently documents a
1 GB Workers KV namespace storage allowance and per-day Free-plan operation
limits; those published limits describe the platform, not the account's
remaining headroom ([pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[KV limits](https://developers.cloudflare.com/kv/platform/limits/)).

The queue allows three retries. If the two projected daily deliveries each
exhaust all three retries, their modeled upper bound is eight deliveries/day,
not including new jobs explicitly enqueued by application retry handling.
The former 120-delivery/day failure projection applied only to the old 30-job
all-source schedule. Bootstrap, manual recovery and re-sends are separate.
The scheduled collection tests cover disabled-feed no-ops and preserve the
ability to force a verified bootstrap. Measure actual Queue deliveries,
retries and KV writes before trusting either estimate.

This model describes the current Cloudflare deployment only. It is not a
Cloudflare-Free requirement or proof that quotas, CPU, KV, Queue, storage, build
or egress limits have 20% headroom. Verify current platform limits and account
usage when comparing hosting choices; see the source-feasibility ledger for the
last access result.

The retained workbook limits are project input caps, not Cloudflare plan
quotas: 8 MiB expanded per retained ZIP entry, 24 MiB total retained expanded
XML, 25,000 rows per worksheet and 250,000 cells per workbook. Decompression
counts bytes while streaming; forged ZIP uncompressed-size fields are ignored.
