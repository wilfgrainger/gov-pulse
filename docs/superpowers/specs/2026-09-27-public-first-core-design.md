# Public-first core evidence design

## Outcome

Help a first-time UK reader answer a public question quickly, with a current value, a fair comparison, the observation period, geography, caveat and direct primary source. Keep the existing fail-closed source contracts and free Cloudflare architecture. This release narrows the public front door; it does not delete source history or turn incomplete data into a value.

## Core scope

The explorer presents seven public-interest measures: three-month GDP growth, CPI inflation, unemployment, NHS referral-to-treatment waiting pathways, public sector debt as a share of GDP, central government receipts and net migration. It starts with measures that have a verified value and offers a clear control to show unavailable measures. The excluded submeasures remain on their dedicated topic pages where their definitions and clocks can be explained. The homepage presents six national signals: GDP, inflation, unemployment, debt, NHS waits and migration. Polling, Bank Rate, crime and contracts remain discoverable as separate topics, with their different evidence classes clear.

Unemployment on the homepage and explorer is selected from the existing employmentStats labour-market publication. It must never silently fall back to an unrelated estimate when that source is absent. CPI retains its own series contract. The national signal counts describe the six selected signals only. The lead is the latest published current official signal, with a stable tie-break order; if no signal is current, it may use an update-due signal and otherwise shows no lead.

## Reader experience

The homepage begins with a short question-led promise, a small core evidence edition and paths to explore by topic. Every core card links to a page with its detailed evidence. The explorer lists only its seven curated definitions; available values appear first and are selected by default. Readers can reveal the unavailable definitions to inspect the gap. The selected measure offers a chart when comparable history exists, a text explanation, the original publisher and a download of the displayed evidence.

## Downloads and publication

The existing section download links must return JSON and CSV on the main domain. Both formats are derived on request from the same filtered public snapshot as the page and are restricted to known section IDs. An unavailable section returns a clear non-success response rather than an old static file. Downloads contain source, observation and publication dates, geography, caveat and licence. The bounded Pages export may generate the same routes from its dated seed, but the normal Worker uses the live publication. A direct route test checks a valid section, an unavailable one and unknown names.

## Boundaries and verification

No new feed, combined national score, fabricated trend, paid service, cookie or personal-data collection. No change to Cron, Queue or source parsing in this release. Existing topic URLs remain stable. Focused selector, component and route tests precede implementation; run the complete repository tests, lint and both relevant application build modes, then inspect rendered desktop and mobile journeys before handoff. Production readiness remains an operational follow-up because the public health endpoint currently reports bootstrapping; do not call a code release a recovered data plane without observing the live prepared artifact.
