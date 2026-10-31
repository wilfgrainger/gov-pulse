# Cloudflare credential boundaries

Routine deployments use one credential per Cloudflare Worker. Recovery and
Pages publishing have separate GitHub environments. Never reuse a token across
projects, services, repositories, or environments.

## GitHub environment mapping

Set `CLOUDFLARE_ACCOUNT_ID` as a GitHub Actions variable. It identifies the
destination account and is not an authenticator.

| GitHub environment | Secret | Cloudflare scope | Use |
| --- | --- | --- | --- |
| `cloudflare-web-worker` | `CLOUDFLARE_WEB_WORKER_TOKEN` | Workers **Editor**, only Worker `public-data-web` | Deploy the request-time website Worker |
| `cloudflare-data-worker` | `CLOUDFLARE_DATA_WORKER_TOKEN` | Workers **Editor**, only Worker `pulse-data-worker` | Deploy and inspect the data Worker |
| `cloudflare-publication-recovery` | `CLOUDFLARE_RECOVERY_QUEUES_TOKEN` | Queues **Edit**, account scope | Enqueue a recovery message to the pinned `public-data-jobs` Queue ID |
| `cloudflare-publication-recovery` | `CLOUDFLARE_RECOVERY_KV_READ_TOKEN` | Workers KV Storage **Read**, account scope | Read run diagnostics from the pinned publication namespace |
| `cloudflare-pages` | `CLOUDFLARE_PAGES_DEPLOY_HOOK_URL` | Bearer URL for `public-data-org-git`, production branch `main` | Trigger its Git build without a Cloudflare API token |

Each Worker job runs on its own GitHub-hosted runner. Its Worker token is
injected only into the Wrangler step that needs it; source preparation and npm
lifecycle scripts run without Cloudflare credentials. Recovery is manually
dispatched from `main` and uses a separate environment. The Queue ID and KV
namespace ID are public resource identifiers that constrain the requests made
by the recovery script; they do not narrow the Cloudflare tokens themselves.
The Queue Edit and KV Read permissions available to this recovery workflow are
account-scoped. A recovery token could therefore affect any account Queue or
read any account KV namespace. No replacement recovery tokens are configured
yet. Do not keep them as permanent GitHub secrets: create short-expiry tokens
for a recovery run, add them to the recovery environment, then remove the
GitHub secrets and revoke the tokens after the run.

The Cloudflare Worker Editor role can change that Worker's code, settings and
secrets. Keep each token scoped to one Worker. Route and custom-domain changes
remain dashboard-managed, so routine deployment has no zone route-write
permission. See [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/) and [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

GitHub environments are restricted to `main`. The Worker deployment workflow
checks the current `main` revision once before the web and data Worker jobs, so
both jobs deploy the same revision; the workflow-level concurrency setting
serializes a newer release behind the current one. Main also requires the
`quality` check and a pull request. The Pages hook is
a bearer credential: keep it only in the
`cloudflare-pages` environment, never in source, logs, or a URL passed as a
process argument.

## Pages migration and remaining boundary

The existing `public-data-org` project is Direct Upload and remains the
rollback project. The separate `public-data-org-git` project is connected to
this repository, builds `npm run pages:build` into `out`, has production
branch `main`, automatic production deployments disabled, and preview builds
disabled. Pages publishing now uses
that project's main-only deploy hook; the workflow no longer asks for Pages
Write or domain-management permissions.

Do not retire the old project or its rollback content until the new project's
first production build succeeds and both the refreshed-seed and publication-
paused/offline outputs are verified. The Worker still reads its seed from the
old Pages URL until that migration is proven and the Worker seed URL is changed.
The Git-integrated project currently has no custom domain; production domain
ownership is not changed by this credential work.

The Pages hook does not provide arbitrary source upload. It can only request a
Cloudflare build from the connected repository's configured production
branch. The hook must be created for the Git-integrated project and stored as
the `cloudflare-pages` environment secret before its Actions jobs can run.

## Replacement and retirement sequence

1. Confirm dashboard-managed Worker routes and the existing Queue still exist.
2. Create separate, short-expiry Cloudflare tokens with only the scopes above.
   Do not include account-wide Workers Editor, zone route write, KV edit, Queue
   Read/Create/Delete, DNS, or Pages permissions in Worker tokens.
3. Add each token only to its matching environment; add the main-only Pages
   hook only to `cloudflare-pages`. Keep the old shared token active during
   the overlap.
4. Merge the reviewed hardening changes and run the exact main workflows.
   Verify both Worker revisions, public routes, health, recovery, and Pages
   online/offline behavior before removing any old GitHub secret.
5. Change the Worker seed URL only after the new Pages project has a verified
   snapshot. Keep the old Pages project as a rollback until the Worker fallback
   reads and publishes from the new project successfully.
6. GitHub never reveals secret values. Same-named secrets in different
   repositories cannot be assumed to contain the same token. Inventory every
   consumer of the old credential; only then remove old GitHub secrets and
   revoke the corresponding Cloudflare token.

GitHub-hosted runner IP addresses change. Avoid a brittle source-IP allowlist;
use a fixed-egress runner only if you later need that control.
