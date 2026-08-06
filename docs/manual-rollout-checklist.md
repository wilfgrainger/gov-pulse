# Operations and recovery checklist

Routine data publication is automatic on Cloudflare. This checklist is for repository release verification, incident response and rollback—not a daily manual process.

## One-time account setup

- Confirm the `public-data-org` Cloudflare Pages project owns `public-data.org`.
- Create GitHub environments named `cloudflare-internal-worker` and `cloudflare-pages`.
- Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to each environment.
- Restrict the token to the intended account and `public-data.org` zone while permitting Worker deployment, Worker routes, Queues, KV bindings and Pages deployment.
- Do not manually create `public-data-jobs`; the production workflow creates or reconciles it.
- Review environment protection rules. Required reviewers turn an otherwise automatic deployment into an approval step.

## Normal release

1. Merge a validated pull request into `main`.
2. The `Deploy public-data.org` workflow automatically:
   - validates and builds the repository;
   - creates or reconciles `public-data-jobs` with one-day retention;
   - deploys the Worker, Cron triggers, routes and bindings from `worker/wrangler.toml`;
   - verifies `/data/health.json`;
   - deploys the same tested static artifact to Cloudflare Pages;
   - verifies the deployed revision and a Pages-owned evidence download.
3. No action is required for subsequent data refreshes. Cloudflare Cron and Queue own them.

Manual workflow dispatch is appropriate only after a transient failed release or when deliberately redeploying the current `main` revision.

## Runtime verification

Check the exact public boundaries:

- `/data/health.json` returns HTTP 200 and either `ready` or `bootstrapping`;
- `/data/metrics-snapshot.json` returns a complete current aggregate once ready;
- `/data/sections/gdpTracker.json` remains a Pages asset;
- arbitrary `/data/*` paths do not expose Worker internals;
- the homepage loads the same-origin runtime snapshot without a provider-specific public URL.

`bootstrapping` is valid immediately after the first Worker deployment. It means the Worker and KV binding are reachable but Cloudflare has not yet finalised a complete prepared public publication.

## Scheduled-run checks

For each observation recorded in issue #257, capture:

- scheduled time and scope (`daily` or `betting`);
- run status and publication edition time;
- successful, failed and missing job identifiers;
- whether the current public snapshot changed;
- any retained evidence and the original validity deadline;
- Queue retries or upstream-source failures.

Do not treat a newer retrieval check as a newer source observation. Do not extend expired evidence to make a run appear healthy.

## Incident response

### Queue is missing

Rerun the production workflow. Its Queue reconciliation step performs `wrangler queues info`, creates the named Queue only when absent, and enforces free-tier one-day retention. The deployment should not require dashboard mutation.

### Worker health is unavailable

- Inspect the `deploy-worker` job and Wrangler output.
- Confirm token permissions for Worker scripts, routes, Queues and KV.
- Confirm the account ID and the `public-data.org` zone restriction.
- Revert the faulty merge or rerun the current `main` workflow after correcting credentials or configuration.

### Health reports `bootstrapping`

- Confirm the Cron triggers and Queue consumer exist in Cloudflare.
- Inspect Worker logs and Queue delivery failures.
- Allow the next scheduled run to create a complete publication; do not rebuild Pages merely to move data.
- A complete, current Pages seed may be served during bounded bootstrap, but partial or expired evidence must remain unavailable.

### One source fails

- Inspect its source-specific diagnostic and contract.
- Keep the last publication only while its original evidence window remains valid.
- Correct the collector in a pull request; merging the fix deploys Worker code automatically.
- When no valid prior evidence remains, publish an explicit unavailable state.

### Pages deployment fails

The previous Pages release remains active. Runtime data collection and KV publication continue independently. Correct or revert the repository change and let the normal production workflow deploy again.

## Rollback exercise

A complete rollback exercise must prove both boundaries:

1. Revert or redeploy a previous repository revision and confirm the previous Worker code, routes and triggers are restored.
2. Confirm the previous Pages revision is serving the expected application commit.
3. Confirm the current KV publication remains intact unless the rollback intentionally changes its contract.
4. Confirm the exact snapshot and health routes remain Worker-owned and section downloads remain Pages-owned.
5. Record the evidence in issue #257 before declaring the control-plane migration operationally complete.
