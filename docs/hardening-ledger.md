# Hardening Ledger (Aggressive 10-Agent Pass)

Date: 2026-03-18

## Critical findings

1. Fixed: Nondeterministic E2E due to ambient server reuse on `:3000`.
2. Fixed: Smoke coverage only checked a subset of section pages.
3. Fixed: Missing automated published-snapshot canary for production validation.
4. Fixed: Worker endpoint contract tests were too narrow for ingest/refresh auth paths.

## Implemented controls

- Playwright now uses an isolated dedicated server (`PLAYWRIGHT_PORT` default `4173`) and never reuses existing servers.
- E2E includes app-identity verification and all section routes.
- The published-data canary validates the registry and all automated sections in the same-origin Pages snapshot.
- `live-feed-canary.yml` runs on a schedule and manual dispatch; the Pages deployment performs its own post-deploy snapshot verification.
- Worker tests cover refresh auth, unknown sections, ingest method enforcement, non-ingest rejection, and malformed ingest payloads.
- Deploy workflow uploads Playwright artifacts for debugging.

## Manual follow-up required

- Execute one manual Pages deploy and one manual published-data canary.
- Confirm the production frontend and same-origin snapshot serve all verified sections before rollout close.
- Verify Wrangler/KV configuration only when deploying the optional Worker.
