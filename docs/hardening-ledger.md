# V1.0 hardening ledger

This ledger records structural controls included in the 1.0.0 release candidate. It is not a substitute for live Cloudflare or rollback evidence.

## Implemented controls

- National publication fragments and values carry a run ID, preventing late Queue retries from mixing editions.
- International comparison reads enforce a seven-day hard expiry independent of the seven-day refresh due guard.
- Source discovery, seed fallback and decompression are bounded by approved hosts, response limits and archive output caps.
- The public national cache cannot outlive the evidence currentness deadline.
- Degraded national editions expose exact missing required sections and are not reported as ready.
- Public currentness requires fresh source transport, exact registry/section provenance and a current observation; transport-only or malformed fragments fail closed.
- Late Queue fragments cannot replace a newer section publication based on an older retrieval timestamp.
- The live national snapshot route exposes the configured full release SHA and the production verifier checks it; an uploaded Wrangler tag alone is not treated as live-route proof.
- Financial historical points have a complete accessible table; derived UI copy does not assert movement or herd-immunity effects without data support.
- Release workflows enforce `main`, pin action references, audit production dependencies, order data/bootstrap before web delivery, and require a verified `ready` or explicitly degraded Pages seed candidate before seed deployment.
- Worker deployment verification matches the exact `workers/tag` annotation rather than an arbitrary text occurrence.
- Production verifier redirects are same-host and bounded, and response bodies are size-limited.
- Compatibility refresh authentication accepts the secret only in the `X-Refresh-Secret` header; URL query credentials are rejected to keep them out of logs and referrers.
- Application and dataset licensing boundaries are explicit.

## Proof still required outside the repository

- exact remote head and PR check result;
- deployed data Worker version, Queue/bootstrap completion and KV propagation;
- request-time HTML and all three public data routes observed at that revision;
- consecutive scheduled runs, alerting and an exercised rollback;
- authenticated or provider-specific operational journeys where the deployment environment requires them.
