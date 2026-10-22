# V1 evidence register

**Observed:** 12 October 2026, 10:14–10:17 UTC.
**Rule:** a local collector, historical checkbox, HTTP 200 shell or hidden value is not proof of public evidence. A held family remains held until source verification and explicit user authorization.

This table covers the evidence families most directly tied to the ten V1 journeys; it is not an exhaustive switch inventory. The complete source-level publication configuration is `config/publications.json`. Other disabled families include GDP, employment, tax, real wages, betting odds, crime statistics and additional legacy measures. A disabled switch does not imply those datasets were fully source-audited for this record.

| Family | Primary-source evidence | Publication state and verified gap |
|---|---|---|
| National debt | ONS [HF6W](https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf), [HF6X](https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf), reconciled with [August 2026 bulletin](https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/august2026). | **Published.** End-August UK public sector net debt excluding public sector banks: £2,985.5bn; 93.8% of GDP. Year-on-year: +£78.5bn and −1.3 percentage points. ONS publication 22 Sep; next announced release 21 Oct. Snapshot generated 12 Oct 03:43 UTC. Catalog measure validity to 14 Nov exceeds the next scheduled release; recheck after that release or on collection failure. Snapshot catalog validity ended 13 Oct 15:18 UTC, earlier than the measure validity; reconcile clocks. |
| NHS RTT | [NHS England RTT statistics](https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2026-27/). | **Unavailable in production.** Health reports degraded/not ready with required `nhsStats` missing. Local direct-source reconciliation was recorded for July, but a permitted automated retrieval route remains unproved after WAF challenges. No deployed NHS source edition or source-to-screen proof. |
| Release calendar | [ONS release calendar](https://www.ons.gov.uk/releasecalendar); [NHS statistics calendar](https://www.england.nhs.uk/statistics/12-months-statistics-calendar/). | **Held.** Calendar families are disabled. Page route loads, but no deployed current event payload, ICS, or watchlist reconciliation was verified. Historical local calendar checks do not constitute production evidence. |
| Rents and housing | ONS [September 2026 private rent and house prices bulletin](https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026). | **Held.** Source figures checked: August rent £1,400/month, +3.8% annual; July house price £273,000, +1.4% annual; bulletin published 16 Sep. Provisional series and revision windows apply; bulletin notes estimated recent Northern Ireland rent inputs. Local normalization exists; live catalog does not publish housing. |
| Polling | [YouGov publications](https://yougov.com/en-gb/articles); [More in Common polling tables](https://www.moreincommon.org.uk/polling-tables/?_polling_tables_type=voting-intention). | **Held.** More in Common archive lists 3–5 Oct fieldwork; this verifies an item, not a reconciled current site result. Two-pollster validation, 14-day validity, corrections and production history are not verified. |
| Procurement | Cabinet Office [Find a Tender OCDS API](https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages). | **Held.** Public history route returned `503 publication_disabled`. Local checks cover complete 7-day windows, identities, awards vs spend, amendments/cancellations and bounded display; current complete-window counts, notice reconciliation and deployed dossier are unproved. |
| International comparison | IMF/OECD/World Bank/WHO/SIPRI publisher families listed in `worker/feed-registry.js`; individual series require source-specific citations. | **Held.** Public comparison JSON returned `503 publication_disabled`. Historical local collection reportedly checked seven measures and 13 countries, including 2015–2025 defence history; there is no refreshed deployed edition or country/year/status/export reconciliation. Distinct periods, statuses and USD-per-resident bases must stay explicit. |
| Archive and revisions | Public [edition archive](https://public-data.org/data/editions.json) and source publishers above. | **Published for debt only.** Three editions were listed: 15 Sep and two 22 Sep source publications. Latest catalog edition was archived 3 Oct 12:44 UTC; its debt difference was metadata-only, while the preceding debt edition recorded August as a new observation. Broad source lineage and other families' revision histories are not proven. |

## Public evidence consistency notes

- `/data/health.json` returned degraded, `ready:false`, missing `nhsStats`.
- `/data/metrics-snapshot.json` returned a debt-only snapshot, degraded, but with an empty missing-required list and no verified sections. Readers should use health for readiness until the public contract is made consistent.
- The data Worker served debt at the observed time. The public Pages metrics snapshot returned `503 publication_disabled`; no current Pages seed payload was verified. A direct private KV read was not available because Cloudflare API credentials were not configured for this audit. No credential value was accessed or recorded.
- Page routes that return an explanatory/offline shell are not evidence that their underlying families are published.

## Publication approval ledger

The production configuration observed for this baseline enables `nationalDebt` and `editionArchive`. The candidate configuration additionally enables two authored-story routes; their numerical claims and evidence links await editorial review. Story routes are separate from dataset approval.

| Family | Evidence review | Explicit user authorization | Current public switch |
|---|---|---|---|
| National debt | Source values reconciled as above | Existing authorization is reflected in production | Published |
| NHS, calendar, housing, polling, procurement, international | Incomplete for V1 production acceptance | None recorded for activation in this programme | Held/unavailable |
| Authored stories | Numerical claims and evidence links require editorial review separate from dataset approval | No new story publication authorization recorded here | Candidate routes require review before integration |

This register records evidence, not permission. Reverify time-sensitive source validity and every publisher release before activation or launch.
