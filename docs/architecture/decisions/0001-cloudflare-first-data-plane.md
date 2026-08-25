# ADR-0001: Cloudflare-first runtime data plane

- Status: accepted
- Date: 1 August 2026
- Decision owner: Jared, delegated product owner
- Delivery: PR #283
- Documentation alignment: issue #285

## Context

The previous design separated a route-less data Worker from a manually promoted static publication. Cloudflare collected evidence into KV, but a person had to run GitHub Actions to copy the candidate into a new Pages build. The Worker deployment also assumed the `public-data-jobs` Queue already existed. That undocumented dependency caused production run `30720378544` to fail before Worker deployment.

The operating requirements are:

- Cloudflare performs all recurring data work on the Free plan;
- repository code defines and deploys everything running on Cloudflare;
- GitHub Actions provides assurance and deployment, not scheduled data processing;
- the public application remains simple, same-origin and open source;
- incomplete or stale evidence never replaces a valid publication;
- no routine human action is required to keep data moving.

## Decision

Adopt a Cloudflare-first split architecture:

1. `public-data-web` serves the request-time Next.js application and its static assets for `public-data.org/*`.
2. `pulse-data-worker` owns recurring collection, validation, finalisation and the exact national snapshot, health and isolated comparison routes.
3. Cloudflare Pages retains a bounded static seed/fallback export; it is not the normal custom-domain application plane.
4. The finaliser precomputes and stores a sanitised public JSON artifact plus its validity deadline. Public data requests return that prepared value rather than rebuilding it.
5. One GitHub production workflow runs automatically after relevant changes reach `main`. It validates once, reconciles the Queue, deploys and verifies the data Worker, bootstraps publication, then deploys and verifies the request-time web Worker before refreshing the optional Pages seed.
6. Manual workflow dispatch is retained only for recovery.

## Alternatives considered

### Continue manual Pages promotion

Rejected. It makes data publication depend on a person and GitHub Actions even when Cloudflare has already collected a valid candidate. It also creates two publication clocks and encourages stale live pages.

### Put the entire site behind a dynamic Worker

Accepted in the bounded request-time form. OpenNext serves the application Worker so evidence-bearing pages use the same currentness decision for crawlers, link unfurlers, no-JavaScript clients and browsers. The Pages export remains a separately bounded seed/fallback.

### Keep the Worker route-less and poll KV through GitHub

Rejected. It preserves the manual handoff and makes GitHub a runtime data dependency rather than a deployment system.

### Route all `/data/*` traffic to the Worker

Rejected. It would silently take ownership of application/static section downloads and enlarge the public Worker surface. The data Worker has exactly three routes; the web Worker owns the normal application path.

### Generate and sanitise the aggregate on every request

Rejected. Repeated parsing, cloning and serialisation wastes Workers Free HTTP CPU. Publication-time preparation is simpler and cheaper.

### Remove Queues and run every collector inside one Cron invocation

Rejected for the current source set. Serial Queue jobs provide bounded retries, run terminals and source isolation, especially for procurement collection. The Queue remains within the Free allowance and is now created automatically.

## Consequences

### Positive

- Routine data publication is fully Cloudflare-operated.
- Missing Queue infrastructure is repaired by the repository deployment.
- Frontend code keeps the same same-origin snapshot URL.
- Pages seed availability is independent of collector failures and is not confused with normal application delivery.
- The public Worker surface is small and mechanically enforced.
- The live aggregate can advance without rebuilding the site.
- GitHub Actions is reduced to one PR assurance workflow and one production deployment workflow.

### Trade-offs

- Static section JSON/CSV distributions update with seed/application releases, not every runtime data refresh. The national snapshot and isolated comparison are the continuously refreshed data surfaces.
- Cloudflare environment credentials and permissions remain one-time account configuration outside the repository because secrets cannot be committed.
- GitHub environment protection rules may add an approval step even though the workflow is configured for automatic deployment.
- Operational completion still requires observed scheduled runs and a rollback exercise.

## Team review

- **Richard:** selected the static frontend plus live aggregate boundary and rejected a full dynamic rewrite.
- **Gilfoyle:** required exact public routes, disabled preview ingress, repository-managed resources and a cheap prepared-KV hot path.
- **Dinesh:** preserved the existing same-origin frontend contract and bounded static downloads while moving normal page delivery to the request-time web Worker.
- **Jian-Yang:** challenged wildcard routing, hidden Queue prerequisites and unsupported claims of production readiness.
- **Graphite Mountain final simplification:** reduced active Actions to two and removed routine manual publication.
- **Jared:** accepted the architecture, sequencing and honest operational boundary.

The methods were applied sequentially. This record does not claim independently executing agents.

## Verification

PR #283 exact head `603f25a944cd3f36c755d0cb5af1d144cbfceb60` passed repository guards, ESLint, 408 unit and Worker tests, static production build, deterministic browser tests and the aggregate quality gate in run `30721435679` before squash merge as `d1b63d33cddcb6162eb138f58288dcee59a97757`.

Production readiness is tracked separately from source and build correctness. Merge and test success do not substitute for observed Cloudflare scheduled runs, exact route responses and rollback evidence.
