# Feed architecture package — Chief of Staff sign-off record — 6 November 2026

**Status:** Agent review record. It changes no code, publication state, workflow, deployment or Architect document.

**Package reviewed (Round 4, final):**
- **Executable plan r4:** [`2026-11-06-feed-architecture-simplification.md`](../superpowers/plans/2026-11-06-feed-architecture-simplification.md), about 58 KB, Tasks 0.1–0.4, 1, 2, 2b, 3–12, 17a and 18.
- **Follow-up plan:** [`2026-11-06-static-first-delivery.md`](../superpowers/plans/2026-11-06-static-first-delivery.md), about 30 KB, Tasks 13–16 and 17b. Not executable until G9.
- **Also reviewed:** the [target design](feed-architecture-target-2026-11-06.md) and the [review](feed-architecture-review-2026-11-06.md).
- **History:** Rounds 1–3 are kept below.

**FINAL DECISION (Round 4): APPROVED.**
- This applies to the executable plan.
- No must-fix remains before execution.
- The follow-up plan carries two items to fix before you decide G9 (§R4.4).
- The owner remains the final approver.

## Round 4 — final

### R4.1 Executive verdict for the owner

1. **Final decision: APPROVED.** The executable plan is fit for your approval (G0) and execution as written. The Round 3 split was applied correctly, and every tracked correction is in the text.
2. **What you approve at G0** delivers the brief:
   - adding a feed means 3 hand-edited files plus regenerated projections;
   - one policy module and one derived route manifest;
   - KV writes per daily run go from 39 to 16;
   - Queue message types go from 7 to 3;
   - CPU is measured before the pipeline rewrite;
   - free-tier Cloudflare only;
   - one lean `quality` job with nothing added to `main` deploys.
3. **Live integrity fixes, independent of static-first:**
   - Task 2 stops RSS from advertising expired polling;
   - Task 2b caps the cache lifetime of evidence and held-notice responses at 300 s.
4. **The split is clean.**
   - Every task heading appears exactly once across the two files.
   - Gates are defined in the file that uses them: G2, G3, G8, G9 and G-DNS appear in the main plan only in pointer text.
   - The main plan's Definition of Done can be met without G9.
   - The main plan consumes nothing that only the follow-up plan creates.
5. **The follow-up plan is correctly marked "not executable until G9".** It has entry criteria, a Consumes list and an honest statement about token scope. It also has two defects to fix before you decide G9 (§R4.4):
   - **F1:** the G9 entry criteria need a Task 14 build timing, but Task 14 depends on Task 13, which is itself behind G9. The order is circular.
   - **F2:** Task 13 adds a slow static-export build to every full-lane pull-request run, which works against the Actions brief.
6. **Smaller tracked items:**
   - one stale citation ("deleted in Task 17" at main plan line 357 should read Task 17a);
   - Task 17a may delete `worker/feed-registry.js` only after `app/`'s 3 imports of it are rewired, a step no task names.
7. **Unverified and honestly labelled:**
   - whether `secret put` creates a new version without re-uploading assets;
   - whether rollback restores an older secret;
   - OpenNext honouring `expireTime`/`revalidate`;
   - Workers Builds exposing the commit SHA, and pushes made with `GITHUB_TOKEN` triggering builds;
   - deploy hooks on the Free plan;
   - Free-plan Queue consumer CPU;
   - the 3 MB script-size limit;
   - whether Cloudflare tokens can be scoped to secret writes only.
8. **Your gates for the executable plan:** G0, G-MIN, G1 (never exercised), G-225, G-CPU, G4, G5, G6 (only if required checks change), G7, G-AGENTS.
9. **Follow-up plan gates:** G9, G-DNS, G3, G2, G8.
10. This is an agent sign-off. **You remain the final approver.**

### R4.2 Mechanical re-check

**(a) Task placement.** I grepped the `### Task` headings in both files.
- **Main plan:** 0.1, 0.2, 0.3, 0.4, 1, 2, 2b, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17a, 18.
- **Follow-up plan:** 13, 14, 15, 16, 17b.
- Running `uniq -c` across both files shows no duplicates and nothing missing. **Confirmed.**

**(b) Citations of Tasks 13–16 and 17b.**

| Where | What it says | Result |
|---|---|---|
| Main plan, ordering-table pointer row (`:97`) | Points to the follow-up plan | Correct |
| Main plan, "Workstream 5 — moved" stub (`:600`) | Points to the follow-up plan | Correct |
| Main plan, Task 18 note (`:634`) | Points to the follow-up plan | Correct |
| Main plan, self-review (`:667`, `:671`) | "references to Tasks 13–16 and 17b are to the follow-up plan" | Correct |
| Target §6 (`:228`) | "Implemented by the follow-up plan"; both plans are linked | Correct |
| Target §5 (`:222`) | Main plan Task 8 | Correct |
| Target §8 step 10 (`:341`) | Main plan Task 17a and follow-up Task 17b | Correct |
| Target risk rows R16 and R18 | Point to the right plan | Correct |
| Review document | No task citations | Nothing to check |
| **Main plan `:357`** | "deleted in Task 17" | **Dangling.** Should read Task 17a, which does delete that shim (T-R4.1) |

**(c) Contradictions introduced by the split.**

1. **Main plan → follow-up consumption: none.**
   - Task 2b uses only its own `cacheLifetimeSeconds`.
   - Task 18 dropped the edition-build assertion and depends on Tasks 5, 7 and 10 only.
   - `contracts/security-headers.js` is created by follow-up Task 13 and is not used by the main plan.
   - The main plan's Definition of Done has no "If G9" block.
2. **Gates.** Each gate is defined in the file that uses it.
   - **Main plan defines:** G0, G-MIN, G1, G-225, G-CPU, G4, G5, G6, G7, G-AGENTS.
   - **Follow-up plan defines:** G9, G-DNS, G3, G2, G8.
   - Main-plan mentions of G2, G3, G8, G9 and G-DNS are pointers (`:119`) or self-review history.
   - Follow-up mentions of G-AGENTS and G1 cite the main plan.
3. **F1 (new, follow-up only): circular entry criteria.**
   - G9 entry criterion 3 requires Task 14 Step 6 build timing.
   - Task 14 depends on Task 13, and the ordering table gates Task 13 on G9.
   - Only Task 14 Steps 1–6 are exempted ("may run pre-G9 as measurement"); Task 13 is not.
   - Task 13 itself ships nothing to production until Task 16.
4. **F2 (new, follow-up only): extra CI build.** Task 13 Step 1's `static export > next build with output export succeeds for all routes` is "run in the `full` lane". That adds a second Next build to every full-lane PR run, permanently, against brief item 6 (no large Actions job).
5. **T-R4.2 (small, main plan).** Task 17a deletes `worker/feed-registry.js` "only once no importer remains". `app/` imports it 3 times today, and Task 4 rewires currentness call sites, not those imports. No task names the rewiring.

**(d) T-R3.x claims.**

| Item | Where | Verdict |
|---|---|---|
| T-R3.1 token scope | Follow-up G3. It states that a token able to `secret put` should be assumed able to deploy any Worker, and names the controls: Task 16 workflow tests, the branch ruleset and GitHub environment protection | **Verified in text** |
| T-R3.2 rollback and held set | Follow-up Task 15:<br>• `staticRelease` gains `reapplyHeld()` and a `"rolled-back-unsafe"` outcome;<br>• test `static release > rollback preserves the current held set` asserts the order rollback → `secret put`;<br>• a failed re-apply exits non-zero and falls back to full pause | **Verified in text** |
| T-R3.3 version skew | Follow-up Task 16: a one-release additive-only rule for `/data/*` shapes, with test `release smoke > data-only mode validates the previous release's public-surface schema` | **Verified in text** |
| T-R3.4 byte figures | Target §4.1 table: 285 B live, 640 B at 17 feeds (noting my 683 B under other assumptions), about 2.1 KB at 50 feeds, which overflows | **Verified.** The conclusion matches mine |
| T-R3.5 request cost | Main Task 2b Step 5b: 3 days before and after, per-Worker requests and KV reads, escalate to the owner above 10% of 100k/day | **Verified in text** |

### R4.3 Rubric (final)

| Criterion | Round 4 rating |
|---|---|
| R1 Objective fit | PASS |
| R2 Free-tier fit | PASS WITH CONCERN (Free-plan unknowns are measured in Task 8 and decided at G-CPU; static-first unknowns are behind G9) |
| R3 GitHub Actions | PASS for the main plan. F2 affects only the follow-up plan |
| R4 Evidence integrity | PASS |
| R5 Migration safety | PASS |
| R6 Plan quality | PASS (T-R4.1 is a one-word citation fix) |
| R7 Delegation | PASS |
| R8 Proportion and honesty | **PASS.** Splitting into a 58 KB executable plan and a 30 KB conditional plan resolves the multi-subsystem concern. Both are plans, not transcripts, and unverified items are labelled |

### R4.4 FINAL DECISION: **APPROVED** (executable plan)

#### MUST-FIX BEFORE EXECUTION

None for the executable plan.

#### MUST-FIX BEFORE G9 (follow-up plan only; it does not block G0 or the main plan)

1. **F1 — Remove the G9 circularity.** (Architect edit, follow-up ordering table and G9 entry criteria)
   - Either allow Task 13 to run before G9 as a CI-only, no-production-effect prerequisite of the Task 14 measurement, or drop the measured build time from the G9 entry criteria and make it a G3 entry criterion instead.
   - Check: no task required by a G9 entry criterion is itself gated on G9.
2. **F2 — Keep the export build out of every PR run.** (Architect edit, follow-up Task 13 Step 1)
   - The `next build` export test runs only in the follow-up plan's own manual measurement or release path, or in a `full`-lane job only while follow-up work is active.
   - It must not become a permanent second build on every full-lane PR.
   - Check: the workflow test still asserts one build per run.

#### TRACK DURING EXECUTION

1. **T-R4.1** (Architect, any time, or the implementer at Task 4): correct main plan `:357` "deleted in Task 17" to "Task 17a".
2. **T-R4.2** (implementation-time check, Task 4 or 17a): name the task that rewires `app/`'s 3 `@/worker/feed-registry` imports to `feeds/registry.js` before Task 17a deletes the shim. Until then, Task 17a Step 2 skips that deletion.
3. **Carried and confirmed encoded:**
   - Round 1: T1–T9;
   - Round 2: T-R2.1–T-R2.5 (the follow-up items in the follow-up plan);
   - Round 3: T-R3.1–T-R3.5, verified in §R4.2(d).
4. **Verify at the gates** (implementation-time; the platform claims below were not verified in this review):
   - Free-plan Queue consumer CPU (Task 8 → G-CPU);
   - the 3 MB script-size limit (Task 7 bundle test);
   - OpenNext honouring `expireTime`/`revalidate` (Task 2b Step 4, which falls back to dynamic rendering);
   - in the follow-up plan, before G2/G3: `secret put` without an asset re-upload, rollback secret behaviour, the Workers Builds SHA variable, pushes made with `GITHUB_TOKEN` triggering builds, and deploy hooks on the Free plan.

### R4.5 Final mandatory owner gates

**Executable plan:**

| Gate | Decision |
|---|---|
| **G0** | Approve this plan |
| **G-MIN** | Baseline Actions minutes before Task 0.1, repeated 14 days after Task 0.4 |
| **G1** | Any `config/publications.json` change (never part of this plan) |
| **G-225** | Decide PR #225 before Task 9 |
| **G-CPU** | Hold or cost decision for any feed over the CPU limit; no paid spend without cost approval |
| **G4** | Stop legacy writes (Task 10) and delete legacy keys (Task 17a; you run the script after a dry-run) |
| **G5** | Public health contract change (Task 12) |
| **G6** | Ruleset, only if the required checks change |
| **G7** | Dependabot and the two stale workflows |
| **G-AGENTS** | `AGENTS.md` text, including the move of source-membership ownership from `worker/feed-registry.js` to `feeds/` |

**Follow-up static-first plan** (decide only after F1 and F2 are fixed):

| Gate | Decision |
|---|---|
| **G9** | Go/no-go on the entry criteria |
| **G-DNS** | Non-production hostname |
| **G3** | Workers Builds connection, deploy hook secret, branch ruleset, `contents: write`, and the Cloudflare token, assumed account-wide |
| **G2** | Production cutover after the evidence pack |
| **G8** | Retire OpenNext, the Pages seed and `publication-recovery.js` |

### R4.6 Signature

**Chief of Staff (agent review, Opus) — APPROVED — 2026-11-06 (Round 4, final)**

This approval covers the executable plan `2026-11-06-feed-architecture-simplification.md` (r4) together with the target and review documents. The follow-up plan `2026-11-06-static-first-delivery.md` is recorded as **not executable until G9**, with F1 and F2 to fix first.

This is an agent sign-off produced by an independent reviewing agent. It is not owner approval. The owner remains the final approver of this package and of every gate in §R4.5. Nothing in this record authorizes a publication change, deployment, merge, credential action or paid spend.

---

## Round 3 — history (superseded by Round 4)

### R3.1 Executive verdict for the owner

1. **Final decision: APPROVED WITH CONDITIONS.** All 5 Round 2 defects (N1–N5) are resolved in the documents. I checked each one against the code and the live site.
2. **One condition remains before you see the package:** split the plan (ruling B in §R3.3).
   - The static-first tasks (13–16 and the static-first half of 17) depend on your go/no-go decision (G9), which rests on data nobody has measured yet.
   - They move to their own follow-up plan. Leaving them in would ask you to approve, now, work that cannot start yet.
3. **What you would approve:**
   - Workstreams 0–4;
   - the new cache-cap task (Task 2b);
   - the end-to-end "ready to scale" probe test (Task 18).

   Together these deliver the brief: feeds simplified before scaling, free tier only, and a smaller GitHub Actions footprint.
4. **Integrity holes are closed in the design:**
   - every evidence-bearing file is gated, and the gate also reads a `HELD_FEEDS` secret;
   - a malformed held-feeds secret makes everything unavailable (fail closed);
   - total cache lifetime is capped at 300 s for evidence and held pages (Task 2b);
   - health no longer loses its per-section reasons.
5. **The release flow is consistent:**
   - before cutover, the full release smoke test runs before the `release/verified` branch advances;
   - after cutover, `deploy.yml` checks only the data Worker before advancing it;
   - the reader-page check runs at the end of the Workers Builds build, with automatic rollback if it fails.
6. **Cache lifetimes today:** two GETs today confirm `stale-while-revalidate=48306` on `/data/metrics-snapshot.json` and `s-maxage=31536000` on the held `/section/nhs/` page. Task 2b fixes both, without waiting for G9.
7. **New findings, none blocking:**
   - **Token scope.** The plan says a Cloudflare token can be restricted to "write secrets on that Worker only". I do not believe Cloudflare API tokens can be scoped that narrowly; I did not verify this. The real control is the workflow test, and you should know this at G3.
   - **Rollback and secrets.** `wrangler rollback` may bring back an older version's `HELD_FEEDS` value (unverified).
   - **Byte estimate.** The live health-metadata estimate (about 190 B) is low; it is about 285 B once the held list is included. It still fits easily.
8. **Unverified assumptions are flagged and each has a fallback:**
   - `secret put` without an asset re-upload;
   - OpenNext honouring `revalidate`/`expireTime`;
   - Workers Builds exposing the commit SHA;
   - deploy-hook availability on the Free plan;
   - the 3 MB compressed script-size limit.
9. **Your decision points:**
   - the gates you decide while the main plan runs: G0, G-MIN, G-225, G-CPU, G4, G5, G7, G-AGENTS (and G6 only if the required checks change);
   - G9, G-DNS, G3, G2 and G8 move to the follow-up plan;
   - G1 publication changes are never part of either plan.
10. This is an agent sign-off. **You remain the final approver.**

### R3.2 Round 2 conditions (N1–N5)

| # | Condition | Verified at | Verdict |
|---|---|---|---|
| N1 | Release deadlock after cutover | **Plan Task 16:**<br>• pre-cutover, the full `test:release` (OpenNext reader revision) runs before the branch advances;<br>• post-cutover, only `verify-worker-deployment.mjs` and `release-smoke.mjs --data-only`;<br>• test: post-cutover `release/verified` advances after data-Worker checks only;<br>• test: pre-cutover it advances after the full reader smoke;<br>• test: data-only mode never requests reader pages.<br>**Plan Task 15:** `staticRelease()` runs build → deploy → reader SHA smoke → `wrangler rollback`, with test: smoke failure after deploy rolls back to the previous version.<br>**Target:** §6.3 and risk R17.<br>`release-smoke.mjs:35-40` checks reader revision meta, confirmed; `--data-only` therefore removes the dependency | **Resolved** |
| N2 | Single-deployer vs hold path | **Target §6.2/§6.3:** one actor, `deploy.yml` running `wrangler secret put HELD_FEEDS --name public-data-static`, stated as the only exception.<br>**Plan Task 16 tests that agree with each other:**<br>• no workflow deploys or uploads `public-data-static` code or assets;<br>• the only workflow command touching `public-data-static` is `wrangler secret put HELD_FEEDS`.<br>**Plan Task 15:**<br>• effective held set = held list baked in at build time ∪ `HELD_FEEDS`;<br>• test: an unparseable `HELD_FEEDS` makes every evidence file unavailable;<br>• Step 4 proves the no-re-upload behaviour or falls back to full pause | **Resolved.** Two items tracked: the token-scope claim (T-R3.1) and rollback re-asserting the secret (T-R3.2) |
| N3 | Health reasons lost | **Target §4.1:**<br>• metadata `x:"id:code,…"` with 1-character codes for the three `UNAVAILABLE_REASONS`;<br>• an unknown reason fails closed;<br>• `healthBodyFromMetadata` reproduces `unavailableSections[{id,reason}]`.<br>**Plan Task 10:** test that reasons round-trip for every `UNAVAILABLE_REASONS` value; overflow writes `t:1` plus `v20:edition:health`.<br>**Code:** `publication-availability.js:24-28` = `no-current-observation`, `collector-failed`, `not-scheduled`, confirmed. The public body uses `unavailableSections` (`public-data-entry.js`), confirmed.<br>**My byte check:** live state including the 6-id held list is about 285 B (Architect: about 190 B); the 17-feed worst case is about 683 B (Architect: about 715 B); 50 feeds overflow. Conclusions unchanged | **Resolved.** The live figure is understated; tracked as T-R3.4 |
| N4 | Cache-lifetime constraint broken today | **Plan Global Constraints:** lifetime = max(max-age, s-maxage) + `stale-while-revalidate` + `stale-if-error`.<br>**New Task 2b** (Sonnet, no dependency on G9):<br>• `cacheControlFor` limits stale-while-revalidate to 300 s minus the fresh period;<br>• `feed.xml` gets `max-age=300`;<br>• Next `expireTime: 300` plus `revalidate = 300`, with a fallback to dynamic rendering under `gateRoute`;<br>• `cacheLifetimeSeconds()` returns `Infinity` for an unparseable header, so it fails closed;<br>• release-smoke assertion; post-release curl check.<br>**Live check (today):** `/data/metrics-snapshot.json` `max-age=300, s-maxage=300, stale-while-revalidate=48306` and `/section/nhs/` `s-maxage=31536000, stale-while-revalidate=2592000`. Task 2b's tests use these exact values | **Resolved.** The OpenNext mapping is honestly marked *unverified*, with a fallback |
| N5 | Ordering and stale text | **Plan Task 7 Step 6** now uses only Task 3 and Task 6 outputs.<br>**New Task 18** depends on Tasks 5, 7 and 10, and on Task 14 only if G9 = go. It asserts routes, sitemap, `dueFeeds`, `gateRoute` and the edition build.<br>**Target risk row R7** is rewritten (full suite per code lane, no affected-only tests, no `main` suite).<br>**Ordering note:** Tasks 10 and 16 split at named seams above about 800 changed lines (this was T-R2.2) | **Resolved** |

### R3.3 Proportion ruling: **(B) split before the owner sees it**

**Why:**

1. The plan grew from 51 to 62 to 74 KB across five subsystems: CI lanes, policy consolidation, the feed-definition kit, pipeline and KV state, and static-first delivery. The writing-plans scope check says multi-subsystem work should be split so each plan produces working, testable software on its own.
2. Workstreams 0–4 do that without static-first delivery. The target itself says "If G9 is no-go, Workstreams 0–4 still stand on their own".
3. Static-first delivery cannot start until G9, and G9 depends on measurements that do not exist yet:
   - per-Worker traffic and CPU (issue #218);
   - the Task 14 build timing;
   - two still-unverified platform behaviours (`secret put` without an asset re-upload, and Workers Builds exposing the SHA).

   Approving it now asks the owner to approve unmeasured machinery. A separate plan lets G9 approve a plan, not just a checkbox.
4. Each remaining task is still a plan, not a transcript: decisions, signatures and named tests, with no code bodies. The size comes from scope, not verbosity, so splitting is the right fix, not trimming.

**Exact split** (an Architect edit: mechanical move, no content change):

**Keep in the executable plan** (`2026-11-06-feed-architecture-simplification.md`):

| Kept | Note |
|---|---|
| Tasks 0.1–0.4 | |
| Tasks 1, 2 and 2b | |
| Tasks 3–7 | |
| Tasks 8–12 | |
| **Task 17a** | The G9-independent part of Task 17: delete legacy KV keys (G4), delete the re-export shims, the `AGENTS.md` ownership update (G-AGENTS: `worker/feed-registry.js` no longer owns source membership once `feeds/` exists), and the docs and guard-script updates |
| Task 18 | Without its "if Task 14 exists" assertion |

Also kept: Global Constraints, including the 300 s cap; Review Focus items 4 and 5, plus a replacement item 1 on the cache-lifetime cap; the DoD without its "If G9 was approved" block.

**Move to a new follow-up plan** (`docs/superpowers/plans/2026-11-06-static-first-delivery.md`, status "not executable until G9"):

| Moved | Note |
|---|---|
| Tasks 13, 14, 15, 16 | |
| **Task 17b** | Retire OpenNext, `worker/web-wrangler.toml`, `open-next.config.template`, the Pages seed and `publication-recovery.js` (G8) |
| Task 18's edition-build assertion | |
| Review Focus items 1–3 | |
| DoD "If G9 was approved" block | |
| Gates G9, G-DNS, G3, G2, G8 | |
| Risk mappings | R1–R3, R12, R13, R16, R17 |

Exception: Task 13 Step 5's "polling removal only" fallback may be proposed from the follow-up plan under its own owner approval if G9 is no-go.

**Cross-references that must remain:**

1. The main plan's ordering table keeps one row: "Static-first delivery — see follow-up plan; requires G9".
2. The follow-up plan lists, as **Consumes**, the exact interfaces it builds on, with their main-plan task numbers:
   - `evaluate`, `projectPublic` and `routeAccess`/`RouteEntry` (Task 3);
   - `gateRoute` and `routeManifest` (Task 5);
   - `FEEDS` and the projections (Task 6);
   - `finalise` in `worker/pipeline.js` as the build-trigger hook point (Task 10);
   - `buildHealthMetadata` (Task 10);
   - `contracts/security-headers.js`, which **moves into Task 2b or Task 13 of the follow-up plan**. The Architect states which.
3. Target §6 stays in the target document, marked conditional on G9, and both plans link to it.
4. The follow-up plan's G9 entry criteria repeat the target's: measured per-Worker requests and CPU, Task 14 build time under 15 min and under 1,500 min/month, and proof of `secret put` without an asset re-upload.

### R3.4 Spot-checks this round

| # | Claim | Check | Result |
|---|---|---|---|
| S9 | `UNAVAILABLE_REASONS` at `publication-availability.js:24-28` | Read the file | **Confirmed:** 3 values |
| S10 | Metadata byte arithmetic | Built the metadata objects with the live edition id `catalog-6962a31c48cf1a25` | about 285 B live (the Architect understates this as about 190 B), about 683 B for 17 feeds; 50 feeds overflow. **Conclusion confirmed** |
| S11 | `release-smoke.mjs:35-40` checks reader revision | Read the file | **Confirmed.** `--data-only` is needed and is specified |
| S12 | Live cache headers that Task 2b targets | 2 GETs | **Confirmed:** `swr=48306` on the snapshot; `s-maxage=31536000` on `/section/nhs/` |
| X5 | `createAssetGate` env vs `heldFeedsFromConfig` | Task 15 `HELD_FEEDS?: string` (JSON) vs `heldFeedsFromConfig(): string[]`, serialised by `deploy.yml` (Task 16) | **Consistent** |
| X6 | `staticRelease` vs the workflow tests | `staticRelease` rollback runs inside Workers Builds; the Task 16 test forbids `rollback` only in workflows | **Consistent** |

### R3.5 Rubric (rows that changed from Round 2)

| # | Round 2 | Round 3 | Evidence |
|---|---|---|---|
| R4 Evidence integrity | PASS WITH CONCERN | **PASS** | N2 (one hold actor, a malformed secret fails closed) and N4 (lifetime cap defined, Task 2b, today's headers as test inputs) are resolved |
| R5 Migration safety | PASS WITH CONCERN | **PASS** | N1 resolved: phase-aware release flow and automatic static rollback |
| R6 Plan quality | PASS WITH CONCERN | **PASS** | N5 resolved, Task 18 added, split seams for Tasks 10 and 16 are named, and the cross-task interfaces checked out (X5, X6) |
| R8 Proportion and honesty | PASS WITH CONCERN | **PASS WITH CONCERN → PASS once split** | The 74 KB plan covers 5 subsystems. Ruling B fixes this. Two claims are understated or unverified but not flagged as such: the token scope (T-R3.1) and the live byte figure (T-R3.4) |

R1, R3 and R7 remain PASS. R2 remains PASS WITH CONCERN only for the Free-plan unknowns, which are measured in Tasks 8 and 14 and decided at G-CPU and G9.

### R3.6 DECISION (Round 3, final): **APPROVED WITH CONDITIONS**

#### MUST-FIX BEFORE EXECUTION

1. **P1 — Split the plan per ruling B (§R3.3).**
   - Fixed by: the Architect (mechanical move; no content change except Task 17 splitting into 17a/17b and Task 18 losing its Task 14 assertion).
   - Checked by: the Chief of Staff confirms every moved task appears exactly once in exactly one file, the Consumes list in the follow-up plan, and the ordering-table pointer row.
   - Owner decision: G0 is then taken on the executable plan only. The follow-up plan waits for G9.

#### TRACK DURING EXECUTION

1. **T-R3.1** (Architect correction before G3; owner informed). The G3 text and Task 16 say the deploy token "has secret-write rights on that Worker only". As far as I know (not verified), Cloudflare API tokens grant Workers script edit rights account-wide, with no secret-only or per-Worker scope.
   - Restate it honestly.
   - The control is the workflow test that only `secret put` touches `public-data-static`, plus code review.
2. **T-R3.2** (implementation-time check, Task 15). After any `wrangler rollback` in `staticRelease`, re-apply `HELD_FEEDS` from the current config, or assert that it was preserved, because a rollback may restore an older version's secret or bindings (unverified).
   - Test: `static release > rollback preserves the current held set`.
3. **T-R3.3** (implementation-time check, Task 16). When `staticRelease` rolls back, the data Worker is at the new SHA and the static Worker is not. The data API must stay backward compatible for one release, and the reader smoke must cover this skew.
4. **T-R3.4** (Architect, any time). Correct the live metadata estimate in target §4.1 to about 285 B.
5. **T-R3.5** (implementation-time check, Task 2b). Capping `stale-while-revalidate` raises revalidation requests to the data Worker. Record the per-Worker request delta after release against the 100k/day budget.
6. **Carried:** T-R2.1 to T-R2.5 and Round 1 T1–T9, all confirmed encoded in the plan's self-review and tasks.

### R3.7 Final mandatory owner gates

**Executable plan:**

| Gate | Decision |
|---|---|
| **G0** | Approve the split executable plan |
| **G-MIN** | Baseline and follow-up Actions minutes |
| **G1** | Any `config/publications.json` change (never in this plan) |
| **G-225** | PR #225 before Task 9 |
| **G-CPU** | Hold or cost decision for any feed over the CPU limit (Task 8); no paid spend without cost approval |
| **G4** | Stop legacy KV writes (Task 10) and delete legacy keys (Task 17a) |
| **G5** | Public health contract (Task 12) |
| **G6** | Ruleset, only if the required checks change |
| **G7** | Dependabot and stale workflow settings |
| **G-AGENTS** | `AGENTS.md` text, including the source-membership ownership move |

**Follow-up static-first plan** (not executable until G9):

| Gate | Decision |
|---|---|
| **G9** | Go/no-go on measured traffic, CPU, build time and the `secret put` proof |
| **G-DNS** | Non-production hostname |
| **G3** | Workers Builds connection, deploy hook secret, branch ruleset, `contents: write`, and token rights as honestly restated (T-R3.1) |
| **G2** | Production cutover after the evidence pack |
| **G8** | Retire OpenNext and the Pages seed |

### R3.8 Signature (Round 3, superseded)

**Chief of Staff (agent review, Opus) — APPROVED WITH CONDITIONS — 2026-11-06 (Round 3, final)**

This is an agent sign-off produced by an independent reviewing agent. It is not owner approval. The owner remains the final approver of this package and of every gate in §R3.7. Nothing in this record authorizes a publication change, deployment, merge, credential action or paid spend.

---

## Round 2 — re-confirmation (history, superseded)

### R2.1 Executive verdict for the owner

1. **Round 2 decision: APPROVED WITH CONDITIONS.**
   - 10 of the 12 Round 1 conditions are resolved in the documents, and 2 are partly resolved (M4, M7).
   - The edits introduced 5 new defects: N1–N5. All are short document edits.
   - Once they are fixed, the package is fit for your approval (G0).
2. The integrity holes are closed in the design:
   - every evidence-bearing static file is gated;
   - edition detail is cached for 60 s, with an ETag tied to the publication config;
   - a hold works through a gate-only update;
   - the run idempotency markers are kept.
3. The GitHub Actions plan is now safe:
   - full test suite in every code lane;
   - lanes chosen by which files `app/` imports;
   - nothing added to `main` deploys;
   - you record baseline minutes first (G-MIN).
   I checked the Architect's count of 27 test files that read the source tree directly; it is correct.
4. Static-first delivery is now behind your go/no-go (G9), with a no-go fallback. The scope is proportionate for that reason, although the plan grew to 62 KB.
5. **N1 (release deadlock).** `deploy.yml` advances `release/verified` only after `test:release` passes. But `test:release` checks the reader pages' revision meta, and after cutover those pages are served by the static Worker. That Worker is deployed only *after* `release/verified` advances. As written, no release could ever pass.
6. **N2 (contradiction).** The hold fast-path makes `deploy.yml` push a gate-only version of `public-data-static`. The plan also says Workers Builds is the *only* deployer, and tests that no workflow deploys that Worker.
7. **N3 (health detail lost).** Compact health metadata keeps only ids. Today's public health body also gives a reason for each unavailable section (live: `crimeStatistics`, `housePriceIndex`). So the planned parity test cannot pass, and the size arithmetic is incomplete.
8. **N4 (stated constraint already broken).** The new rule "no config-filtered response cached above 300 s" is broken today by `/data/metrics-snapshot.json` (`stale-while-revalidate` up to the remaining validity; 50,188 s live) and by held-notice HTML (`s-maxage=31536000`). No task fixes either unless you approve G9.
9. **N5 (ordering).** The "ready to scale" probe test (Task 7 Step 6) uses `dueFeeds` (Task 10), `gateRoute` (Task 5) and the edition build (Task 14), but Task 7 depends only on Task 6. Separately, the target's risk row R7 still describes the dropped affected-tests and main-suite design.
10. This is an agent sign-off. **You remain the final approver.**

### R2.2 Per-condition verdicts (M1–M12)

| # | Claimed fix | Where I verified it | Verdict |
|---|---|---|---|
| M1 | Every evidence-bearing file is gated or variant-paired, with a scan test | **Target:**<br>• §6.1 lists HTML, RSC payloads, `/_edition/<id>/*.json`, `/data/sections/*`, `/feed.xml` and `/sitemap.xml`;<br>• it adds "the build classifies every emitted file";<br>• §6.2 manifest has one entry per file;<br>• risk R12.<br>**Plan:**<br>• Review Focus 1;<br>• Task 14 `classifyEmittedFiles`, and the test that every emitted file containing fixture evidence values is served only through a gated pattern;<br>• Task 15 test that the gate covers RSC, edition JSON, downloads, feed and sitemap;<br>• `run_worker_first` generated from `manifest.files` | **Resolved.** Tracked: classification by value scan alone can miss reformatted numbers (T-R2.1) |
| M2 | `/data/edition.json` gets `max-age=60` plus a config-hash ETag | Target §4.3 states the cache policy and why it is not immutable.<br>Plan Task 11:<br>• ETag = `contentHash.publicationConfigHash`;<br>• the config hash uses `fnv64`, which exists (`worker/measure-catalog.js:136,215,288`);<br>• test: a publication hold changes the cacheable response identity, with no max-age above 60 and no `immutable`;<br>• new Global Constraint (≤300 s) | **Resolved** for this route. The Global Constraint it introduced is not met elsewhere (N4) |
| M3 | Lease, `dispatchedAt` and `finalisedAt` kept; 16 writes/run; 55 at 50 feeds | Target §4.1 run-key row cites `:121` and `:191`; I confirmed both in code.<br>Target §4.2 and §5 restate the budget.<br>Plan Task 10:<br>• keeps the `createRun`, `enqueuePublicationRun` and `finaliseRun` semantics;<br>• tests that a redelivered bootstrap never re-sends the collect batch and that a redelivered finalise after success writes nothing;<br>• `finalise` gains an `already-finalised` status;<br>• budgets of 16 and 60 appear in the Global Constraints and the DoD.<br>My recount: 3 + 10 + 2 + 1 = 16, and 3 + 49 + 2 + 1 = 55 | **Resolved** |
| M4 | `HELD_FEEDS` is updated by a gate-only deploy before any rebuild | Target §6.2:<br>• the gate rule `feeds ∩ HELD_FEEDS`;<br>• the gate-only version is honestly marked *unverified*, with the full-pause fallback.<br>Plan:<br>• Task 15 test that a feed held after build serves the unavailable variant even when the edition build fails;<br>• Task 15 Step 4 proves it on the non-production Worker, or returns to the owner;<br>• Task 16 test that the held-feeds gate update precedes any rebuild on a config change | **Partly.** The mechanism is sound, but the actor contradicts M9 (N2) |
| M5 | Lanes by import closure; `--changed` dropped; 27 file-reading tests; full trigger types; no added suites on `main`; G-MIN | Plan Workstream 0:<br>• lane table with `appImportClosure()`;<br>• Task 0.1 tests that a worker file imported by `app/` selects the app lane, and that the closure includes the three modules;<br>• the workflow test asserts all four `types` and no `--changed`;<br>• Task 0.3 test that lint and tests stay dispatch-only;<br>• G-MIN, before and after.<br>In code I confirmed:<br>• **27** test files import `fs` (28 including e2e);<br>• `app/` imports `@/worker/publication-currentness` ×5, `public-snapshot` ×3 and `feed-registry` ×3;<br>• those modules import only `contracts/*`, `feed-registry.js` and `publication-currentness.js`, so the closure is small and computable | **Resolved.** The target's risk row R7 still describes the dropped design (N5) |
| M6 | CPU measured in Task 8, before the pipeline rewrite; G-CPU | Plan:<br>• Task 8 "Runs **before** Tasks 9–10";<br>• it uses `wrangler tail` on the **current** pipeline, including `finalise-run`, and marks Node CPU indicative only;<br>• Task 9 depends on Tasks 8 and G-CPU.<br>Target §5 and migration step 6a are corrected, and the "Task 6" reference is fixed | **Resolved** |
| M7 | Compact health metadata, an overflow key, fail-closed, a test at 50 feeds | Target §4.1:<br>• the metadata shape and `v20:edition:health`;<br>• `truncated`;<br>• a mismatched or missing overflow key gives `degraded`/`ready:false`;<br>• risk R14.<br>Plan Task 10: `buildHealthMetadata` and the 50-feed test.<br>My size check: 17 compact ids plus the fixed fields is about 650–750 B, so it fits; 50 ids is about 1.1 KB, so it overflows and the fallback is exercised | **Partly.** Fail-closed is correct, but the metadata drops the per-section `reason` that today's public body carries (N3) |
| M8 | Dangling references inlined | Plan Task 3 lists the `publication-currentness.js` duplicates (`:45`, `:348` confirmed). Task 13 lists `fetchMetricsSnapshot` (`metricsSnapshot.ts:141` confirmed) and its callers `useMetrics.ts:302`, `DataExplorer.tsx:672` and `NationalEvidenceEdition.tsx:96` (all confirmed). No "D5/D6/D7", "M2" or "M6/M8" remains in the plan or target. The review's H1–H7 labels are self-contained in its own table | **Resolved** |
| M9 | Workers Builds is the only deployer, from `release/verified`, which advances only after release smoke | Target §6.3 "One deployer" and "Verified commit only". Plan:<br>• Task 16 tests that only Workers Builds deploys `public-data-static` and that `release/verified` advances only after release smoke passes;<br>• G3 includes `contents: write`.<br>`scripts/release-smoke.mjs:35-40` asserts the `public-data-revision` meta on reader routes | **Partly.** Single deployer and SHA pinning are specified, but the advance condition deadlocks (N1) and the hold path contradicts single-deployer (N2) |
| M10 | Static-first split into Tasks 13/14; G9 with a no-go fallback; header-survival tests | Target §6 makes G9 conditional, with the fallback. Plan:<br>• Task 13: export compatibility, poll removal and `contracts/security-headers.js`;<br>• Task 14: variants, manifest, build timing (<15 min, <1,500 min/month);<br>• Task 15 test that every response carries the security headers;<br>• Task 16 evidence pack: headers identical to today.<br>In code I confirmed:<br>• the three `searchParams` pages skip it under `STATIC_EXPORT` (`compare:20`, `measure:22`, `sources/[id]:141,157`);<br>• `next.config.ts` headers include COOP | **Resolved.** Tracked: `public/_headers` also sets `Cross-Origin-Resource-Policy`, which the new header set does not list (T-R2.4) |
| M11 | Interfaces reconciled | Target §3 and plan Task 3 match for:<br>• `evaluate(feed, record: SectionRecord \| null, …)` with the wrapper note;<br>• `RouteEntry.gate` including `"product"`;<br>• `projectPublic` nullable.<br>The bootstrap message carries `scope` (target §5 = Task 10). `buildHealthMetadata` is documented as distinct from `publicArtifactMetadata` at `publication-publisher.js:109`, which is confirmed to exist | **Resolved** |
| M12 | "3 hand-edited files plus regenerated projections"; derived `routeManifest`; wider probe test | Target summary item 1 and §3 route manifest; plan Task 5 test that section routes are derived from `FEEDS`; Task 7 Step 6 (assertions plus the git-diff check of exactly 3 hand-edited paths); DoD | **Resolved** in substance. Task ordering is defective (N5) |

### R2.3 Spot-checks (code and cross-task)

**Code**

| # | Claim | Check | Result |
|---|---|---|---|
| S1 | 27 test files read the source tree via `node:fs` | grep of `from "(node:)fs"` in `tests/` excluding e2e = 27. The named files `source-ownership`, `workflow-actions-allow-list`, `legacy-ingestion-retirement`, `cloudflare-edge-cache-config` and `feed-registry` all exist | **Confirmed.** My Round 1 count of 23 used a narrower pattern |
| S2 | `app/` imports `worker/` only through currentness ×5, public-snapshot ×3 and feed-registry ×3 | grep of `@/worker/` in `app/`; the import lists of those three modules | **Confirmed.** The closure stays inside `contracts/` plus those 3 modules |
| S3 | The run markers that M3 cites | `publication-run-lifecycle.js:121` (`if (created.run.dispatchedAt)`) and `:191` (`if (run.finalisedAt) return {…alreadyFinalised}`) | **Confirmed** |
| S4 | `fnv64` exists for the config hash | `worker/measure-catalog.js:136,215,288` | **Confirmed.** It is used there; the plan must import or export it |
| S5 | Line references for poll removal and duplicates | `fetchMetricsSnapshot` `metricsSnapshot.ts:141` plus 3 callers; currentness `:45`, `:348` | **Confirmed** |
| S6 | Security header set | `next.config.ts:15-24` includes COOP; `public/_headers` also has CORP | **Confirmed**, CORP noted |
| S7 | Release smoke checks reader-page revision | `scripts/release-smoke.mjs:16,35-40` | **Confirmed.** This is the basis of N1 |
| S8 | Health metadata size | Arithmetic in M7 | Fits at 17 feeds and overflows at about 50. Live body has `unavailableSections[{id,reason}]`, which is the basis of N3 |

**Cross-task interfaces and naming**

- **X1 (consistent):** `EditionManifest {editionId, builtAt, sha, files}` (Task 14) matches `createAssetGate(manifest)` (Task 15), the `--sha` build command (Task 15 Step 5) and the release-smoke assertion of manifest `sha` (Task 16).
- **X2 (consistent):** `HELD_FEEDS` is a JSON string (Task 15 env type `string`, test `'["gdpTracker"]'`), produced by `heldFeedsFromConfig(): string[]` in `scripts/gate-held-feeds.mjs`.
- **X3 (consistent):** `routeManifest()` is declared in Task 6 ("completed in Task 5"). Task 5 depends on Tasks 3 and 6.
- **X4 (broken):** Task 7 Step 6 consumes `dueFeeds` (produced in Task 10), `gateRoute` (Task 5) and the edition build input (Task 14), but Task 7 depends only on Task 6. This is N5.

### R2.4 Round 2 rubric (rows that changed)

| # | Round 1 | Round 2 | Evidence |
|---|---|---|---|
| R1 Objective fit | PASS WITH CONCERN | **PASS** | The claim is honestly restated: 3 hand-edited files plus regenerated projections. Routes are derived from `FEEDS`. The probe test covers projections, routes, downloads, release families, sitemap source, the held-by-default behaviour and a git-diff file count (Task 7 Step 6, DoD) |
| R2 Free-tier fit | PASS WITH CONCERN | **PASS WITH CONCERN** | New measurements and checks:<br>• build time measured with pass/fail thresholds (Task 14 Step 6);<br>• bundle size checked at 80% of the limit (Task 7);<br>• metadata overflow fails closed;<br>• Workers requests restated as 1–3 per view;<br>• the 3 MB script limit is marked unverified.<br>Remaining: the N3 reasons encoding changes the metadata size arithmetic, and on most days could cost the +1 write and +1 read |
| R3 GitHub Actions | PASS WITH CONCERN | **PASS** | One `quality` job; full suite in every code lane; build skipped only outside the `app/` import closure; no suites added to `main`; four trigger types tested; G-MIN before and after |
| R4 Evidence integrity | FAIL | **PASS WITH CONCERN** | M1, M2 and M4's mechanism are present and tested. Remaining:<br>• N2 (who performs a hold's gate-only update);<br>• N4 (`metricsSnapshot` `stale-while-revalidate` and held-HTML `s-maxage=31536000` stay outside any task unless G9 is approved) |
| R5 Migration safety | PASS WITH CONCERN | **PASS WITH CONCERN** | The run lease and markers are kept, and the degraded rollback after G4 is stated (target §4.1, step 6b). New: N1 release-flow deadlock at cutover |
| R6 Plan quality | PASS WITH CONCERN | **PASS WITH CONCERN** | Interfaces are reconciled (X1–X3), and the dangling references are gone. New: N5 ordering. Task 10 (pipeline, deadline, DLQ, health metadata, 11 tests) and Task 16 (trigger, deploy workflow rewrite, cutover) are oversized |
| R7 Delegation | PASS WITH CONCERN | **PASS** | Every Haiku task has a named Sonnet or Opus reviewer. Sonnet decides any merge of helpers with differing bodies (Task 7 Step 3). Opus reviews `deploy.yml`-adjacent Task 0.1 |
| R8 Proportion and honesty | PASS WITH CONCERN | **PASS WITH CONCERN** | At 62 KB the plan is still decisions, signatures and named tests, with no code bodies, so it is not a transcript. The growth is mostly the tests and gates I required. Workstream 5 machinery is now conditional on G9 with a fallback. Unverified items are flagged:<br>• the `HELD_FEEDS` gate-only deploy;<br>• deploy hooks;<br>• the SHA env var;<br>• the 3 MB limit.<br>Remaining: one plan still spans 5 subsystems (writing-plans suggests splitting). One unflagged assumption: that a `GITHUB_TOKEN` push to `release/verified` triggers Workers Builds (T-R2.3) |

R2 (free tier) and R4–R6 kept their concern ratings, for the reasons given in their rows. R1, R3 and R7 moved to PASS.

### R2.5 DECISION (Round 2): **APPROVED WITH CONDITIONS**

#### MUST-FIX BEFORE EXECUTION

All 5 are Architect edits. They must be in the documents before owner gate G0. The Chief of Staff re-checks the diff only.

1. **N1 — Release deadlock.** (Target §6.3, plan Task 16)
   - Before `release/verified` advances, `deploy.yml` checks only the data Worker: `verify-worker-deployment.mjs`, `/data/health.json` and the API routes.
   - The reader-route `release-smoke.mjs <sha>` runs at the end of the Workers Builds build, as Task 15 Step 5 already does.
   - Change the Task 16 test that `release/verified` advances only after release smoke passes to name the data-Worker checks.
   - Check: no step requires the reader revision before the static Worker can be deployed at that SHA.
2. **N2 — Single-deployer contradiction.** (Target §6.2–6.3, plan Tasks 15–16)
   - Name exactly one actor for the `HELD_FEEDS` gate-only update. Either `deploy.yml` (`wrangler versions upload/deploy` limited to a var change) as the one documented exception to the single-deployer rule, or a Workers Builds path.
   - Make the test that only Workers Builds deploys `public-data-static` and the test that the held-feeds update precedes any rebuild agree with each other.
3. **N3 — Health reasons.** (Target §4.1, plan Task 10)
   - Specify how per-section `reason` reaches the public health body: for example, reason codes in the compact metadata (redo the byte arithmetic at 17 and 50 feeds), or the overflow key whenever any section is unavailable (restate the write and read budget).
   - Keep `health > metadata-backed body equals legacy body` passable.
4. **N4 — Cache-lifetime constraint.** (Plan Global Constraints, plus a task independent of G9)
   - Either add a task that caps `stale-while-revalidate` on config-filtered `/data/*` responses and removes `s-maxage=31536000` from held-notice HTML under SSR, with tests, or restate the constraint so it does not claim something false today.
   - Define whether "cache lifetime" includes `stale-while-revalidate`.
5. **N5 — Ordering and consistency.** (Plan ordering table and Task 7 Step 6, target §9 R7)
   - Move the probe-feed assertions that need `dueFeeds`, `gateRoute` and the edition build into the tasks that produce them, or into a final DoD task that depends on Tasks 5, 10 and 14.
   - Rewrite target risk row R7 to match Workstream 0: full suite per code lane, no affected-only selection, no `main` suite.

#### TRACK DURING EXECUTION

1. **T-R2.1** (implementation-time check, Task 14): classify files by *provenance* first, i.e. which feeds the build rendered into each file, with the value scan as a backstop. The scan must normalise number formatting (e.g. `3.2`/`3.20`/`3.2%`).
2. **T-R2.2** (implementation-time check): split Task 10 (health metadata into its own reviewable task) and Task 16 (deploy-workflow rewrite separate from cutover) if either diff exceeds one reviewer sitting.
3. **T-R2.3** (implementation-time check, Task 15 Step 5): prove that a `GITHUB_TOKEN` push to `release/verified` triggers Workers Builds. Otherwise use a deploy-hook call from `deploy.yml`. Least-privilege scope for `contents: write` (branch-restricted).
4. **T-R2.4** (implementation-time check, Task 13): `contracts/security-headers.js` includes every header served today, including `Cross-Origin-Resource-Policy` from `public/_headers`.
5. **T-R2.5** (implementation-time check, Task 11): export `fnv64` for the config hash, or reuse it from a shared helper, rather than duplicating it.
6. **Carried from Round 1 and confirmed mapped in the plan's self-review:**
   - T1 → `runDeadline`;
   - T2 → bundle-size test;
   - T3 → Task 14 Step 6;
   - T4 → health parity test;
   - T5 → dual-write budget notes;
   - T6 → named reviewers;
   - T7 → Task 8 doc fixes;
   - T8 → finaliser CPU in Task 10 Step 3;
   - T9 → G-AGENTS.

### R2.6 Mandatory owner gates (final list)

| Gate | Decision |
|---|---|
| **G0** | Approve the package after the N1–N5 edits and the Chief of Staff diff re-check |
| **G-MIN** | Baseline and follow-up Actions minutes |
| **G1** | Any `config/publications.json` change (never in this plan) |
| **G-225** | Decide PR #225 before Task 9 |
| **G-CPU** | Hold or cost decision for any over-limit feed (Task 8) |
| **G4** | Stop legacy KV writes (Task 10) and delete keys (Task 17) |
| **G5** | Public health contract change (Task 12) |
| **G6** | Ruleset, only if the required checks change |
| **G7** | Dependabot and stale workflow settings |
| **G9** | Static-first go/no-go on measured traffic, CPU and build time |
| **G-DNS** | Any non-production hostname |
| **G3** | Workers Builds connection, deploy hook secret and `contents: write` grant |
| **G2** | Production cutover after the evidence pack |
| **G8** | Retire the Pages seed and OpenNext |
| **G-AGENTS** | Approve the text of any `AGENTS.md` change |

### R2.7 Signature (Round 2, superseded)

**Chief of Staff (agent review, Opus) — APPROVED WITH CONDITIONS — 2026-11-06 (Round 2)**

This is an agent sign-off produced by an independent reviewing agent. It is not owner approval. The owner remains the final approver of this package and of every gate in §R2.6. Nothing in this record authorizes a publication change, deployment, merge, credential action or paid spend.

---

## Round 1 — original review (history, superseded)

### 1. Executive verdict for the owner

1. **Decision: APPROVED WITH CONDITIONS.** The diagnosis is accurate. I independently confirmed 14 of 16 checked claims, and the other 2 are approximately right. Workstreams 0–4 address the brief. No execution until the 12 MUST-FIX edits below are made and re-checked.
2. The feed simplification is real, not a rename. About 20 files become 1 folder plus 1 index line. 7 Queue message types become 3. 18 KV key families become 5. 39 KV writes a day become about 14–16. Parity tests prove each move.
3. The free-tier arithmetic is broadly correct, and every component stays on free services. Most unverified limits are honestly flagged. There is one exception: the plan relies on 1,024 B of KV metadata at 50 feeds, and that space is not enough.
4. **Evidence integrity fails as written (R4)**, in the static-first part (Tasks 10 and 13–15) only:
   - edition detail would be cached as immutable for 1 year, although it is filtered by mutable publication config;
   - the gate covers HTML, but not the Next RSC payloads or the `/_edition/*.json` assets;
   - a hold only takes effect if the full static rebuild succeeds.
   Each of these can serve held or expired evidence.
5. Task 9's "1 run write" drops the `dispatchedAt`/`finalisedAt` markers. The PR #225 retry safety depends on them (`publication-run-lifecycle.js:121,191`). That safety must be kept.
6. The GitHub Actions plan (Workstream 0) is cheap and keeps the `quality` check name, but its fast paths are unsafe:
   - the app imports `worker/` modules, yet the worker lane skips the build;
   - 23 test files read the source tree directly, which `vitest --changed` cannot detect;
   - Task 0.3 adds a full test suite to every `main` deploy, which adds Actions use rather than removing it.
7. Static-first delivery (Workstream 5) is the largest and least-evidenced part. It brings a third Worker, two build variants per route and a deploy hook, while traffic and CPU attribution are still unmeasured. It needs its own go/no-go decision from you after measurement.
8. The CPU measurement (Task 12) is ordered after the pipeline rewrite (Task 9). It must come before it, because the whole design assumes the parsers fit on the free tier.
9. No task flips `config/publications.json`, and your gates G1–G8 are well placed. I add 5 mandatory gates in §5.
10. This is an agent sign-off. **You remain the final approver.**

### 2. Rubric

| # | Criterion | Rating | Evidence |
|---|---|---|---|
| R1 | Objective fit | **PASS WITH CONCERN** | **Real reduction, quantified before and after:**<br>• files per feed: 20 → 3 hand-edited;<br>• message types: 7 → 3;<br>• runner modules: 4 → 1 (`pipeline.js`);<br>• key families: 18 → 5;<br>• writes per run: 39 → 14;<br>• finaliser reads: about 65 → 13;<br>• policy modules: 6 → 1, with 19 currentness call sites and 34 route-gate calls going through one API.<br>Projections are parity-tested against frozen legacy shapes (Task 6), so this is not a re-layering.<br>**Concerns:**<br>• "≤3 files" counts only hand edits. Regenerated `section-discovery.json`, `measure-definitions.json`, `public-surfaces.json` and `source-ownership.json` also change in the same PR.<br>• `contracts/routes.json` is hand-written with `feeds: [feedId]` per route, and its dynamic `/section/[slug]` entry cannot express per-slug feeds. Unless derived, it is a 4th file.<br>• A feed with a bespoke view still needs a component.<br>• The DoD probe test (Task 7 Step 5) checks only registry projections, not routes, sitemap or downloads. |
| R2 | Free-tier fit | **PASS WITH CONCERN** | My arithmetic is in §2a. KV, Queues, static file count and Workers requests all have ample headroom, and no paid component is used.<br>Correctly flagged as unverified:<br>• Queue consumer CPU on the Free plan;<br>• deploy-hook availability;<br>• edge honouring of `s-maxage`.<br>Presented as fact, but unmeasured or wrong:<br>• (a) the "about 5 min per build" estimate. Two variant builds of about 200 routes, plus `npm ci` of 945 packages, is plausibly 10–15 min, against a 20-min build timeout;<br>• (b) `publicArtifactMetadata` ≤1,024 B, tested only at 17 feeds. At 50 feeds, the `unavailable[{id,reason}]` list is about 50 × 45 B ≈ 2.2 KB, which overflows;<br>• (c) the Worker script-size limit for a data Worker bundling about 50 parsers is not considered at all. |
| R3 | GitHub Actions footprint | **PASS WITH CONCERN** | **Good:**<br>• one job named `quality`;<br>• the stale `codex/hermes-v1` trigger is removed (confirmed `pr-validation.yml:5`);<br>• one lockfile;<br>• grouped monthly Dependabot;<br>• allow-list unchanged;<br>• no new large job on PRs.<br>**Risks:**<br>• (a) `worker` lane ⇒ no Next build. But `app/` imports `@/worker/publication-currentness` (5 imports), `public-snapshot` (3) and `feed-registry` (3), so a worker-only PR can break the production build and still pass `quality`.<br>• (b) `vitest --changed` follows the import graph. The 23 test files that read files directly (source-scanning guards such as `policy-single-owner`, `route-manifest` and `dead-code`) will not run.<br>• (c) The workflow test asserts that `types` includes `ready_for_review`, but not `opened/synchronize/reopened`. If those are missing, a draft-time success persists.<br>• (d) Task 0.3 adds lint plus the full suite to every `main` push (today it runs only on `workflow_dispatch`, `deploy.yml:80-81`, by design per `deployment-ci-frugality.md`). Regressions are then caught after merge on the release branch, and Actions use goes up.<br>• (e) No baseline minutes are recorded (235 s aggregate per PR run is the last documented figure). |
| R4 | Evidence integrity and governance | **FAIL (fixable by Architect edits)** | **Weakens "held never served / fail-closed":**<br>• (1) Task 10 sets `/data/edition.json` to `public, max-age=31536000, immutable`. The response is filtered by `filterPublicationCatalog`/`filterPublicationSummary` against the deployed `PUBLICATION_CONFIG` at request time (`public-data-entry.js:399`, live `no-store` today). A later hold could not be removed from browser or shared caches for a year, and `cross_version_cache=false` protects only the Workers cache.<br>• (2) The gate's `run_worker_first` covers HTML evidence routes. Next static export also emits RSC payload files that client-side navigation fetches, and the target puts Explorer data in `/_edition/<id>/snapshot.json`. Neither is gated or variant-paired, so expired evidence remains reachable after `validUntil`.<br>• (3) Holds and retractions take effect only through a successful full rebuild (target §6.2). If the build fails, held evidence keeps being served until its own `validUntil`, which can be 45 days.<br>**Correctly gated:**<br>• G5 for the health contract (Task 11 implements only after approval; additive-first R10);<br>• G1 never exercised;<br>• G3 credential handled by you, not the agent;<br>• G2 cutover;<br>• G4 key stop and deletion;<br>• G8 retirement.<br>Clocks stay separate, `now >= validUntil` is the boundary, and unknown ids are held. |
| R5 | Migration safety | **PASS WITH CONCERN** | Strangler steps with a revert per step; dual-write and dual-read for 7 days; the OpenNext Worker stays deployed 14 days after cutover with a 1-minute route rollback.<br>**Concerns:**<br>• Task 9 removes the `dispatchedAt` write-ahead confirmation and the `finalisedAt` idempotency marker without a replacement. Code depends on both (`publication-run-lifecycle.js:121`, `:191`).<br>• Once G4 stops legacy writes, rolling back to the previous data Worker means reading stale v12 fragments. That fails closed but degrades, and the plan does not say so.<br>• Task 13 is close to big-bang: converting all evidence pages to `output: "export"` (3 pages use `searchParams`, route handlers, redirects) plus the variant build plus the manifest, in one task.<br>• Security headers (CSP/HSTS/XFO set in `next.config.ts` `headers()`, which static export does not apply) are not addressed for gated responses. |
| R6 | Plan quality | **PASS WITH CONCERN** | **Good:** named failing tests with assertions, exact commands, file lists, an ordering table and a DoD. All 5 Review Focus lines are pinned to named tests (Tasks 0.1, 3, 6, 8, 13, 14).<br>**Interface spot-check across 6 tasks found drift:**<br>• `evaluate(feed, record, …)` takes `FeedRecord` in target §3, but `object` in Task 3, while Task 8's `FeedRecord` is a wrapper `{feedId, record, lastAttempt}`. It is ambiguous which one is passed.<br>• `RouteEntry.gate` has `"product"` in Task 3 but not in target §3.<br>• `projectPublic` return values are nullable in Task 3 but not in the target.<br>• The bootstrap message loses `scope` (target §5 vs Task 9).<br>• Task 9's new `publicArtifactMetadata(edition)` reuses the name of the existing 2-argument function `publicArtifactMetadata(publication, artifact)` (`publication-publisher.js:109`) with a different shape.<br>• Target §5 says "Task 6 measures CPU"; the plan's measurement is Task 12.<br>**Dangling references** that an implementer cannot resolve: "H6 table D5/D6/D7", "M2", "M6/M8". The Haiku inventories are not in the repo.<br>**Size and scope:** Task 13 is oversized. The plan covers 5 subsystems, where the writing-plans scope check advises splitting.<br>**Gap:** the Review Focus misses the most likely integrity escape (ungated non-HTML evidence assets). |
| R7 | Delegation | **PASS WITH CONCERN** | Grunt work is sensibly delegated to Haiku: inventories, deletions, fixture capture, `legacy-projections.json`, evidence-pack capture. Judgment stays with Opus: policy, pipeline, gate, CPU verdict. The review shows Haiku output being re-verified, and it corrected two Haiku errors (H2 understatement, H3 reads).<br>**Concerns:**<br>• Task 0.3 (editing the release-critical `deploy.yml`) is Haiku-only, with no named reviewer.<br>• Tasks 0.4 and 1 have no named reviewer.<br>• Task 7 lets Haiku merge helpers whose bodies differ (`decodeHtml` ×9, not identical). That is a correctness judgment, not a mechanical move. |
| R8 | Proportion and honesty | **PASS WITH CONCERN** | The 51 KB plan is a plan, not a code transcript: signatures and tests only, with no function bodies beyond the lane table and gate rule. Most unverified figures are labelled, including the 717 PR runs, consumer CPU, hooks and `s-maxage`.<br>**Overstated or speculative:**<br>• Workstream 5 adds machinery before you have measured that SSR is the cost driver: CPU-limit attribution is "unverified", and per-Worker traffic is unmeasured (#218).<br>• Several figures are stated as fact: "≤3 files", the 5-min build, "≤1 Worker request per view" (which ignores gated RSC/JSON fetches) and the 1,024 B metadata at scale.<br>• Rejecting D1, DO and R2 is proportionate and well argued. |

#### 2a. Independent free-tier arithmetic

Free-plan limits used, from current Cloudflare documentation as I know it: Workers 100k req/day and 10 ms CPU; KV 1,000 writes, 100k reads, 1,000 deletes and 1 GB per day/account; Queues 10k operations/day and 24 h retention; Static Assets 20,000 files and 25 MiB/file; Workers Builds 3,000 min/month, 1 concurrent and 20-min timeout.

| Resource | Today (measured or code-traced) | Target, 11 feeds | Target, 50 feeds | Verdict |
|---|---|---|---|---|
| KV writes/day (healthy) | 39 (traced: 3 run + 10 run-fragment + 10 global + 11 terminal + 2 contracts + 3 publish) | 14 as designed. **16** once the run `dispatched`/`finalised` markers are kept (M3). 49 during the dual-write window | 53 → about 55 with M3 | ≤6% of 1,000. OK. Worst case of 4 failed attempts on every job at 50 feeds is about 255, about 26%. OK |
| KV reads/day | Health: 2 per page view (`no-store`, polled by 18 page modules plus hourly). Editions list: 1 + 2N + corrections per uncached request (N = 7 live today, up to 60) | Finaliser 13 per run, health 1, list 1. Reader pages 0 | Finaliser about 52 | OK. Today's health poll alone caps the site near 50k views/day on KV reads |
| Workers requests/day | About 3–4 per evidence page view (SSR + data subrequest + health), so about 25–33k views | 1 per evidence HTML view. Plus 1 per gated RSC/JSON fetch once M1 is fixed, so about 1–3 on client navigation. 0 for static pages | Same per view | Still roughly a 3× gain. "≤1 per view" holds only for full-page loads |
| Queue operations/day | About 13 messages × about 3 = about 40 | About 14 × 3 = about 42 | About 57 messages (50 + 7 shards) × 3 = about 170. With 3 retries on all, about 680 | ≤7%. OK |
| Static asset files | n/a | About 200 routes × 2 variants × (HTML + RSC payload) + JSON ≈ 1–2k | About 3–5k if measures grow | <25% of 20k. OK |
| Workers Builds min/month | n/a | Designer's estimate 4 builds/day × 5 min × 30 = 600 (20%). **My estimate:** 10–15 min per two-variant build ⇒ 1,200–1,800 (40–60%) | Grows with pages | **Unverified. Must be measured (T3).** The 20-min timeout is the binding risk |
| KV metadata per value | 1,024 B limit | About 17 feeds fit | **About 2.2 KB worst case, which overflows** | **Design gap (M7)** |
| Queue consumer CPU | Free-plan limit unverified; consumers parse XLSX/PDF today | Same | 50 parsers; the finaliser builds an artifact of about 2 MB | **Unverified, load-bearing, must be measured first (M6)** |
| Worker script size | Not measured | Not considered | About 50 parsers plus `_kit` in one bundle | **Track (T2)** against the Free-plan compressed-size limit |

### 3. Independent verification of the Architect's claims

| # | Claim | My check | Result |
|---|---|---|---|
| 1 | A feed is described across about 20 non-test files (`realWages` named in 20) | `grep -rlE 'realWages\|real-wages'` excluding tests, generated files and docs ⇒ 19, plus `docs/architecture/source-ownership.json` = 20 | **Confirmed.** Some are incidental mentions, e.g. `HousePriceIndex.tsx` and `ReleaseCalendar.tsx`, so "registration edits" is somewhat lower than 20 |
| 2 | 39 KV writes per healthy daily run | Traced `kvPut` sites:<br>• run create/dispatched/finalised (`publication-run-lifecycle.js:99,172,240`);<br>• run-fragment and global fragment (`publication-collection-runner.js:59,74`);<br>• 1 success terminal per job (`publication-queue-dispatcher.js:145`);<br>• contracts shard and current (`government-contracts-cloudflare.js` `writeJson`);<br>• public, current and status written on every publish (`publication-publisher.js:248,254,257`).<br>`config/publications.json` has 10 published sections in `SECTION_COLLECTION_PLAN`, plus contracts = 11 jobs | **Confirmed** at 3+10+10+11+2+3. Assumes steady state: 1 contracts day shard and no `kept-newer` |
| 3 | RSS and sitemap are built from a committed 1 Oct snapshot and serve expired evidence | `git ls-files app/generated` lists `metricsSnapshot.ts` (273,371 B, `generatedAt` 2026-10-01). `feed.xml/route.ts` imports it with `force-static`. `getBuildPublication` checks `status !== "ok"` only. Live `/feed.xml` ("latest verified evidence") contains 2026-09-27/28 polling with `max-age=3600`. Live snapshot polling period is 2026-11-01/02 | **Confirmed.** This is a live integrity defect |
| 4 | Every page is server-rendered per request | `serverMetricsSnapshot.ts:29` `await connection()`, then a fetch of `https://public-data.org/data/metrics-snapshot.json`. 14 app files reference `readServerMetricsSnapshot`. Live `/editions/` is `private, no-cache, no-store`, 861,205 B, 2.07 s | **Confirmed** |
| 5 | `/data/editions.json` hashes every retained edition per uncached request | `edition-archive.js` `listEditionSummaries` calls `readEditionRaw` per index entry, which does `getWithMetadata` + `get` + `sha256` + `JSON.parse` + validate. Live list `max-age=60`, retention **7** today. Live detail 285,273 B | **Confirmed.** Today N = 7, not 60; 60 is the ceiling. The CPU >10 ms figure is unmeasured, as the Architect says |
| 6 | Health is permanently degraded because `nhsStats` is required but held | `source-catalog.js` nhsStats `publicationRequirement: "required"`. `feed-registry.js:37-41` filters on requirement only. Config has `nhsStats: held`. Live health: `{"status":"degraded","missingRequiredSections":["housePriceIndex","nhsStats"],…}` | **Confirmed.** G5 alone will **not** make health `ready` today, because `housePriceIndex` (published, no current observation) is a real gap. The plan's Task 11 test models this correctly |
| 7 | About 19 `filterCurrentSnapshot` call sites | `grep 'filterCurrentSnapshot('` over app, worker, scripts and contracts ⇒ 20 occurrences in 14 files, 1 of them the definition (`publication-currentness.js:264`) | **Confirmed** (19 calls) |
| 8 | PR checks target the stale branch `codex/hermes-v1` | `pr-validation.yml:5` `branches: ["main", "codex/hermes-v1"]` | **Confirmed** |
| 9 | 7 Queue message types | Unique type literals in dispatcher, job runner and plan: `bootstrap-publication`, `finalise-run`, `finalise-international-comparison`, `refresh-international-comparison`, `refresh-section`, `refresh-external-section`, `refresh-contracts` | **Confirmed** |
| 10 | 33 route-gate calls in 24 app files; 6 policy modules with 1,885 lines | grep of the 5 resolver names in `app/` ⇒ 34 calls in 24 files. `wc -l` of the 6 modules = 1,885 | **Confirmed** (34 vs 33, which does not matter) |
| 11 | Worker tree has 58 JS files and 14,114 lines | `ls worker/*.js \| wc -l` = 58; `cat \| wc -l` = 14,114 | **Confirmed** |
| 12 | The held story is titled "temporarily offline" and HTML carries `s-maxage=31536000` | Live `/stories/household-budgets/` title "Data publications are temporarily offline"; `/section/nhs/` and the story both `s-maxage=31536000, stale-while-revalidate=2592000` | **Confirmed** |
| 13 | Edition detail is `no-store` today | Live `/data/edition.json?edition=…` `cache-control: no-store`; code `public-data-entry.js:399` | **Confirmed.** This also shows that the Task 10 immutable header is a behaviour change on a config-filtered response (M2) |
| 14 | `free-resource-budget.md` is stale (only `nationalDebt`, 2 deliveries/day) | Config has 11 published sources plus the archive. The doc also says edition detail is "cached as immutable for one year", which contradicts the code | **Confirmed**, with one more drift item found |
| 15 | Queue consumer is batch 1, concurrency 1, no DLQ; finaliser waits a fixed 20 min | `wrangler.toml` consumer block; `FINALISE_DELAY_SECONDS = 20 * 60` | **Confirmed** |
| 16 | The two OpenNext versions differ | `worker/package.json` pins `1.20.2`; root `^1.20.7` | **Confirmed.** No recorded reason for the pin was found, so Task 0.2 must run the full build (it does) |

**Claims that are wrong, overstated or unverifiable:**

1. **Target §4.1 / Task 9: "1 run write, no dispatched/finalised rewrites".** This is a design omission. Current resumability and idempotency read `dispatchedAt` (`:121`) and `finalisedAt` (`:191`), and the review's own §D says #225 run isolation must be preserved.
2. **"Adding a feed touches ≤3 files".** Overstated: it is ≤3 hand-edited files plus regenerated projections, and possibly `routes.json`.
3. **Health in KV metadata ≤1,024 B.** True at 17 feeds. Likely false at 50 feeds in the worst case.
4. **About 5 min per edition build.** An unmeasured estimate presented in a budget line. Two-variant export builds plausibly take 2–3× longer.
5. **"≤1 Worker request per evidence view, 0 KV".** Holds only if RSC payload and `/_edition/*` assets bypass the gate, and they must not (M1).
6. **Target §5 "Task 6 measures CPU … before the cutover".** Wrong cross-reference (it is plan Task 12), and Task 12 depends on Task 9, which contradicts it.
7. **Unverifiable here and labelled as such by the Architect:** the 717 PR and 53 Dependabot runs; Free-plan Queue consumer CPU; Workers Builds deploy hooks on the Free plan; edge `s-maxage` honouring; attribution of the 20 Oct CPU-limit exceptions.

### 4. DECISION: **APPROVED WITH CONDITIONS**

The package may go to the owner for approval once the MUST-FIX items are edited into it and re-checked by the Chief of Staff. No task, including Workstream 0, starts before then.

#### MUST-FIX BEFORE EXECUTION

1. **M1 — Gate every evidence-bearing asset, not only HTML.** (Architect edit: target §6.1–6.2, Task 13, Task 14, Review Focus)
   - Next export RSC payload files, `/_edition/<id>/*`, `/data/sections/*`, `/feed.xml` and `/sitemap.xml` must be gated and variant-paired.
   - Add a Task 13 test: `edition build > every emitted file containing fixture evidence values is served only through a gated pattern`.
   - Add the matching Review Focus line.
   - Check: the test name appears in Task 13, and the gate patterns in Task 14 list these classes.
2. **M2 — Remove the 1-year immutable caching of `/data/edition.json` from Task 10.** (Architect edit)
   - The response is filtered by mutable publication config at request time.
   - Either keep `no-store` or a short TTL capped by the next deploy, or put a publication-config hash in the URL.
   - Add test `edition detail > a publication hold changes the cacheable response identity`.
3. **M3 — Preserve run idempotency and the dispatch lease.** (Architect edit: target §4.1/§4.2/§5, Task 9)
   - Specify where the `dispatchedAt` and `finalisedAt` equivalents live.
   - Add tests: `pipeline > redelivered bootstrap never re-sends collect batch` and `pipeline > redelivered finalise after success writes nothing`.
   - Restate the write budget (expected about 16, not 14) in the Global Constraints, Task 9 and the DoD.
4. **M4 — A hold or retraction must not depend on a successful static rebuild.** (Architect edit: target §6.2, Tasks 14 and 15)
   - Define a fast path, e.g. gate-config redeploy forcing the pre-built unavailable variants of routes that embed the held feed.
   - Add test `asset gate > a feed held after build serves the unavailable variant even when the edition build fails`.
5. **M5 — Make the Workstream 0 lanes safe and cost-neutral.** (Architect edit: Tasks 0.1 and 0.3; owner supplies baseline numbers)
   - Any `worker/` file imported, directly or transitively, by `app/` selects the `app` or `full` lane.
   - The 23 file-reading guard tests always run in the `worker` and `app` lanes.
   - The workflow test asserts `types` includes `opened`, `synchronize`, `reopened` and `ready_for_review`.
   - Either drop the new full suite on every `main` push, or justify it with measured PR-minute savings that exceed it.
   - Record the baseline and post-change Actions minutes from the repository's usage page.
6. **M6 — Measure collector CPU first.** (Architect edit: ordering table, Task 12, target §5)
   - Move Task 12 Steps 1–2 (`wrangler tail` `cpuTime` per job on the **existing** pipeline) before Task 8.
   - Mark `node --cpu-prof` as indicative only.
   - Fix the "Task 6" cross-reference.
   - An over-limit feed triggers your cost or hold decision before any pipeline work.
7. **M7 — Handle the KV metadata overflow at scale.** (Architect edit: Task 9, target §4.1)
   - The test must cover 50 synthetic feeds, all unavailable with reasons.
   - Define fail-closed overflow behaviour, e.g. counts plus `truncated: true`, with health then reading the artifact body.
   - Check: test `artifact metadata > 50 feeds all unavailable stays within 1024 bytes or degrades closed`.
8. **M8 — Resolve the dangling references.** (Architect edit)
   - Inline the "H6 table D5/D6/D7", "M2" and "M6/M8" items into Tasks 3, 4 and 13 with file:line.
   - Or commit the inventories under `docs/architecture/` and link them.
9. **M9 — One deployer and an exact SHA for the static Worker.** (Architect edit: Tasks 14, 15 and 16)
   - Workers Builds and `deploy.yml` must not both deploy `public-data-static`.
   - Edition rebuilds deploy the last release-verified SHA, never unverified `main` HEAD.
   - `test:release` verifies the SHA after every edition build.
10. **M10 — Separate go/no-go and decomposition for Workstream 5.** (Architect edit + owner decision)
    - Tasks 13–16 start only after a new owner gate (G9, below) that is backed by measured per-Worker requests and CPU (issue #218).
    - Split Task 13 into reviewable tasks: export-compatibility of `compare`, `measure` and `sources/[id]` (`searchParams`) and of route handlers; the variant build; the manifest.
    - Each split task must test that security headers (CSP, HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy) are present on responses returned via `ASSETS.fetch` from the gate.
11. **M11 — Reconcile interfaces across the target and the plan.** (Architect edit)
    - The `evaluate` record argument (inner record vs the `FeedRecord` wrapper).
    - The `RouteEntry.gate` enum (`"product"`).
    - `projectPublic` nullability.
    - The bootstrap message `scope`.
    - Rename the Task 9 metadata builder so it does not collide with `publicArtifactMetadata(publication, artifact)` at `publication-publisher.js:109`.
12. **M12 — Make the "ready to scale" claim honest and tested.** (Architect edit: target summary item 1, Task 5, Task 7 Step 5, DoD)
    - Restate it as "3 hand-edited files plus regenerated projections".
    - Derive per-feed route-manifest entries from `FEEDS`.
    - The probe test asserts the new feed appears in the projections, route manifest, download ids and release families, and is held, not collected, not routed and not built, until G1.

#### TRACK DURING EXECUTION

1. **T1** (implementation-time check, Task 9): derive the finaliser deadline from measured job durations and N. The fixed 20/25 min with concurrency 1 will mark runs `incomplete` at about 50 feeds. Add a test at 50 synthetic feeds.
2. **T2** (implementation-time check, Tasks 7 and 9): record data-Worker bundle size from `wrangler deploy --dry-run --outdir` per batch, and fail CI if it exceeds 80% of the Free-plan script-size limit.
3. **T3** (implementation-time check, Task 13): measure build duration. Each edition build must stay under 15 min (20-min timeout), and the projected monthly total under 50% of 3,000 min. Otherwise, come back to you before G3.
4. **T4** (implementation-time check, Task 9): before G5, health served from metadata must be byte-identical to today's body for the same state (`health > metadata-backed body equals legacy body`).
5. **T5** (implementation-time check, Tasks 8 and 9): record the dual-write KV budget (about 49/day) and the degraded rollback after G4 in `free-resource-budget.md`.
6. **T6** (delegation check, Tasks 0.3, 0.4, 1 and 7): Haiku output on `deploy.yml`, Dependabot and deletions gets a named Sonnet review before merge. Merging helpers whose bodies differ (`decodeHtml` etc.) is Sonnet work, not Haiku.
7. **T7** (Architect / owner): fix the drift in `free-resource-budget.md` (11 sources, 12 deliveries/day; its "detail cached as immutable" contradicts code), and update the master plan's Wave 1 `PUBLICATION_COMMIT_KEY` note once you decide #225.
8. **T8** (implementation-time check, Task 9): measure finaliser CPU when building and hashing a 50-feed artifact (about 2 MB) on the consumer.
9. **T9** (owner): `AGENTS.md` edits in Task 16 need your explicit approval of the text.

### 5. Owner decision gates I consider mandatory

The Architect's G1–G8 are retained unchanged: G1 publication state (never in this plan), G2 production cutover, G3 Workers Builds connection and hook secret, G4 KV key stop and deletion, G5 health contract, G6 ruleset (only if the check list changes), G7 repository settings/Dependabot, G8 Pages seed and OpenNext retirement. I add:

- **G0 — Approve this package** after the MUST-FIX edits, on the Chief of Staff's re-check.
- **G-225 — Decide PR #225** (the current run/commit protocol) before Task 8. The pipeline design builds on it.
- **G-CPU — Cost or hold decision** after the M6 measurement, for any feed over the Free-plan consumer CPU limit. No paid executor without your approval of the cost.
- **G9 — Go/no-go for Workstream 5** (static-first, Tasks 13–16) on measured per-Worker request and CPU attribution (issue #218) and the T3 build-time result.
- **G-DNS — Any new hostname** (e.g. `next.public-data.org`) for the non-production gate route.
- **G-AGENTS — Approve the text** of any change to `AGENTS.md` (Task 16).

### 6. Signature (Round 1, superseded)

**Chief of Staff (agent review, Opus) — APPROVED WITH CONDITIONS — 2026-11-06**

This is an agent sign-off produced by an independent reviewing agent. It is not owner approval. The owner remains the final approver of this package and of every gate listed in §5. Nothing in this record authorizes a publication change, deployment, merge, credential action or paid spend.
