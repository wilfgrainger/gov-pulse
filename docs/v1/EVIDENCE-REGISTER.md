# V1 evidence register

**Observed:** 10 November 2026, 07:50–10:30 UTC. The 12 October register this replaces is in git history.
**Rule:** a local collector, historical checkbox, HTTP 200 shell or hidden value is not proof of public evidence. A held family remains held until source verification and explicit user authorization.

The complete publication configuration is `config/publications.json`. Rows marked "reviewed 10 Nov" had values fetched independently from the publisher on that day; the others record only what production served.

| Family | Primary-source evidence | Publication state and verified gap |
|---|---|---|
| Key indicators (`sentimentPulse`) | ONS CPI [D7G7](https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23) | **Published.** CPI 3.5%, September 2026, published 21 October; matches the ONS series (reviewed 10 Nov). Unemployment was not separately reconciled. Bank of England Bank Rate was removed from collection and display on 11 November 2026 (licensing review: the Bank's content is its copyright and re-use needs permission); the section now carries CPI and unemployment only. |
| Real wages | ONS labour market bulletin, October 2026 | **Published.** Regular pay real growth 0.6%, June to August 2026, Great Britain; matches the bulletin text (reviewed 10 Nov). |
| Government receipts (`taxRevenue`) | ONS public sector finances, September 2026 | **Published.** Central government current receipts £90.1bn, September 2026; matches the bulletin (reviewed 10 Nov). |
| GDP | ONS GDP monthly estimate, August 2026 | **Published.** Three-month growth 0.7%, monthly 0.1%, August 2026; matches the bulletin text (reviewed 10 Nov). |
| National debt | ONS [HF6X](https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf) | **Published but one release behind.** Production shows 93.8% for August 2026 (published 22 September). ONS published September, 94.0%, on 21 October. The collector fix (#244) returned the September figure in a local run on 10 November; the stored record expires on 14 November. |
| House prices and rents | ONS private rent and house prices bulletin, October 2026 | **Published.** Average private rent £1,406 a month and 3.8% annual change, September 2026, as served; not separately reconciled on 10 Nov. September house-price annual change has no published value yet. |
| Employment, migration, crime | ONS | **Published.** Served and consistent across page, snapshot and section JSON; not separately reconciled on 10 Nov. |
| Polling | [YouGov](https://yougov.com/en-gb/articles); [More in Common](https://www.moreincommon.org.uk/polling-tables/?_polling_tables_type=voting-intention) | **Held (`licence-permission-required`) from 11 November 2026, on the owner's instruction after a licensing review.** YouGov's terms prohibit automated collection without written permission; More in Common publishes no reuse terms. Neither is collected (cron or deploy bootstrap) and no stored poll is shown. Before the hold: YouGov, fieldwork 1–2 November, n=2,355, was the one current pollster. |
| Procurement | Cabinet Office [Find a Tender OCDS API](https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages) | **Published.** Window 3–9 November 2026; 308 comparable awards of 422, 114 excluded for missing or non-comparable values. Notice-level reconciliation against the API was not done on 10 Nov. |
| Release calendar | [ONS release calendar](https://www.ons.gov.uk/releasecalendar); [NHS statistics calendar](https://www.england.nhs.uk/statistics/12-months-statistics-calendar/) | **Held; source review passed (reviewed 10 Nov).** ONS: 81 events (71 confirmed, 10 provisional), all matching an independent parse of the five upcoming pages. NHS: 5 RTT releases, all matching the 2026-27 plan PDF, all provisional. No WAF block was met. Page fixes in #251. |
| International comparison | IMF DataMapper, OECD DAC1/SOCX/Revenue Statistics, World Bank WDI, SIPRI | **Held and not collected (11 Nov licensing review: SIPRI requires authorisation; IMF prohibits bulk automated download). Source review passed, page review failed (reviewed 10 Nov).** All 11 sources collected; UK and two other countries per measure reconciled with no mismatch. 2024 health figures were checked against the World Bank only (WHO has no 2024 rows). Page fixes in #250. |
| Authored stories | The five measures they cite | **Held (`product-hold`).** No numbers in the prose; all five cited figures come from published families. Fixes in #249. |
| NHS RTT, early years, betting markets | — | **Held and not collected.** Betting markets (Oddschecker) are also a licensing grey area (11 Nov review). Not reviewed on 10 Nov. NHS England served its pages and plan PDF without a block on that day, which bears on the earlier retrieval concern. |
| Archive and revisions | Public [edition archive](https://public-data.org/data/editions.json) | **Published.** 8 editions listed; all 8 details loaded; one edition's 18 changes matched its page. |

## Public evidence consistency notes

- `/data/health.json` returned `ready: true` with `held: ["nhsStats"]`.
- CPI, unemployment, GDP, private rents and debt agreed across the home page, section page, measure page, `/explore/`, the snapshot and the section JSON. The only disagreement was a period label on the home rents card (#254).
- Pages intermittently returned 503 with Error 1102; see RELEASE-READINESS.md.

## Publication approval ledger

This register records evidence, not permission. The ten published families and the edition archive (eleven before polling was held on 11 November 2026) are published in `config/publications.json`; this review did not locate or re-record their authorizations.

| Family | Evidence review | Explicit user authorization | Current public switch |
|---|---|---|---|
| Release calendar (ONS, NHS) | Passed 10 Nov; page fixes in #251 | None recorded | Held |
| International comparison | Sources passed 10 Nov; page fixes in #250 | None recorded | Held |
| Authored stories | Figures passed 10 Nov; page fixes in #249 | None recorded | Held |
| NHS RTT, early years, betting markets | Not reviewed | None recorded | Held |
| Election polling (YouGov, More in Common) | Licensing review 11 Nov: permission required | Owner instructed hold, 11 Nov 2026 | Held (`licence-permission-required`) |

Reverify time-sensitive source validity and every publisher release before activation or launch.
