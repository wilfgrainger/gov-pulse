# public-data.org progress

Checked: 4 August 2026 Europe/London

## Release state

- `origin/main` is deployed at `35ffb70d0bef5fc12403d8087344f2eb31f5fe12`.
- Successful release workflow: [Deploy public-data.org run 30908588661](https://github.com/wilfgrainger/gov-metrics/actions/runs/30908588661).
- Worker bootstrap, Pages deployment, exact-head production verification, live snapshot canary and Pages-owned section download checks all passed.
- The site is live and ready: `/data/health.json` returns `{"status":"ready","ready":true}`.

## Why public-data.org was not live

The Pages shell was reachable, but the Cloudflare publication never reached a verified prepared artifact. The failure chain was bounded and evidence-backed:

1. NHS and polling collection could stall or reject valid official assets. Sequential collection, bounded XLSX ZIP inflation and PDF image-stream skipping fixed the external collector path.
2. The NHS May 2026 publication had an explicit publisher expiry of 23 August 2026, but currentness and artifact validity still aged it from the 31 May observation date. Explicit expiry is now authoritative in both checks.
3. Readiness could be reported from the migration fallback while the prepared KV artifact was absent. Readiness now requires prepared metadata, and bootstrap verifies the snapshot delivery contract before skipping Queue work.
4. Queue-published snapshots did not carry the `published-snapshot` delivery marker or section diagnostics. The publisher now writes both, including an explicit diagnostic for unavailable optional betting evidence.
5. The production verifier expected contiguous text even though Next.js inserts hydration comments; it now normalises those comments, and the homepage exposes a direct ONS provenance route.

## Live evidence observed

- `https://public-data.org/` — HTTP 200; homepage revision matches `35ffb70d0bef5fc12403d8087344f2eb31f5fe12`; direct ONS provenance link present.
- `https://public-data.org/data/health.json` — HTTP 200, ready.
- `https://public-data.org/data/metrics-snapshot.json` — HTTP 200, `X-Publication-Delivery: cloudflare-kv`, `meta.delivery: published-snapshot`, registry `2026-08-02.1`.
- Snapshot canary verified all eight required sections; optional betting evidence is explicitly unavailable with a diagnostic, not fabricated.
- `https://public-data.org/data/sections/gdpTracker.json` — HTTP 200.
- `https://public-data.org/section/gdp/` — HTTP 200 with server-rendered ONS publication and date context.

## Repository handoff

- `AGENTS.md` is the single Graphite Mountain repository guide containing mission, architecture, evidence, security, release and repo-map boundaries.
- `.agents/PROGRESS.md` is the only volatile handoff record. Obsolete steering, hourly-agent, architecture-review and unused UI-skill files were removed after reference checks.
- Existing local untracked environment/generated files remain intentionally untouched: `.venv/`, `build-output.log`, `config.yaml`, `debug.log`, `gemini`, `litellm_config.yaml`, `public/data/`, and `public/social/`.
