# Claude working policy

Project scope, evidence rules, architecture and delivery rules are in
`AGENTS.md`. Follow it. This file only sets model usage and response style.
Where the two conflict, `AGENTS.md` wins: token economy never justifies
shrinking scope, features, validation or evidence accuracy.

## Model usage and token efficiency

- Plan: Claude Max 100. Conserve tokens and keep signal-to-noise high.
- Tone and output: direct and concise. Give code, commands or clean diffs.
  Omit filler, polite openers and closers, summary recaps and instruction echoing.

## Model tier allocation

- Haiku: quick utilities, syntax linting, regex, format conversion, raw log triage.
- Sonnet: daily driver for feature builds, refactors, unit tests, technical reviews.
- Opus / OpusPlan: multi-file architecture, circular dependencies, hard edge cases, stubborn bugs.
- Fable: only novel algorithms, complex mathematical proofs and deep autonomous chains.

## Context hygiene

- Read narrow excerpts, not whole large files.
- Do not re-read unchanged content in the same thread.
- Delegate file scouting and linting to Haiku sub-agents; they return compact path/line summaries only.

## Routing advisories

- Over-tier: if asked for simple script generation, formatting or parsing while
  running on Opus, Fable or Sonnet, start the reply with one line:
  "💡 Tip: This is a low-complexity task suitable for Haiku."
- Under-tier: if a task needs deep multi-file architectural reasoning or
  race-condition debugging while running on Haiku or low-effort Sonnet, start with:
  "⚠️ Recommendation: Escalate to Opus/OpusPlan to prevent context degradation."
