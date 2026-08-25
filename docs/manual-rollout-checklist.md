# Operations and recovery checklist

Routine data publication is automatic on Cloudflare. This checklist covers repository release verification, incident response and rollback—not a daily manual process.

## One-time account setup

- Confirm the `public-data-org` Pages project is available as the bounded seed/fallback object source. The normal `public-data.org` application route belongs to `public-data-web`.
- Create the protected GitHub environment `cloudflare-internal-worker`; the current combined deployment job uses it for both Worker deployments and the optional Pages seed refresh.
- Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to that environment. If Pages deployment is later split into its own job, use a separate `cloudflare-pages` environment for that job rather than broadening the Worker environment.
- Restrict the token to the intended account and `public-data.org` resources while permitting Worker deployment, Worker routes, Queues, KV bindings and Pages deployment.
- Do not manually create `public-data-jobs`; the production workflow reconciles it.
- Review environment protection rules. Required reviewers turn an otherwise automatic deployment into an approval step.

## Normal release

1. Merge a validated pull request into `main`.
2. The `Deploy public-data.org` workflow automatically:
   - enforces `refs/heads/main`;
   - validates and builds the repository, static seed and OpenNext Worker;
   - audits production dependencies;
   - creates or reconciles `public-data-jobs` with one-day retention;
   - deploys and verifies `pulse-data-worker` using the exact release SHA tag;
   - bootstraps national publication and queues the isolated comparison refresh;
   - deploys and smoke-checks `public-data-web`;
   - verifies request-time HTML, national health/snapshot, comparison, sections and discovery surfaces;
   - refreshes the Pages seed only after production verification, and treats that fallback refresh as optional.
3. No action is required for subsequent data refreshes. Cloudflare Cron and Queue own them.

Manual workflow dispatch is recovery-only and must target the current `main` ref.

## Runtime verification

Check the exact public boundaries:

- `/data/health.json` returns HTTP 200 and reports `ready`, `degraded`, or `bootstrapping` honestly;
- `/data/metrics-snapshot.json` returns a current complete or explicitly degraded national edition;
- `/data/international-comparison.json` returns a validated non-expired comparison or a generic unavailable response;
- an expired or missing required national source is absent rather than represented as zero or stale carry-forward;
- the request-time web Worker returns HTML for the homepage, sources route, UK-in-context route and an affected evidence route;
- the Pages seed remains reachable only as a bounded fallback; it is not used as proof that the custom domain is Pages-owned;
- arbitrary data paths do not expose Worker internals;
- the homepage uses same-origin contracts and never embeds a provider-specific public URL.

`bootstrapping` is valid immediately after the first data Worker deployment. `degraded` means the public edition is honest but not deployment-ready: inspect its exact `missingRequiredSections` manifest.

## Scheduled-run checks

For each observation recorded in the operational issue or release ledger, capture:

- scheduled time and scope (`daily` or `betting`);
- run ID, terminal state and publication edition time;
- successful, failed and missing job identifiers;
- the exact national `publicationState` and missing-section manifest;
- whether the current public snapshot changed;
- any retained evidence and its original validity deadline;
- independent comparison refresh and expiry state;
- Queue retries or upstream-source failures.

Do not treat a newer retrieval check as a newer source observation. Do not extend expired evidence to make a run appear healthy.

## Incident response

### Queue is missing

Rerun the production workflow. Its Queue reconciliation step performs `wrangler queues info`, creates the named Queue only when absent, and enforces one-day retention. The deployment should not require dashboard mutation.

### Data or web Worker health is unavailable

- Inspect the relevant production job and Wrangler output.
- Confirm token permissions for the intended Worker, routes, Queues and KV.
- Confirm the account ID and `public-data.org` zone restriction.
- Revert the faulty merge or rerun the current `main` workflow after correcting credentials or configuration.

### Health reports `bootstrapping` or `degraded`

- Confirm the Cron triggers and serial Queue consumer exist.
- Inspect run terminals, Worker logs and Queue delivery failures.
- Let the bounded publication deadline resolve; do not rebuild Pages merely to move data.
- A complete, current Pages seed may be used only inside the fallback boundary. Partial or expired evidence remains unavailable.

### One source fails

- Inspect its source-specific diagnostic and contract.
- Keep the last publication only while its original evidence window remains valid.
- Correct the collector in a pull request; merging the fix deploys Worker code automatically.
- When no valid prior evidence remains, publish an explicit unavailable/degraded state with the exact missing section.

### Pages seed deployment fails

The previous seed release remains active. Runtime collection, national KV publication and the request-time web Worker remain separately observable. Correct or revert the repository change and let the normal production workflow run again.

## Rollback exercise

A complete rollback exercise must prove both code planes and the data boundary:

1. Revert or redeploy a previous reviewed `main` revision and confirm the previous data and web Worker code, routes and triggers are restored.
2. Confirm the request-time application is serving the expected revision.
3. Confirm the current KV publication remains intact unless the rollback intentionally changes its contract.
4. Confirm snapshot, health and comparison routes remain data-Worker-owned and application/section downloads remain web-Worker-owned.
5. Record exact head, route observations, scheduled-run state and recovery time in the release ledger before declaring operations complete.
