# Election polling evidence audit — 14 July 2026

## Public question

What does the latest verified Great Britain voting-intention poll publication report, and how was it produced?

## Accepted primary publication

| Field | Verified value |
| --- | --- |
| Pollster | YouGov |
| Commissioner | YouGov |
| Publication | Westminster voting intention from constituency vote projected by YouGov MRP |
| Publication date | 6 July 2026 |
| Fieldwork | 5–6 July 2026 |
| Sample | 2,285 GB adults |
| Mode | Online panel; headline voting intention modelled using MRP |
| Geography | Great Britain |
| Conservative | 20% |
| Labour | 20% |
| Liberal Democrats | 13% |
| Reform UK | 24% |
| Green | 13% |
| SNP | 3% |
| Plaid Cymru | 1% |
| Your Party | 1% |
| Restore Britain | 3% |
| Other | 2% |
| Primary tables | `https://ygo-assets-websites-editorial-emea.yougov.net/documents/VotingIntention_MRP_Results_260706_w.pdf` |
| Methodology | `https://yougov.co.uk/about/panel-methodology` |

The published party shares sum to 100%.

## Evidence policy

PULSE accepts an election poll only when the ingest record includes:

- a direct HTTPS first-party publication on an approved pollster host;
- pollster and commissioner;
- publication date and fieldwork dates;
- sample size, sampled population, geography and mode;
- question wording or the exact published headline measure;
- the method used to produce the displayed headline;
- party shares that cover the core Great Britain parties and total approximately 100%;
- a direct methodology URL;
- British Polling Council membership confirmation;
- an uncertainty statement.

Each record is validated before authenticated ingestion. Duplicate IDs or source URLs, impossible dates, future publication dates, unapproved hosts, incomplete disclosures and implausible totals are rejected.

## No PULSE average

PULSE does not calculate an election-polling average in this release. Each accepted primary publication is shown separately. This avoids silently combining:

- different fieldwork dates;
- different question wording;
- conventional and modelled headline methods;
- different samples, weighting and turnout assumptions;
- different treatment of undecided respondents;
- different party sets and geographic coverage.

An aggregation may return only with a separately documented and tested method.

## Freshness and failure behaviour

- The source publication date, not workflow execution time, is the freshness clock.
- The latest accepted primary publication expires after 14 days.
- Re-running the ingest workflow does not make an old publication fresh again.
- Expired evidence returns HTTP 503 from the section route and is removed from the combined dataset.
- The frontend fallback contains no poll values and shows an unavailable state.
- The old `/refresh?section=electionPolling` route is blocked; only authenticated primary-publication ingestion is accepted.
- The production canary rejects expired evidence, legacy `pollingData` or `recentPolls`, missing disclosure fields and secondary source URLs.

## Secondary-source removal

The previous Worker scraped a Wikipedia table and calculated a simple unweighted average of selected party values. That runtime path is replaced by `worker/polling-entry.js`, which is the deployed Wrangler entrypoint and marks election polling ingest-only. Production provenance, the public UI, shared fallbacks, source metadata, health records and canary contracts no longer treat Wikipedia as evidence.

The old parser remains physically present inside the legacy `worker/index.js` monolith but is unreachable from the deployed polling route: scheduled refresh skips the ingest-only descriptor, direct refresh is blocked by the production wrapper, and section responses are rejected unless they satisfy the primary-publication contract. Removing the dead helper is reserved for a bounded Worker modularisation rather than mixed into this evidence release.

During the one-time audit, a secondary polling table was used only as a discovery index to locate first-party pollster files. No values from that table enter the accepted payload. Other pollster workbooks discovered during the audit were not accepted because their contents were not independently parsed and validated in this execution environment.

## Uncertainty

The accepted YouGov tables state that, based on recent election-polling performance, party support estimates have an approximate 9-in-10 interval of plus or minus four percentage points and a 2-in-3 interval of plus or minus two points. PULSE displays that uncertainty alongside the result and does not describe the poll as a forecast.

## Closure standard

Issue #105 may close only after exact-head lint, unit and Worker tests, static export and deterministic Playwright pass; every review thread is resolved; the guarded merge succeeds; the primary-poll ingest workflow is triggered by the merged source file; and production deployment/canary results are observed where the secret-configured Worker URL is available.
