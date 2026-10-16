# Caveman in this repository

The upstream Caveman core skill lives in SKILL.md. AGENTS.md enables its concise
communication style for routine chat responses in this repository. User requests
for normal mode, explanations or detailed reports take precedence. Full task
scope, code quality, evidence standards and meaningful verification remain part
of the requested work.

## Hermes

Launch Hermes with this worktree as its working directory. Its native project
skill roots include `.agents/skills` when the project is trusted. The local setup
trusts `/Users/wilfg/gov-pulse-hermes-v1` for the default Hermes profile and also
registers this skill directory under `skills.external_dirs`. The latter makes
the skill visible in desktop sessions that have not yet established a repo cwd.

The default local profile sets `skills.auto_load: [caveman]`. Start a fresh chat
to load the skill automatically; no slash command is required. Some desktop
builds do not expose `/reload-skills`, and an old session can retain its earlier
skill catalog. Use the desktop's new-session control. Say `normal mode` or
`stop caveman` to turn the style off for that chat. Other intensity/translation
skills mentioned upstream are separate optional installations.

This is a prompt skill. It reduces verbose responses; it is not a context
compressor or a GPU memory limit. Keep the separate Hermes compaction and Rapid
input limits enabled. No token-saving percentage has been measured for local Qwen.

Source revision and license are recorded in UPSTREAM.md and LICENSE. The upstream
skill is unchanged. No global plugin, proxy, hook or executable was installed.
