# Operations and recovery checklist

> Current production steps are described here. Source collection recovery is
> independent of code release, and Pages is a bounded fallback. Verify these
> commands against `.github/workflows/deploy.yml` when that workflow changes.

Routine data publication is automatic on Cloudflare. This checklist is for repository release verification, incident response and rollback—not a daily manual process.

## One-time account setup

Follow [Cloudflare credential boundaries](./operations/cloudflare-credential-boundaries.md)
to create independent Worker tokens and configure the main-only Pages
deploy-hook secret. Keep the former `CLOUDFLARE_API_TOKEN` active until each
Worker replacement and its production path have passed. Create the account-wide
Queue Edit and KV Read recovery tokens only for an actual recovery run; expire
and revoke them immediately afterward.

Confirm that `public-data-jobs` and the dashboard-managed routes already exist
before deploying this branch. Routine CI no longer creates Queues or changes
routes.

## Normal release

1. Merge a validated pull request into `main`.
2. The `Deploy public-data.org` workflow automatically:
   - builds the web Worker and data Worker on separate runners;
   - gives each runner only that Worker's token, after dependency installation;
   - verifies the exact data Worker revision and then checks public routes and
     `/data/health.json` without Cloudflare credentials;
   - leaves routes attached in the Cloudflare dashboard;
   - updates the Git-integrated Pages fallback only when paused or explicitly
     requested.
3. No action is required for subsequent data refreshes. Cloudflare Cron and Queue own them.

Manual dispatch on `main` validates the selected source, then can redeploy it,
request source recovery after deployment, or refresh the bounded Pages fallback.
Evidence recovery runs in a separate job after successful deployment and
verification; its result cannot change the code-release status.

## Runtime verification

Check the exact public boundaries:

- `/data/health.json` returns HTTP 200 and either `ready` or `bootstrapping`;
- `/data/metrics-snapshot.json` returns a complete current aggregate once ready;
- `/data/sections/gdpTracker.json` remains a Pages asset on the Git-integrated
  fallback project;
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

Create `public-data-jobs` in the Cloudflare dashboard using the intended
retention settings, then rerun the deployment. Routine CI intentionally has no
Queue management permission.

### Worker health is unavailable

- Inspect the `deploy_web_worker` or `deploy_data_worker` job and Wrangler output.
- Confirm the individual-Worker token is scoped to the expected Worker and
  dashboard-managed routes remain attached.
- Confirm the account ID variable is set in GitHub.
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

The previous Pages release remains active. Runtime data collection and KV
publication continue independently. Correct or revert the repository change
and let the normal production workflow deploy again. Do not move the custom
domain or delete the old Direct Upload project until the new Pages seed and
offline builds have both been verified.

## Rollback exercise

A complete rollback exercise must prove both boundaries:

1. Revert or redeploy a previous repository revision and confirm the previous Worker code, routes and triggers are restored.
2. Confirm the previous Pages revision is serving the expected snapshot and
   the Direct Upload project is still available as rollback.
3. Confirm the current KV publication remains intact unless the rollback intentionally changes its contract.
4. Confirm the exact snapshot and health routes remain Worker-owned and section downloads remain Pages-owned.
5. Record the evidence in issue #257 before declaring the control-plane migration operationally complete.
