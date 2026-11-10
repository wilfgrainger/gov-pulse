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
| governmentContracts | no-fixture (sharded: collectShard/combine) | n/a | ceiling 40 (MAX_PAGES_PER_REFRESH), usual use unmeasured | **ceiling below 50** |
| nhsStats (held) | no-fixture | n/a | 4 (code-read) | within |
| bettingOdds (held) | no-fixture | n/a | 3 (code-read) | within |
| releaseCalendar, nhsReleaseCalendar (held) | no-fixture | n/a | ceiling 11 (10 upcoming pages + 1 cancelled; 6 in November 2026) and 2 (code-read) | within |
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

### Measured Workers CPU and wall time (6 November 2026)

**MEASURED on Cloudflare Workers**, not Node. Source: `npx wrangler tail
pulse-data-worker --format json` captured 09:01-09:13 UTC on 6 November 2026
during a manually dispatched `deploy.yml` run (`refresh_evidence` and
`refresh_contracts` true, the documented recovery path, run
`bootstrap-eb24309b...`). It is a forced bootstrap run of the **current**
pipeline, not the `17 3 * * *` cron: the same queue job types ran, but the cron
`scheduled` handler itself was not captured. Single run, so n = 1 per job;
"p95" below is across all 21 queue invocations, not per job. `cpuTime` and
`wallTime` are the Workers tail fields in milliseconds. The tail does not report
subrequest counts; the only count available is `requestsMade` logged by
`refresh-contracts`.

| queue job (section) | cpuTime ms | wallTime ms | outcome | notes |
| --- | --- | --- | --- | --- |
| bootstrap accepted (dispatch) | 4 | 986 | ok | |
| refresh-section gdpTracker | 46 | 7,218 | ok | |
| refresh-section sentimentPulse | 80 | 19,159 | ok | |
| refresh-section employmentStats | 570 | 21,239 | ok | |
| refresh-section taxRevenue | 51 | 18,228 | ok | |
| refresh-section nationalDebt | 42 | 4,259 | ok (job failed) | ONS bulletin did not expose public sector data; section left unavailable |
| refresh-section migrationStats | 21 | 18,866 | ok | |
| refresh-section housePriceIndex | 14 | 2,122 | ok | |
| refresh-section realWages | 19 | 2,227 | ok | |
| refresh-external-section electionPolling | 605 | 4,532 | ok | highest CPU |
| refresh-external-section nhsStats (held) | 2 | 373 | ok (job failed) | upstream AWS WAF block |
| refresh-contracts | 188 | 21,889 | ok | 28 page requests (daily increment, 7 days) |
| finalise-run | 532 | 11,399 | ok | status `incomplete` (nationalDebt failed, nhsStats held) |
| refresh-international-comparison x7 | 5-219 (219 max) | 564-4,558 | ok | batches finalised `success` |
| international batches finalised | 7 | 564 | ok | |

All 21 queue invocations: cpuTime p95 570 ms, max 605 ms; wallTime p95
21,239 ms, max 21,889 ms; no exceptions; outcome `ok` for all (job-level
failures are logged, not thrown).

Public data routes served by the same Worker in the window (14 requests):
cpuTime 6-18 ms (p95 18). `/data/metrics-snapshot.json` 11-18, `/data/editions.json`
6-16, `/data/health.json` 9-16.

Against Workers Free limits:

| limit | measured | verdict |
| --- | --- | --- |
| Queue consumer CPU, default 30,000 ms | max 605 ms | within, about 2% |
| Subrequests per invocation, 50 | `refresh-contracts` 28 in this run; other counts not reported by tail | within in this run; the 40-page ceiling (`MAX_PAGES_PER_REFRESH`) is below 50 |
| CPU per request/cron trigger, 10 ms | queue accept 4 ms; 8 of 14 data-route requests measured 11-18 ms, all outcome `ok` | **over on measured cpuTime for data routes**; whether this is enforced is not established here |
| Cron `scheduled` handler CPU | not captured | unmeasured |
| Queues, 10,000 ops/day | not derivable from tail (21 messages this run) | not measured here |
| KV writes, 1,000/day account-wide | not derivable from tail | not measured here |

**Items for owner decision G-CPU:**

1. `refresh-contracts`: 28 requests this run (incremental). The first or a
   recovery run can reach the 64-page ceiling and exceed 50 subrequests. Split
   by page range, or cap at 45, rather than rely on retries.
2. Public data-route requests (`metrics-snapshot.json`, `editions.json`,
   `health.json`) measured above 10 ms cpuTime in 8 of 14 requests. Confirm
   with the account's plan and Cloudflare's enforcement before relying on the
   10 ms limit as met; no request failed in the sample.
3. No queue job approached the 30 s consumer CPU limit, so shard size is
   bounded by subrequests and wall time, not CPU.
4. Not measured: the scheduled cron handler, per-job subrequest counts other
   than contracts, Queue and KV daily operation counts. A scheduled-run capture
   at 03:17 UTC would close these.

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

### Pipeline dependencies (Task 10d, not wired)

`worker/pipeline-deps.js` supplies the pipeline's real collectors and publisher:
section and external feeds through their existing collectors, and
`governmentContracts` as seven UTC day shards combined into one per-feed record.
The publisher now reads the contracts record from `v20:feed:governmentContracts`
or the legacy key, whichever was retrieved later, and takes a run's collector
failure from the feed's last attempt when no legacy terminal record exists (one
extra KV read per absent published family). The Worker entry still does not
import the pipeline, so cron and Queue behaviour are unchanged. International
comparison batches stay on the legacy runner.

### Pipeline handlers and write budget (Task 10c, not wired)

`worker/pipeline.js` now has `collect`, `finalise` and `bootstrap` handlers,
built with `createPipeline(deps)`. Their collectors and publisher are injected,
and the Worker does not import the module, so the live path is unchanged.

Counts below come from a counting fake KV and queue in
`tests/worker/kv-write-budget.test.ts`. **They are test counts, not production
measurements.**

| Scenario | KV puts | Notes |
| --- | --- | --- |
| Healthy daily run, 11 published feeds | 16 | lease, dispatched, finalised (3); 10 feed records; contracts as one shard plus one combined record (2); one publish |
| 50 synthetic published feeds | 54 | 3 run writes, 50 feed records, one publish |
| Held feeds on the betting cron | 0 puts, 0 KV reads, 0 queue sends | |

The fake's publish performs one put. The real publisher still rebuilds from the
legacy `v12:publication:current` and `status` keys and also writes the archive,
so the production count is not yet known. It becomes known only after the
publisher is rewritten and the legacy writes stop (G4).

Queue consumer, read with `npx wrangler queues consumer worker list
public-data-jobs` on 6 November 2026: `dead_letter_queue` is
`public-data-jobs-dlq`, `max_retries` 3, `retry_delay` 300 seconds.
