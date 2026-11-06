# Current Cloudflare workload baseline (revised 6 November 2026)

> This is a workload estimate. The 20% headroom figure below is a planning
> target, not a product, code-size or blanket release gate; reassess it against
> measured traffic and current account limits.

This is a repository workload model, not evidence of Cloudflare account
entitlement. It is derived from `config/publications.json`, the collection plan in
`worker/publication-plan.js`, the cron expressions in
`worker/publication-schedule.js`, and `worker/wrangler.toml`.

The deployment still receives nine cron invocations daily: one national run and
eight three-hour betting checks. **Only published evidence generates scheduled
work**; held feeds do not write KV or enqueue Queue jobs. On 6 November 2026
`config/publications.json` publishes 11 collected sources: ten section
collectors (gdpTracker, sentimentPulse, employmentStats, taxRevenue,
nationalDebt, migrationStats, housePriceIndex, realWages, crimeStatistics,
electionPolling) and governmentContracts. (The file also publishes
`editionArchive`, which is an archive gate, not a collected source.)
`refreshJobs("x", "daily", { publishedOnly: true })` returns exactly 11 jobs:
10 `refresh-section`/`refresh-external-section` plus one `refresh-contracts`.
With the finaliser that is **12 Queue deliveries/day**. bettingOdds is held, so
the eight betting cron invocations return without Queue or KV calls, and the
international-comparison refresh also skips while held.
These are deterministic projections from code/config, **not measured Cloudflare
usage or proof of plan headroom**. Manual bootstraps, replay and account-wide
workload are separate.

The planning factor of three Queue operations per delivery makes the current
twelve-delivery schedule 36 project operations/day. This is a conservative
estimate, not the platform's billing definition. When another source is
published its daily collection automatically resumes; update the projection.
Stored held-source evidence remains private and manual recovery remains
available. (`scripts/audit-free-budget.mjs` models the legacy
`feeds/registry.js` operational status and still reports 30 messages/day; it
does not read `config/publications.json` and over-counts held feeds.)

The national finaliser checks the edition archive once per daily run. A steady
duplicate publication costs two KV reads for the existing summary and index.
A new edition adds a content existence read, three KV writes and up to two
retention deletes: at most eight archive KV operations per successful
finaliser. With all three configured Queue retries applied to each daily
finaliser, the modeled archive upper bound is 32 KV operations/day. This is
separate from source-fragment KV activity and origin cache misses on the
read-only edition routes.

The public archive was measured on 2 October 2026. Its list contained two
editions and used 6,015 UTF-8 bytes; their detail responses used
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
keys and is `Cache-Control: no-store` (worker/public-data-entry.js; the app also
fetches it with `cache: "no-store"`), so every detail view is a KV read; only the
versioned `/_next/static/*` assets are immutable. Reader request frequency and
whole-namespace stored bytes have not been measured; check those before
changing the 60-edition rolling retention. Cloudflare currently documents a
1 GB Workers KV namespace storage allowance and per-day Free-plan operation
limits; those published limits describe the platform, not the account's
remaining headroom ([pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[KV limits](https://developers.cloudflare.com/kv/platform/limits/)).

The queue allows three retries. If the twelve projected daily deliveries each
exhaust all three retries, their modeled upper bound is 48 deliveries/day,
not including new jobs explicitly enqueued by application retry handling or
the finaliser's own pending re-sends. The former 120-delivery/day failure
projection applied only to the old 30-job all-source schedule. Bootstrap, manual recovery and re-sends are separate.
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

## Public read path and publication writes (revised 5 November 2026)

The publisher stores the public artifact (`v14:publication:public`) already
normalised: policy-filtered, sanitised and currentness-filtered at publish
time. A `/data/metrics-snapshot.json` cache miss performs one KV read, checks
the stored artifact by keys and identifiers, and serves the stored body
unchanged with no `structuredClone`. Currentness is still enforced on every
read: when a section or sentiment measure has aged out since publication, one
copy is filtered. An artifact not in the normalised form (an earlier publisher
or publication policy) is fully re-normalised and never served as stored.
Before this change a cache miss made 15 `structuredClone` calls on the test
fixture (11 when a section had expired) and parsed the body twice.

`/data/health.json` reads only the public artifact and the publisher status
record (`v12:publication:status`): two KV reads and no copies on the common
path. It no longer reads or copies the full internal publication. Held
required sections, which the public artifact never carries, are judged from
the status record's per-section `sectionValidUntil` deadlines.

Each publication writes three KV keys, each with a reader: the public
artifact, the current record and the status record (plus edition-archive keys
for a new edition, and one repair write only when an interrupted publish left
the public record behind the current one). The unread commit manifest
(`v12:publication:commit`) and the unread 14-day internal history copy
(`v12:publication:history:*`) are no longer written; the filtered edition
archive is the durable history. Stale copies of those keys already in KV are
inert and expire or can be deleted by an operator. These counts come from unit
tests with a recording KV, not Cloudflare metrics.

## Indicative collector cost per feed (6 November 2026)

**INDICATIVE ONLY.** Node CPU is not Workers CPU: different engine build, no
isolate limits, different JIT and GC behaviour, no network wait. These numbers
rank feeds and expose outliers; they are not evidence of Free-tier headroom.

Produced by `node scripts/measure-collector-cost.mjs --all` (add `--runs N`,
`--json`, or a feed id). Method: each collector's `collect()` runs offline
against existing checked-in fixture files behind a stub `fetch` (no network).
CPU is `process.cpuUsage()` user+system deltas, median of 7 calls after one
discarded warm-up. `--cpu-prof` is not used for the table because one process
cannot attribute CPU to a single feed; profile one feed with
`node --cpu-prof scripts/measure-collector-cost.mjs <feedId>`. `bytes` is the
UTF-8 size of the fixture bodies the collector read. Repeated invocations varied
by up to about 2x (JIT/GC noise), so treat figures as order-of-magnitude.
Fetches are counted at the stub for measured feeds. For feeds without fixtures
they are derived by reading the collector (upper bound; ONS bulletin discovery
counted as 2 fetches), and listed in `STATIC_FETCHES` in the script.

| feed | indicative Node cpuMs (range over 3 invocations) | fixture bytes | external fetches per job | vs 50 subrequests |
| --- | --- | --- | --- | --- |
| nationalDebt | 3.8 (1.9-4.3) | 28,443 | 5 (counted) | within |
| crimeStatistics | 7.25 (6.6-9.4) | 271,056 | 2 (counted) | within |
| housePriceIndex | 2.9 (2.1-3.4) | 98,063 | 2 (counted) | within |
| realWages | 0.35 (0.15-0.35) | 1,606 | 2 (counted) | within |
| electionPolling | no-fixture | n/a | up to 16 (code-read: YouGov 3 + archive 1 + up to 12 workbooks) | within |
| gdpTracker | no-fixture | n/a | 6 (code-read) | within |
| sentimentPulse | no-fixture | n/a | 5 (code-read) | within |
| taxRevenue | no-fixture (fixtures are inline test strings) | n/a | 3 (code-read) | within |
| employmentStats | no-fixture | n/a | 6 (code-read) | within |
| migrationStats | no-fixture | n/a | 3 (code-read) | within |
| governmentContracts | no-fixture (sharded: collectShard/combine) | n/a | ceiling 64 (MAX_PAGES_PER_REFRESH), usual use unmeasured | **ceiling above 50** |
| nhsStats (held) | no-fixture | n/a | 4 (code-read) | within |
| bettingOdds (held) | no-fixture | n/a | 3 (code-read) | within |
| releaseCalendar, nhsReleaseCalendar (held) | no-fixture | n/a | 2 and 2 (code-read) | within |
| internationalComparison (held) | no-fixture (sharded batches) | n/a | not derived | unknown |
| earlyYears | static feed, no collector | n/a | 0 | n/a |

Reading the table honestly: only 4 of 11 published feeds could be measured
offline. The measured four are single-digit milliseconds of Node CPU for parse
work, but the Free per-invocation CPU budget that matters here (queue consumer
default 30 s, configurable to 5 min; 10 ms per request and per cron trigger)
applies to Workers CPU, which this does not measure. The unmeasured published
feeds include the likeliest CPU-heavy ones (electionPolling parses XLSX and PDF;
governmentContracts pages through up to 64 requests), so no Free-tier
conclusion is drawn here. Subrequests: 10 of the 11 published jobs make at most
16 external fetches; the `refresh-contracts` ceiling of 64 pages exceeds the
50-subrequest Free limit if reached and is listed for G-CPU. KV and Queue
binding calls were not counted in these figures, and whether they count toward
the 50 limit has not been verified here.

### TODO (owner-run, not done): measured Workers CPU and wall time

During the next scheduled daily run on the current pipeline, with the Cloudflare
token kept local:

```
npx wrangler tail pulse-data-worker --format json > tail.json
```

Record `cpuTime` and wall time per queue message type and section, including
`finalise-run`, and the p95 job durations Task 10 needs. Until that is done
there is no measured Workers CPU figure in this repository.

### Per-feed records: dual-write window (Task 9)

Each successful section collection now also writes `v20:feed:<id>` (one get and
one put per feed, after the legacy run-scoped and global fragment writes); a
terminal bootstrap failure writes one more put recording `lastAttempt`. The
publisher reads `v20:feed:*` first, falls back to the legacy fragments, and logs
`Feed record diverged from legacy fragment` when current copies differ.

Expected cost in the dual window, **from code and unit tests, not yet measured in
production**: about +9 KV puts per daily run (9 section feeds through the
collection runner; contracts and comparison batches are unchanged), so roughly
39 + 9 = 48, below the 50-write test bound and the 1,000/day account limit. The
target of about 16 writes per run applies only after the legacy keys are retired
(Task 17a). Required before retirement, not done: at least 7 production days of
dual-write with the daily divergence-log count recorded here.
